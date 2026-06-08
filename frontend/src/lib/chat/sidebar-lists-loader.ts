import { fetchChannels, fetchDms } from "@/lib/api/chat";
import { useChatStore, type ChatSidebarLists } from "@/stores/chat-store";

const inflight = new Map<string, Promise<ChatSidebarLists>>();

export function getSidebarListsFromStore(
  workspaceId: string
): ChatSidebarLists | null {
  const cache = useChatStore.getState().sidebarListsCache;
  if (cache?.workspaceId === workspaceId) return cache;
  return null;
}

/** One shared loader for channels + DMs — deduped and sequential to protect the API/DB pool. */
export function loadSidebarLists(
  token: string,
  workspaceId: string,
  options?: { force?: boolean }
): Promise<ChatSidebarLists> {
  const force = options?.force ?? false;
  if (!force) {
    const cached = getSidebarListsFromStore(workspaceId);
    if (cached) return Promise.resolve(cached);
  }

  const existing = inflight.get(workspaceId);
  if (existing) return existing;

  const promise = (async () => {
    const channelsRes = await fetchChannels(token, workspaceId);
    const dmsRes = await fetchDms(token, workspaceId);
    const result: ChatSidebarLists = {
      workspaceId,
      channels: channelsRes.data,
      dms: dmsRes.data,
    };
    useChatStore.getState().setSidebarListsCache(result);
    return result;
  })().finally(() => {
    inflight.delete(workspaceId);
  });

  inflight.set(workspaceId, promise);
  return promise;
}
