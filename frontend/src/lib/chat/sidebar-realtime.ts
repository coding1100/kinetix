import { fetchChannel, fetchDm } from "@/lib/api/chat";
import { stripMessageHtml } from "@/lib/chat/rich-text/sanitize";
import {
  patchChannelActivityInSidebar,
  removeChannelFromSidebar,
  upsertChannelInSidebar,
} from "@/lib/chat/sidebar-channel";
import { patchDmActivityInSidebar, upsertDmInSidebar } from "@/lib/chat/sidebar-dm";
import { isSidebarCacheForSession, useChatStore } from "@/stores/chat-store";
import {
  invalidateChannelMembers,
  patchCachedChannelMembers,
} from "@/lib/chat/channel-members-cache";
import type {
  ChatChannelJoinedPayload,
  ChatChannelMemberPayload,
  ChatChannelRemovedPayload,
  ChatRealtimePayload,
} from "@/lib/types/realtime";

const pendingDmFetches = new Set<string>();

function isActiveConversation(event: ChatRealtimePayload) {
  const active = useChatStore.getState().activeConversation;
  if (!active) return false;
  return active.kind === event.kind && active.id === event.conversationId;
}

export function applyChannelJoinedToSidebar(
  event: ChatChannelJoinedPayload,
  currentUserId: string | undefined
) {
  if (!currentUserId || !event.userIds.includes(currentUserId)) return;
  upsertChannelInSidebar(event.channel, event.workspaceId);
}

export function applyChannelRemovedFromSidebar(
  event: ChatChannelRemovedPayload,
  currentUserId: string | undefined
): boolean {
  if (!currentUserId || !event.userIds.includes(currentUserId)) return false;

  removeChannelFromSidebar(event.channelId);
  invalidateChannelMembers(event.workspaceId, event.channelId);

  const active = useChatStore.getState().activeConversation;
  const viewingRemovedChannel =
    active?.kind === "channel" && active.id === event.channelId;

  if (viewingRemovedChannel) {
    const { setActiveConversation, setActiveThread, setChannelDetailsView } =
      useChatStore.getState();
    setActiveConversation(null);
    setActiveThread(null);
    setChannelDetailsView(null);
  }

  return viewingRemovedChannel;
}

const pendingChannelFetches = new Set<string>();

export function applyChannelMemberUpdate(
  event: ChatChannelMemberPayload,
  currentUserId: string | undefined,
  accessToken: string | undefined
) {
  const { workspaceId, channelId, member, removed } = event;
  patchCachedChannelMembers(workspaceId, channelId, (members) => {
    if (removed) {
      return members.filter((m) => m.id !== member.id);
    }
    const index = members.findIndex((m) => m.id === member.id);
    if (index === -1) {
      return [...members, member];
    }
    const next = [...members];
    next[index] = { ...next[index], ...member };
    return next;
  });

  if (
    removed ||
    !currentUserId ||
    member.id !== currentUserId ||
    !accessToken
  ) {
    return;
  }

  const cache = useChatStore.getState().sidebarListsCache;
  const alreadyListed =
    isSidebarCacheForSession(cache, currentUserId, workspaceId) &&
    cache!.channels.some((c) => c.id === channelId);
  if (alreadyListed || pendingChannelFetches.has(channelId)) return;

  pendingChannelFetches.add(channelId);
  void fetchChannel(accessToken, workspaceId, channelId)
    .then((channel) => upsertChannelInSidebar(channel, workspaceId))
    .catch(() => undefined)
    .finally(() => {
      pendingChannelFetches.delete(channelId);
    });
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
      isSidebarCacheForSession(cache, currentUserId, workspaceId) &&
      cache!.dms.some((d) => d.id === conversationId);

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
      .catch(() => undefined)
      .finally(() => {
        pendingDmFetches.delete(conversationId);
      });
    return;
  }

  if (
    kind === "channel" &&
    isSidebarCacheForSession(cache, currentUserId, workspaceId) &&
    cache!.channels.some((c) => c.id === conversationId)
  ) {
    patchChannelActivityInSidebar(workspaceId, conversationId, {
      lastMessage,
      lastAt,
      bumpUnread,
    });
  }
}
