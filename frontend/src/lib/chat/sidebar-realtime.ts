import { fetchChannel, fetchDm } from "@/lib/api/chat";
import { stripMessageHtml } from "@/lib/chat/rich-text/sanitize";
import {
  patchChannelActivityInSidebar,
  patchSidebarChannel,
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
  ChatChannelPrivacyPayload,
  ChatChannelRemovedPayload,
  ChatChannelRenamedPayload,
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

export function applyChannelRenamedToSidebar(event: ChatChannelRenamedPayload) {
  patchSidebarChannel(event.channelId, { name: event.name });
}

export function applyChannelPrivacyChanged(
  event: ChatChannelPrivacyPayload
) {
  patchSidebarChannel(event.channelId, { isPrivate: event.isPrivate });
}

const pendingChannelFetches = new Set<string>();

export function applyChannelMemberUpdate(
  event: ChatChannelMemberPayload,
  currentUserId: string | undefined,
  accessToken: string | undefined
): boolean {
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

  if (!currentUserId || member.id !== currentUserId) {
    return false;
  }

  if (removed) {
    // This is how a List-privacy toggle (or any other membership resync
    // not driven by an explicit "remove from channel" action) reaches the
    // sidebar - chat:channel:removed only fires for an explicit removal,
    // sync_list_channel_members_for_space always emits this event instead.
    // Without this branch the channel stayed in the recipient's own
    // Channels tab forever once they lost access, even though the
    // ChatChannelMember row backing it was already gone server-side.
    removeChannelFromSidebar(channelId);
    invalidateChannelMembers(workspaceId, channelId);

    const active = useChatStore.getState().activeConversation;
    const viewingRemovedChannel =
      active?.kind === "channel" && active.id === channelId;
    if (viewingRemovedChannel) {
      const { setActiveConversation, setActiveThread, setChannelDetailsView } =
        useChatStore.getState();
      setActiveConversation(null);
      setActiveThread(null);
      setChannelDetailsView(null);
    }
    return viewingRemovedChannel;
  }

  if (!accessToken) return false;

  const cache = useChatStore.getState().sidebarListsCache;
  const alreadyListed =
    isSidebarCacheForSession(cache, currentUserId, workspaceId) &&
    cache!.channels.some((c) => c.id === channelId);
  if (alreadyListed || pendingChannelFetches.has(channelId)) return false;

  pendingChannelFetches.add(channelId);
  void fetchChannel(accessToken, workspaceId, channelId)
    .then((channel) => upsertChannelInSidebar(channel, workspaceId))
    .catch(() => undefined)
    .finally(() => {
      pendingChannelFetches.delete(channelId);
    });
  return false;
}

export function applyRealtimeMessageToSidebar(
  event: ChatRealtimePayload,
  currentUserId: string | undefined,
  accessToken: string | undefined
) {
  if (event.parentId) return;
  if (!currentUserId) return;

  const { workspaceId, kind, conversationId, message } = event;
  const isOwnMessage = message.authorId === currentUserId;
  const lastMessage = stripMessageHtml(message.body);
  const lastAt = message.createdAt;
  // Own messages still bump the conversation to the top of the sidebar,
  // just never as unread for the sender.
  const bumpUnread = !isOwnMessage && !isActiveConversation(event);
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
