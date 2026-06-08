import { fetchChannelMembers } from "@/lib/api/chat";
import type { ChannelMember } from "@/lib/types/chat";

type CacheEntry = {
  workspaceId: string;
  members: ChannelMember[];
  loaded?: boolean;
  promise?: Promise<ChannelMember[]>;
};

const cache = new Map<string, CacheEntry>();
const revisionByKey = new Map<string, number>();
const listeners = new Set<() => void>();

function cacheKey(workspaceId: string, channelId: string) {
  return `${workspaceId}:${channelId}`;
}

function bumpRevision(workspaceId: string, channelId: string) {
  const key = cacheKey(workspaceId, channelId);
  revisionByKey.set(key, (revisionByKey.get(key) ?? 0) + 1);
  listeners.forEach((listener) => listener());
}

export function subscribeChannelMembers(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getChannelMembersRevision(
  workspaceId: string,
  channelId: string
) {
  return revisionByKey.get(cacheKey(workspaceId, channelId)) ?? 0;
}

export function getCachedChannelMembers(
  workspaceId: string,
  channelId: string
): ChannelMember[] | undefined {
  const entry = cache.get(cacheKey(workspaceId, channelId));
  if (!entry || entry.workspaceId !== workspaceId || !entry.loaded) {
    return undefined;
  }
  return entry.members;
}

export function setCachedChannelMembers(
  workspaceId: string,
  channelId: string,
  members: ChannelMember[]
) {
  cache.set(cacheKey(workspaceId, channelId), {
    workspaceId,
    members,
    loaded: true,
  });
  bumpRevision(workspaceId, channelId);
}

export function patchCachedChannelMembers(
  workspaceId: string,
  channelId: string,
  updater: (members: ChannelMember[]) => ChannelMember[]
) {
  const key = cacheKey(workspaceId, channelId);
  const entry = cache.get(key);
  if (!entry?.loaded) return;
  cache.set(key, {
    ...entry,
    members: updater(entry.members),
  });
  bumpRevision(workspaceId, channelId);
}

export function invalidateChannelMembers(
  workspaceId: string,
  channelId: string
) {
  cache.delete(cacheKey(workspaceId, channelId));
  bumpRevision(workspaceId, channelId);
}

export function loadChannelMembers(
  token: string,
  workspaceId: string,
  channelId: string,
  options?: { force?: boolean }
): Promise<ChannelMember[]> {
  const key = cacheKey(workspaceId, channelId);
  const existing = cache.get(key);
  const force = options?.force ?? false;

  if (!force && existing?.workspaceId === workspaceId) {
    if (existing.promise) return existing.promise;
    if (existing.loaded) return Promise.resolve(existing.members);
  }

  const promise = fetchChannelMembers(token, workspaceId, channelId)
    .then((res) => {
      const members = res.data;
      cache.set(key, { workspaceId, members, loaded: true });
      bumpRevision(workspaceId, channelId);
      return members;
    })
    .catch((err) => {
      const entry = cache.get(key);
      if (entry?.promise === promise) {
        cache.set(key, {
          workspaceId,
          members: entry.members,
          loaded: entry.loaded,
        });
      }
      throw err;
    });

  cache.set(key, {
    workspaceId,
    members: force ? [] : (existing?.members ?? []),
    loaded: force ? false : existing?.loaded,
    promise,
  });

  return promise;
}

export function prefetchChannelMembers(
  token: string,
  workspaceId: string,
  channelId: string
) {
  if (!channelId) return;
  void loadChannelMembers(token, workspaceId, channelId).catch(() => undefined);
}
