import { fetchChannels, fetchDms } from "@/lib/api/chat";
import type { Channel, DirectMessage } from "@/lib/types/chat";
import {
  isSidebarCacheForSession,
  useChatStore,
  type ChatSidebarLists,
} from "@/stores/chat-store";
import { useAuthStore } from "@/stores/auth-store";

function sortByLastAt<T extends { lastAt: string }>(items: T[]) {
  return [...items].sort(
    (a, b) => new Date(b.lastAt).getTime() - new Date(a.lastAt).getTime()
  );
}

/** Merge API lists with socket/cache upserts; cache is authoritative for removals. */
export function mergeSidebarChannels(
  queryChannels: Channel[] | undefined,
  cacheChannels: Channel[] | undefined
): Channel[] {
  const merged = new Map<string, Channel>();
  for (const channel of queryChannels ?? []) {
    merged.set(channel.id, channel);
  }
  if (cacheChannels !== undefined) {
    const cacheIds = new Set(cacheChannels.map((c) => c.id));
    for (const channel of cacheChannels) {
      const existing = merged.get(channel.id);
      merged.set(channel.id, existing ? { ...existing, ...channel } : channel);
    }
    for (const id of [...merged.keys()]) {
      if (!cacheIds.has(id)) {
        merged.delete(id);
      }
    }
  }
  return sortByLastAt([...merged.values()]);
}

export function mergeSidebarDms(
  queryDms: DirectMessage[] | undefined,
  cacheDms: DirectMessage[] | undefined
): DirectMessage[] {
  const merged = new Map<string, DirectMessage>();
  for (const dm of queryDms ?? []) {
    merged.set(dm.id, dm);
  }
  for (const dm of cacheDms ?? []) {
    const existing = merged.get(dm.id);
    merged.set(dm.id, existing ? { ...existing, ...dm } : dm);
  }
  return sortByLastAt([...merged.values()]);
}

const inflight = new Map<string, Promise<ChatSidebarLists>>();

function inflightKey(userId: string, workspaceId: string) {
  return `${userId}:${workspaceId}`;
}

export function clearSidebarInflight() {
  inflight.clear();
}

export function getSidebarListsFromStore(
  workspaceId: string,
  userId?: string | null
): ChatSidebarLists | null {
  const resolvedUserId = userId ?? useAuthStore.getState().user?.id;
  const cache = useChatStore.getState().sidebarListsCache;
  if (isSidebarCacheForSession(cache, resolvedUserId, workspaceId)) {
    return cache;
  }
  return null;
}

/** One shared loader for channels + DMs — deduped and sequential to protect the API/DB pool. */
export function loadSidebarLists(
  token: string,
  workspaceId: string,
  options?: { force?: boolean }
): Promise<ChatSidebarLists> {
  const userId = useAuthStore.getState().user?.id;
  if (!userId) {
    return Promise.reject(new Error("No authenticated user"));
  }

  const force = options?.force ?? false;
  const key = inflightKey(userId, workspaceId);

  if (!force) {
    const cached = getSidebarListsFromStore(workspaceId, userId);
    if (cached) return Promise.resolve(cached);
  }

  const existing = inflight.get(key);
  if (existing) return existing;

  const promise = (async () => {
    const [channelsRes, dmsRes] = await Promise.all([
      fetchChannels(token, workspaceId),
      fetchDms(token, workspaceId),
    ]);
    const result: ChatSidebarLists = {
      userId,
      workspaceId,
      channels: channelsRes.data,
      dms: dmsRes.data,
    };
    useChatStore.getState().setSidebarListsCache(result);
    return result;
  })().finally(() => {
    inflight.delete(key);
  });

  inflight.set(key, promise);
  return promise;
}
