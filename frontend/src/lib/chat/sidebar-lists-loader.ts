import { fetchChannels, fetchDms } from "@/lib/api/chat";
import {
  isSidebarCacheForSession,
  useChatStore,
  type ChatSidebarLists,
} from "@/stores/chat-store";
import { useAuthStore } from "@/stores/auth-store";

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
