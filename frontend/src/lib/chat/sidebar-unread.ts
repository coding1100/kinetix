import type { ChatSidebarLists } from "@/stores/chat-store";

export function patchSidebarConversationUnread(
  cache: ChatSidebarLists | null,
  workspaceId: string,
  kind: "channel" | "dm",
  conversationId: string,
  unread: number
): ChatSidebarLists | null {
  if (!cache || cache.workspaceId !== workspaceId) return cache;

  if (kind === "channel") {
    return {
      ...cache,
      channels: cache.channels.map((c) =>
        c.id === conversationId ? { ...c, unread } : c
      ),
    };
  }

  return {
    ...cache,
    dms: cache.dms.map((d) =>
      d.id === conversationId ? { ...d, unread } : d
    ),
  };
}

export function bumpSidebarConversationUnread(
  cache: ChatSidebarLists | null,
  workspaceId: string,
  kind: "channel" | "dm",
  conversationId: string
): ChatSidebarLists | null {
  if (!cache || cache.workspaceId !== workspaceId) return cache;

  if (kind === "channel") {
    return {
      ...cache,
      channels: cache.channels.map((c) =>
        c.id === conversationId ? { ...c, unread: c.unread + 1 } : c
      ),
    };
  }

  return {
    ...cache,
    dms: cache.dms.map((d) =>
      d.id === conversationId ? { ...d, unread: d.unread + 1 } : d
    ),
  };
}
