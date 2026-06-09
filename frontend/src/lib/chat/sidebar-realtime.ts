import { fetchDm } from "@/lib/api/chat";
import { stripMessageHtml } from "@/lib/chat/rich-text/sanitize";
import { patchChannelActivityInSidebar } from "@/lib/chat/sidebar-channel";
import { patchDmActivityInSidebar, upsertDmInSidebar } from "@/lib/chat/sidebar-dm";
import { useChatStore } from "@/stores/chat-store";
import type { ChatRealtimePayload } from "@/lib/types/realtime";

const pendingDmFetches = new Set<string>();

function isActiveConversation(event: ChatRealtimePayload) {
  const active = useChatStore.getState().activeConversation;
  if (!active) return false;
  return active.kind === event.kind && active.id === event.conversationId;
}

export function applyRealtimeMessageToSidebar(
  event: ChatRealtimePayload,
  currentUserId: string | undefined,
  accessToken: string | undefined
) {
  if (event.parentId) return;
  if (!currentUserId || event.message.authorId === currentUserId) return;

  const { workspaceId, kind, conversationId, message } = event;
  const lastMessage = stripMessageHtml(message.body);
  const lastAt = message.createdAt;
  const bumpUnread = !isActiveConversation(event);
  const cache = useChatStore.getState().sidebarListsCache;

  if (kind === "dm") {
    const exists =
      cache?.workspaceId === workspaceId &&
      cache.dms.some((d) => d.id === conversationId);

    if (exists) {
      patchDmActivityInSidebar(workspaceId, conversationId, {
        lastMessage,
        lastAt,
        bumpUnread,
      });
      return;
    }

    if (!accessToken || pendingDmFetches.has(conversationId)) return;

    pendingDmFetches.add(conversationId);
    void fetchDm(accessToken, workspaceId, conversationId)
      .then((dm) => {
        upsertDmInSidebar(
          {
            ...dm,
            lastMessage,
            lastAt,
            unread: bumpUnread ? Math.max(dm.unread, 0) + 1 : dm.unread,
          },
          workspaceId
        );
      })
      .catch(() => {
        upsertDmInSidebar(
          {
            id: conversationId,
            name: message.authorName,
            isGroup: false,
            lastMessage,
            lastAt,
            unread: bumpUnread ? 1 : 0,
            otherUserId: message.authorId,
          },
          workspaceId
        );
      })
      .finally(() => {
        pendingDmFetches.delete(conversationId);
      });
    return;
  }

  if (
    kind === "channel" &&
    cache?.workspaceId === workspaceId &&
    cache.channels.some((c) => c.id === conversationId)
  ) {
    patchChannelActivityInSidebar(workspaceId, conversationId, {
      lastMessage,
      lastAt,
      bumpUnread,
    });
  }
}
