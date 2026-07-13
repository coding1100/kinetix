import { fetchChannels, fetchDms } from "@/lib/api/chat";
import type { Channel, DirectMessage } from "@/lib/types/chat";
import { mergeConversationUnread } from "@/lib/chat/sidebar-unread-merge";
import {
  isSidebarCacheForSession,
  useChatStore,
  type ChatSidebarLists,
} from "@/stores/chat-store";
import { useAuthStore } from "@/stores/auth-store";

function activeChannelId(): string | null {
  const active = useChatStore.getState().activeConversation;
  return active?.kind === "channel" ? active.id : null;
}

function activeDmId(): string | null {
  const active = useChatStore.getState().activeConversation;
  return active?.kind === "dm" ? active.id : null;
}

function sortByLastAt<T extends { lastAt: string }>(items: T[]) {
  return [...items].sort(
    (a, b) => new Date(b.lastAt).getTime() - new Date(a.lastAt).getTime()
  );
}

/** Merge API lists with socket/cache upserts; the fresh API response is authoritative for set membership (additions and removals) once it has loaded, cache only carries forward local fields. While the fresh response hasn't loaded yet (undefined), show the cache as-is (stale-while-revalidate) instead of going blank. */
export function mergeSidebarChannels(
  queryChannels: Channel[] | undefined,
  cacheChannels: Channel[] | undefined
): Channel[] {
  if (queryChannels === undefined) {
    return sortByLastAt([...(cacheChannels ?? [])]);
  }
  const merged = new Map<string, Channel>();
  for (const channel of queryChannels) {
    merged.set(channel.id, channel);
  }
  if (cacheChannels !== undefined) {
    for (const channel of cacheChannels) {
      const existing = merged.get(channel.id);
      if (!existing) continue;
      merged.set(channel.id, {
        ...existing,
        ...channel,
        canDelete: channel.canDelete ?? existing.canDelete,
        createdById: channel.createdById ?? existing.createdById,
        unread: mergeConversationUnread(channel.unread, existing.unread, {
          isActive: activeChannelId() === channel.id,
        }),
      });
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
    merged.set(
      dm.id,
      existing
        ? {
            ...existing,
            ...dm,
            unread: mergeConversationUnread(dm.unread, existing.unread, {
              isActive: activeDmId() === dm.id,
            }),
          }
        : dm
    );
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
    const existing = getSidebarListsFromStore(workspaceId, userId);
    const result: ChatSidebarLists = {
      userId,
      workspaceId,
      channels: mergeSidebarChannels(channelsRes.data, existing?.channels),
      dms: mergeSidebarDms(dmsRes.data, existing?.dms),
    };
    useChatStore.getState().setSidebarListsCache(result);
    return result;
  })().finally(() => {
    inflight.delete(key);
  });

  inflight.set(key, promise);
  return promise;
}
