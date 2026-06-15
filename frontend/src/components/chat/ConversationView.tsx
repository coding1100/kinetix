"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import {
  MoreHorizontalIcon,
  PinIcon,
  BellIcon,
  SearchIcon,
  StarIcon,
  LinkIcon,
  MailIcon,
} from "lucide-react";
import type {
  Channel,
  ChatMessage,
  ConversationType,
  DirectMessage,
  SendMessagePayload,
  UpdateMessagePayload,
} from "@/lib/types/chat";
import {
  deleteChannel,
  fetchChannel,
  fetchChannelMessages,
  fetchDm,
  fetchDmMessages,
  markChannelRead,
  markChannelUnread,
  markDmRead,
  markDmUnread,
  sendChannelMessage,
  sendDmMessage,
  deleteChatMessage,
  toggleMessageReaction,
  updateChatMessage,
  pinMessage,
} from "@/lib/api/chat";
import { useWorkspaceApi } from "@/hooks/use-workspace-api";
import { useWorkspaceMembersQuery } from "@/hooks/use-workspace-members-query";
import { ApiError } from "@/lib/api/client";
import { PageLoader } from "@/components/ui/page-loader";
import { MessageList } from "./MessageList";
import { MessageComposer } from "./MessageComposer";
import { ThreadPanel } from "./ThreadPanel";
import { DmSearchPanel } from "./DmSearchPanel";
import { DmDetailsRail } from "./DmDetailsRail";
import { DmRepliesPanel } from "./DmRepliesPanel";
import { DmPersonSettingsPanel } from "./DmPersonSettingsPanel";
import type { ChatSearchHit } from "@/lib/types/chat";
import { ChannelDetailsRail } from "./channel/ChannelDetailsRail";
import { ChannelDetailsPanel } from "./channel/ChannelDetailsPanel";
import { useChatStore } from "@/stores/chat-store";
import { useUiStore } from "@/stores/ui-store";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  avatarColorClassForKey,
  avatarInitialFromName,
} from "@/lib/user-display";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  applyMessageUpdate,
  appendUniqueMessage,
  removeMessageById,
  ATTACHMENT_PLACEHOLDER,
  createOptimisticMessage,
  mergeConfirmedMessage,
  mergeFetchedMessages,
  mergeIncomingMessage,
  normalizeMessageForViewer,
} from "@/lib/chat/messages";
import { optimisticToggleReaction } from "@/lib/chat/reactions";
import { GroupDmAvatarStack } from "@/components/chat/GroupDmAvatarStack";
import {
  enrichGroupDm,
  otherGroupParticipants,
  resolveGroupDmTitle,
} from "@/lib/chat/group-dm-display";
import { upsertDmInSidebar } from "@/lib/chat/sidebar-dm";
import { DmGroupMembersPanel } from "@/components/chat/DmGroupMembersPanel";
import { useAuthStore } from "@/stores/auth-store";
import { ChannelNameLabel } from "@/components/chat/ChannelNameLabel";
import { useChannelFavorite } from "@/hooks/use-channel-favorite";
import { useChannelPin } from "@/hooks/use-channel-pin";
import {
  invalidateChannelMembers,
  prefetchChannelMembers,
} from "@/lib/chat/channel-members-cache";
import {
  removeChannelFromSidebar,
  upsertChannelInSidebar,
} from "@/lib/chat/sidebar-channel";
import {
  getConversationCache,
  setConversationCache,
} from "@/lib/chat/conversation-cache";
import { UNREAD_BADGE_HIDE_DELAY_MS } from "@/lib/chat/sidebar-display-unread";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { PersonProfilePanel } from "@/components/chat/PersonProfilePanel";
import { MessageQuoteToolbar } from "@/components/chat/MessageQuoteToolbar";

const MESSAGE_PAGE_SIZE = 50;

export function ConversationView({
  type,
  id,
}: {
  type: ConversationType;
  id: string;
}) {
  const router = useRouter();
  const { accessToken, workspaceId, ready } = useWorkspaceApi();
  const currentUserId = useAuthStore((s) => s.user?.id);
  const workspaceRole = useAuthStore((s) =>
    s.workspaces.find((w) => w.id === workspaceId)?.role
  );
  const activeThreadMessageId = useChatStore((s) => s.activeThreadMessageId);
  const setActiveThread = useChatStore((s) => s.setActiveThread);
  const dmDetailsView = useChatStore((s) => s.dmDetailsView);
  const messageScrollTarget = useChatStore((s) => s.messageScrollTarget);
  const clearMessageScrollTarget = useChatStore(
    (s) => s.clearMessageScrollTarget
  );
  const channelDetailsView = useChatStore((s) => s.channelDetailsView);
  const personProfileUserId = useChatStore((s) => s.personProfileUserId);
  const toggleChannelDetailsView = useChatStore(
    (s) => s.toggleChannelDetailsView
  );
  const setChannelDetailsView = useChatStore((s) => s.setChannelDetailsView);
  const openModal = useUiStore((s) => s.openModal);
  const realtimeEvent = useChatStore((s) => s.realtimeEvent);
  const clearRealtimeEvent = useChatStore((s) => s.clearRealtimeEvent);
  const messageEditEvent = useChatStore((s) => s.messageEditEvent);
  const clearMessageEditEvent = useChatStore((s) => s.clearMessageEditEvent);
  const messageDeleteEvent = useChatStore((s) => s.messageDeleteEvent);
  const clearMessageDeleteEvent = useChatStore(
    (s) => s.clearMessageDeleteEvent
  );
  const reactionEvent = useChatStore((s) => s.reactionEvent);
  const clearReactionEvent = useChatStore((s) => s.clearReactionEvent);
  const typingEvent = useChatStore((s) => s.typingEvent);
  const clearTypingEvent = useChatStore((s) => s.clearTypingEvent);
  const readEvent = useChatStore((s) => s.readEvent);
  const clearReadEvent = useChatStore((s) => s.clearReadEvent);
  const setConversationUnread = useChatStore((s) => s.setConversationUnread);
  const setActiveConversation = useChatStore((s) => s.setActiveConversation);
  const setUnreadBadgeHold = useChatStore((s) => s.setUnreadBadgeHold);
  const clearUnreadBadgeHold = useChatStore((s) => s.clearUnreadBadgeHold);
  const clearComposerEdit = useChatStore((s) => s.clearComposerEdit);
  const cachedChannelName = useChatStore((s) =>
    type === "channel"
      ? s.sidebarListsCache?.channels.find((c) => c.id === id)?.name
      : undefined
  );
  const cachedChannelStarred = useChatStore((s) =>
    type === "channel"
      ? s.sidebarListsCache?.channels.find((c) => c.id === id)?.starred
      : undefined
  );
  const cachedChannelMemberCount = useChatStore((s) =>
    type === "channel"
      ? s.sidebarListsCache?.channels.find((c) => c.id === id)?.memberCount
      : undefined
  );
  const cachedSidebarChannel = useChatStore((s) =>
    type === "channel"
      ? s.sidebarListsCache?.channels.find((c) => c.id === id)
      : undefined
  );
  const cachedDmName = useChatStore((s) =>
    type === "dm"
      ? s.sidebarListsCache?.dms.find((d) => d.id === id)?.name
      : undefined
  );
  const cachedDm = useChatStore((s) =>
    type === "dm"
      ? s.sidebarListsCache?.dms.find((d) => d.id === id)
      : undefined
  );
  const overrideChannelName = useChatStore((s) =>
    type === "channel" ? s.channelMetaOverrides[id]?.name : undefined
  );
  const overrideChannelStarred = useChatStore((s) =>
    type === "channel" ? s.channelMetaOverrides[id]?.starred : undefined
  );

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [nextBefore, setNextBefore] = useState<string | null>(null);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [typingUserIds, setTypingUserIds] = useState<string[]>([]);
  const [channel, setChannel] = useState<Channel | null>(null);
  const [dm, setDm] = useState<DirectMessage | null>(null);
  const [messagesLoading, setMessagesLoading] = useState(true);
  const [conversationContentReady, setConversationContentReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scrollToMessageId, setScrollToMessageId] = useState<string | null>(
    null
  );
  const [highlightMessageId, setHighlightMessageId] = useState<string | null>(
    null
  );
  const [deleteChannelOpen, setDeleteChannelOpen] = useState(false);
  const [deletingChannel, setDeletingChannel] = useState(false);
  const loadAbortRef = useRef<AbortController | null>(null);
  const conversationKeyRef = useRef(`${type}:${id}`);
  const readDelayKeyRef = useRef<string | null>(null);
  const contentReadyRef = useRef(false);
  const markConversationReadRef = useRef<() => Promise<void>>(async () => {});

  useEffect(() => {
    if (!messageScrollTarget) return;
    setScrollToMessageId(messageScrollTarget);
    setHighlightMessageId(messageScrollTarget);
    clearMessageScrollTarget();
  }, [messageScrollTarget, clearMessageScrollTarget]);

  const resolveCachedMeta = useCallback(() => {
    const cached = getConversationCache(workspaceId, type, id);
    const lists = useChatStore.getState().sidebarListsCache;
    if (type === "channel") {
      return (
        cached?.channel ??
        lists?.channels.find((c) => c.id === id) ??
        null
      );
    }
    return cached?.dm ?? lists?.dms.find((d) => d.id === id) ?? null;
  }, [workspaceId, type, id]);

  useLayoutEffect(() => {
    conversationKeyRef.current = `${type}:${id}`;
    setActiveConversation({ kind: type, id });
    setConversationContentReady(false);
    contentReadyRef.current = false;
    readDelayKeyRef.current = null;
    clearUnreadBadgeHold();
    setHasMoreMessages(false);
    setNextBefore(null);
    setTypingUserIds([]);

    const meta = resolveCachedMeta();
    if (type === "channel") {
      setChannel((prev) => {
        const cached = (meta as Channel | null) ?? null;
        if (!cached) return null;
        return {
          ...cached,
          canDelete: prev?.canDelete ?? cached.canDelete,
          createdById: prev?.createdById ?? cached.createdById,
        };
      });
      setDm(null);
    } else {
      setDm((meta as DirectMessage | null) ?? null);
      setChannel(null);
    }

    const cached = getConversationCache(workspaceId, type, id);
    if (cached?.messages.length) {
      setMessages(cached.messages);
      setMessagesLoading(false);
    } else {
      setMessages([]);
      setMessagesLoading(true);
    }
    setError(null);
    clearComposerEdit();

    return () => {
      if (contentReadyRef.current) {
        void markConversationReadRef.current();
      }
      setActiveConversation(null);
      readDelayKeyRef.current = null;
      clearUnreadBadgeHold();
    };
  }, [
    type,
    id,
    workspaceId,
    setActiveConversation,
    resolveCachedMeta,
    clearComposerEdit,
    clearUnreadBadgeHold,
  ]);

  const loadConversation = useCallback(async (signal: AbortSignal) => {
    if (!ready) return;
    const conversationId = id;
    const loadKey = `${type}:${conversationId}`;
    const fetchInit = { signal };

    try {
      const viewerId = useAuthStore.getState().user?.id;
      const msgResult =
        type === "channel"
          ? await fetchChannelMessages(
              accessToken,
              workspaceId,
              conversationId,
              { ...fetchInit, limit: MESSAGE_PAGE_SIZE }
            )
          : await fetchDmMessages(
              accessToken,
              workspaceId,
              conversationId,
              { ...fetchInit, limit: MESSAGE_PAGE_SIZE }
            );

      if (
        signal.aborted ||
        conversationId !== id ||
        conversationKeyRef.current !== loadKey
      ) {
        return;
      }

      const fetched = viewerId
        ? msgResult.data.map((m) => normalizeMessageForViewer(m, viewerId))
        : msgResult.data;

      setMessages((prev) => {
        const next = mergeFetchedMessages(fetched, prev);
        setConversationCache(workspaceId, type, conversationId, {
          messages: next,
        });
        return next;
      });
      setHasMoreMessages(Boolean(msgResult.hasMore));
      setNextBefore(msgResult.nextBefore ?? null);
      setMessagesLoading(false);

      if (type === "channel") {
        const channelMeta = await fetchChannel(
          accessToken,
          workspaceId,
          conversationId,
          fetchInit
        );
        if (
          signal.aborted ||
          conversationId !== id ||
          conversationKeyRef.current !== loadKey
        ) {
          return;
        }
        const prevMeta =
          getConversationCache(workspaceId, type, conversationId)?.channel ??
          resolveCachedMeta();
        const nextChannel: Channel = {
          ...channelMeta,
          canDelete:
            channelMeta.canDelete ??
            (prevMeta as Channel | null)?.canDelete,
          createdById:
            channelMeta.createdById ??
            (prevMeta as Channel | null)?.createdById,
        };
        setChannel(nextChannel);
        upsertChannelInSidebar(nextChannel, workspaceId, { skipRefresh: true });
        setConversationCache(workspaceId, type, conversationId, {
          channel: nextChannel,
          dm: null,
        });
        setDm(null);
      } else {
        let dmMeta = resolveCachedMeta() as DirectMessage | null;
        const needsDmRefresh =
          !dmMeta || (dmMeta.isGroup && !dmMeta.participants?.length);
        if (needsDmRefresh) {
          dmMeta = await fetchDm(
            accessToken,
            workspaceId,
            conversationId,
            fetchInit
          );
          if (
            signal.aborted ||
            conversationId !== id ||
            conversationKeyRef.current !== loadKey
          ) {
            return;
          }
          upsertDmInSidebar(dmMeta, workspaceId);
          setDm(dmMeta);
        }
        setChannel(null);
        setConversationCache(workspaceId, type, conversationId, {
          dm: dmMeta,
          channel: null,
        });
      }

      if (
        !signal.aborted &&
        conversationId === id &&
        conversationKeyRef.current === loadKey
      ) {
        setConversationContentReady(true);
      }
    } catch (err) {
      if (
        signal.aborted ||
        conversationId !== id ||
        conversationKeyRef.current !== loadKey
      ) {
        return;
      }
      if (err instanceof DOMException && err.name === "AbortError") return;

      const cached = getConversationCache(workspaceId, type, conversationId);
      if (!cached?.messages.length) {
        setError(
          err instanceof ApiError ? err.message : "Failed to load conversation"
        );
      } else {
        setConversationContentReady(true);
      }
      setMessagesLoading(false);
    }
  }, [
    ready,
    accessToken,
    workspaceId,
    type,
    id,
    resolveCachedMeta,
  ]);

  const loadOlderMessages = useCallback(async () => {
    if (!ready || !nextBefore || loadingOlder) return;
    setLoadingOlder(true);
    try {
      const viewerId = useAuthStore.getState().user?.id;
      const msgResult =
        type === "channel"
          ? await fetchChannelMessages(accessToken, workspaceId, id, {
              limit: MESSAGE_PAGE_SIZE,
              before: nextBefore,
            })
          : await fetchDmMessages(accessToken, workspaceId, id, {
              limit: MESSAGE_PAGE_SIZE,
              before: nextBefore,
            });
      const older = viewerId
        ? msgResult.data.map((m) => normalizeMessageForViewer(m, viewerId))
        : msgResult.data;
      setMessages((prev) => {
        const next = mergeFetchedMessages(older, prev);
        setConversationCache(workspaceId, type, id, { messages: next });
        return next;
      });
      setHasMoreMessages(Boolean(msgResult.hasMore));
      setNextBefore(msgResult.nextBefore ?? null);
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Failed to load older messages"
      );
    } finally {
      setLoadingOlder(false);
    }
  }, [
    ready,
    nextBefore,
    loadingOlder,
    type,
    accessToken,
    workspaceId,
    id,
  ]);

  const markConversationRead = useCallback(async () => {
    if (!ready) return;
    setConversationUnread(type, id, 0);
    try {
      if (type === "channel") {
        await markChannelRead(accessToken, workspaceId, id);
      } else {
        await markDmRead(accessToken, workspaceId, id);
      }
      setConversationUnread(type, id, 0);
    } catch {
      // keep UI usable if mark-read fails
    }
  }, [ready, accessToken, workspaceId, type, id, setConversationUnread]);

  markConversationReadRef.current = markConversationRead;

  const markConversationUnread = useCallback(async () => {
    if (!ready) return;
    try {
      const res =
        type === "channel"
          ? await markChannelUnread(accessToken, workspaceId, id)
          : await markDmUnread(accessToken, workspaceId, id);
      setConversationUnread(type, id, res.unread);
      toast.success("Marked as unread");
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Could not mark as unread"
      );
    }
  }, [ready, accessToken, workspaceId, type, id, setConversationUnread]);

  useEffect(() => {
    loadAbortRef.current?.abort();
    const controller = new AbortController();
    loadAbortRef.current = controller;
    void loadConversation(controller.signal);
    return () => {
      controller.abort();
    };
  }, [loadConversation]);

  useEffect(() => {
    if (!ready || type !== "channel") return;
    const timer = window.setTimeout(() => {
      prefetchChannelMembers(accessToken, workspaceId, id);
    }, 800);
    return () => window.clearTimeout(timer);
  }, [ready, type, accessToken, workspaceId, id]);

  useEffect(() => {
    contentReadyRef.current = conversationContentReady;
  }, [conversationContentReady]);

  useEffect(() => {
    if (!conversationContentReady || error || !ready) return;

    const key = `${type}:${id}`;
    if (readDelayKeyRef.current === key) return;
    readDelayKeyRef.current = key;

    const lists = useChatStore.getState().sidebarListsCache;
    const currentUnread =
      type === "channel"
        ? (lists?.channels.find((c) => c.id === id)?.unread ?? 0)
        : (lists?.dms.find((d) => d.id === id)?.unread ?? 0);

    if (currentUnread > 0) {
      setUnreadBadgeHold({
        kind: type,
        id,
        count: currentUnread,
        expiresAt: Date.now() + UNREAD_BADGE_HIDE_DELAY_MS,
      });
    }

    const timer = window.setTimeout(() => {
      void markConversationReadRef.current();
      clearUnreadBadgeHold();
    }, UNREAD_BADGE_HIDE_DELAY_MS);

    return () => {
      window.clearTimeout(timer);
    };
  }, [
    conversationContentReady,
    error,
    ready,
    type,
    id,
    setUnreadBadgeHold,
    clearUnreadBadgeHold,
  ]);

  useEffect(() => {
    setActiveThread(null);
  }, [type, id, setActiveThread]);

  useEffect(() => {
    if (!realtimeEvent || realtimeEvent.workspaceId !== workspaceId) return;
    if (realtimeEvent.kind !== type || realtimeEvent.conversationId !== id) {
      return;
    }
    if (realtimeEvent.parentId || !currentUserId) return;

    const incoming = normalizeMessageForViewer(
      realtimeEvent.message,
      currentUserId
    );

    setMessages((prev) => {
      if (incoming.authorId === currentUserId) {
        if (prev.some((m) => m.id === incoming.id)) return prev;
        const hasPending = prev.some(
          (m) =>
            m.id.startsWith("pending-") && m.authorId === currentUserId
        );
        if (!hasPending) return prev;
      }
      const next = mergeIncomingMessage(prev, incoming);
      setConversationCache(workspaceId, type, id, { messages: next });
      return next;
    });
    setMessagesLoading(false);
    clearRealtimeEvent();

    if (incoming.authorId !== currentUserId) {
      setConversationUnread(type, id, 0);
      void markConversationRead();
    }
  }, [
    realtimeEvent,
    workspaceId,
    type,
    id,
    currentUserId,
    clearRealtimeEvent,
    setConversationUnread,
    markConversationRead,
  ]);

  const applyReactions = useCallback(
    (messageId: string, reactions: { emoji: string; count: number }[]) => {
      setMessages((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, reactions } : m))
      );
    },
    []
  );

  useEffect(() => {
    if (!messageEditEvent || messageEditEvent.workspaceId !== workspaceId) return;
    if (messageEditEvent.kind !== type || messageEditEvent.conversationId !== id) {
      return;
    }
    if (messageEditEvent.parentId) return;
    if (!currentUserId) return;
    const updated = normalizeMessageForViewer(
      messageEditEvent.message,
      currentUserId
    );
    setMessages((prev) =>
      applyMessageUpdate(prev, {
        ...updated,
        attachments: updated.attachments ?? [],
      })
    );
    clearMessageEditEvent();
  }, [
    messageEditEvent,
    workspaceId,
    type,
    id,
    currentUserId,
    clearMessageEditEvent,
  ]);

  useEffect(() => {
    if (!messageDeleteEvent || messageDeleteEvent.workspaceId !== workspaceId) {
      return;
    }
    if (
      messageDeleteEvent.kind !== type ||
      messageDeleteEvent.conversationId !== id
    ) {
      return;
    }
    if (messageDeleteEvent.parentId) return;
    const deletedId = messageDeleteEvent.messageId;
    setMessages((prev) => {
      const next = removeMessageById(prev, deletedId);
      setConversationCache(workspaceId, type, id, { messages: next });
      return next;
    });
    if (activeThreadMessageId === deletedId) {
      setActiveThread(null);
    }
    clearComposerEdit();
    clearMessageDeleteEvent();
  }, [
    messageDeleteEvent,
    workspaceId,
    type,
    id,
    activeThreadMessageId,
    setActiveThread,
    clearComposerEdit,
    clearMessageDeleteEvent,
  ]);

  useEffect(() => {
    if (!reactionEvent || reactionEvent.workspaceId !== workspaceId) return;
    applyReactions(reactionEvent.messageId, reactionEvent.reactions);
    clearReactionEvent();
  }, [reactionEvent, workspaceId, applyReactions, clearReactionEvent]);

  useEffect(() => {
    if (!typingEvent || typingEvent.workspaceId !== workspaceId) return;
    if (typingEvent.kind !== type || typingEvent.conversationId !== id) return;
    if (typingEvent.userId === currentUserId) {
      clearTypingEvent();
      return;
    }
    setTypingUserIds((prev) => {
      if (typingEvent.typing) {
        return prev.includes(typingEvent.userId)
          ? prev
          : [...prev, typingEvent.userId];
      }
      return prev.filter((uid) => uid !== typingEvent.userId);
    });
    clearTypingEvent();
  }, [
    typingEvent,
    workspaceId,
    type,
    id,
    currentUserId,
    clearTypingEvent,
  ]);

  useEffect(() => {
    if (!readEvent || readEvent.workspaceId !== workspaceId) return;
    if (readEvent.kind !== type || readEvent.conversationId !== id) return;
    if (readEvent.userId === currentUserId) {
      clearReadEvent();
      return;
    }
    const readAtMs = new Date(readEvent.readAt).getTime();
    setMessages((prev) =>
      prev.map((m) => {
        if (m.authorId !== currentUserId) return m;
        if (new Date(m.createdAt).getTime() > readAtMs) return m;
        const readBy = new Set(m.readByUserIds ?? []);
        readBy.add(readEvent.userId);
        return { ...m, readByUserIds: [...readBy] };
      })
    );
    clearReadEvent();
  }, [readEvent, workspaceId, type, id, currentUserId, clearReadEvent]);

  const handlePinMessage = useCallback(
    async (messageId: string, pinned: boolean) => {
      try {
        const updated = await pinMessage(
          accessToken,
          workspaceId,
          messageId,
          pinned
        );
        setMessages((prev) =>
          prev.map((m) =>
            m.id === messageId
              ? {
                  ...m,
                  pinnedAt: updated.pinnedAt,
                }
              : m
          )
        );
        toast.success(pinned ? "Message pinned" : "Message unpinned");
      } catch (err) {
        toast.error(
          err instanceof ApiError ? err.message : "Failed to update pin"
        );
      }
    },
    [accessToken, workspaceId]
  );

  const handleEditMessage = useCallback(
    async (messageId: string, payload: UpdateMessagePayload) => {
      let rollback: ChatMessage[] | null = null;
      setMessages((prev) => {
        rollback = prev;
        const next = prev.map((m) => {
          if (m.id !== messageId) return m;
          const keepIds = new Set(payload.attachmentIds);
          return {
            ...m,
            body: payload.body,
            attachments: (m.attachments ?? []).filter((attachment) =>
              keepIds.has(attachment.id)
            ),
          };
        });
        setConversationCache(workspaceId, type, id, { messages: next });
        return next;
      });
      try {
        const updated = await updateChatMessage(
          accessToken,
          workspaceId,
          messageId,
          payload
        );
        const normalized = currentUserId
          ? normalizeMessageForViewer(updated, currentUserId)
          : updated;
        setMessages((prev) => {
          const next = applyMessageUpdate(prev, {
            ...normalized,
            attachments: normalized.attachments ?? [],
          });
          setConversationCache(workspaceId, type, id, { messages: next });
          return next;
        });
      } catch (err) {
        if (rollback) {
          setMessages(rollback);
          setConversationCache(workspaceId, type, id, { messages: rollback });
        }
        throw err;
      }
    },
    [accessToken, workspaceId, type, id, currentUserId]
  );

  const handleDeleteMessage = useCallback(
    async (messageId: string) => {
      let rollback: ChatMessage[] | null = null;
      setMessages((prev) => {
        rollback = prev;
        const next = removeMessageById(prev, messageId);
        setConversationCache(workspaceId, type, id, { messages: next });
        return next;
      });
      if (activeThreadMessageId === messageId) {
        setActiveThread(null);
      }
      clearComposerEdit();
      try {
        await deleteChatMessage(accessToken, workspaceId, messageId);
      } catch (err) {
        if (rollback) {
          setMessages(rollback);
          setConversationCache(workspaceId, type, id, { messages: rollback });
        }
        throw err;
      }
    },
    [
      accessToken,
      workspaceId,
      type,
      id,
      activeThreadMessageId,
      setActiveThread,
      clearComposerEdit,
    ]
  );

  const handleToggleReaction = useCallback(
    async (messageId: string, emoji: string) => {
      let previousReactions: { emoji: string; count: number }[] = [];
      setMessages((prev) =>
        prev.map((m) => {
          if (m.id !== messageId) return m;
          previousReactions = m.reactions ?? [];
          return {
            ...m,
            reactions: optimisticToggleReaction(previousReactions, emoji),
          };
        })
      );
      try {
        const result = await toggleMessageReaction(
          accessToken,
          workspaceId,
          messageId,
          emoji
        );
        applyReactions(result.messageId, result.reactions);
      } catch (err) {
        applyReactions(messageId, previousReactions);
        toast.error(
          err instanceof ApiError ? err.message : "Failed to update reaction"
        );
      }
    },
    [accessToken, workspaceId, applyReactions]
  );

  const channelName =
    overrideChannelName ?? cachedChannelName ?? channel?.name ?? "Channel";
  const canDeleteChannel = useMemo(() => {
    if (type !== "channel") return false;
    if (workspaceRole === "OWNER" || workspaceRole === "ADMIN") return true;
    const createdById =
      channel?.createdById ?? cachedSidebarChannel?.createdById ?? null;
    if (currentUserId && createdById === currentUserId) return true;
    return Boolean(channel?.canDelete ?? cachedSidebarChannel?.canDelete);
  }, [
    type,
    workspaceRole,
    channel?.canDelete,
    channel?.createdById,
    cachedSidebarChannel?.canDelete,
    cachedSidebarChannel?.createdById,
    currentUserId,
  ]);
  const workspaceMembersQuery = useWorkspaceMembersQuery();

  const dmMetaRaw = type === "dm" ? (dm ?? cachedDm ?? null) : null;
  const dmMeta = useMemo(() => {
    if (!dmMetaRaw) return null;
    if (!dmMetaRaw.isGroup) return dmMetaRaw;
    return enrichGroupDm(
      dmMetaRaw,
      workspaceMembersQuery.data ?? [],
      currentUserId
    );
  }, [dmMetaRaw, workspaceMembersQuery.data, currentUserId]);

  const groupAvatarParticipants = useMemo(
    () => otherGroupParticipants(dmMeta?.participants, currentUserId),
    [dmMeta?.participants, currentUserId]
  );

  const readReceiptMembersById = useMemo(() => {
    const map: Record<
      string,
      { id: string; fullName: string; avatarUrl?: string | null }
    > = {};
    for (const member of workspaceMembersQuery.data ?? []) {
      map[member.id] = {
        id: member.id,
        fullName: member.fullName,
        avatarUrl: member.avatarUrl,
      };
    }
    for (const participant of dmMeta?.participants ?? []) {
      if (!map[participant.id]) {
        map[participant.id] = {
          id: participant.id,
          fullName: participant.fullName,
          avatarUrl: null,
        };
      }
    }
    return map;
  }, [workspaceMembersQuery.data, dmMeta?.participants]);

  const title =
    type === "channel"
      ? channelName
      : dmMeta?.isGroup
        ? resolveGroupDmTitle(
            {
              name: dmMeta.name ?? cachedDmName ?? "",
              isGroup: true,
              participants: dmMeta.participants,
            },
            currentUserId
          )
        : (dmMeta?.name ?? cachedDmName ?? "Direct message");
  const channelStarred =
    overrideChannelStarred ?? cachedChannelStarred ?? channel?.starred ?? false;
  const { starred, toggleFavorite } = useChannelFavorite(
    id,
    channelStarred
  );
  const { pinned: channelPinned, togglePin } = useChannelPin(
    id,
    Boolean(cachedSidebarChannel?.pinnedAt ?? channel?.pinnedAt)
  );
  const recipientLabel = type === "channel" ? `#${title}` : title;
  const otherUserId = dmMeta?.otherUserId;

  const sendingRef = useRef(false);

  const handleSend = async (payload: SendMessagePayload) => {
    if (!ready || !accessToken || !workspaceId) {
      throw new ApiError(401, "UNAUTHORIZED", "Session not ready — try refreshing");
    }
    if (!currentUserId) {
      throw new ApiError(401, "UNAUTHORIZED", "You must be signed in to send messages");
    }
    if (sendingRef.current) return;
    sendingRef.current = true;
    const optimistic = createOptimisticMessage(
      payload.body || ATTACHMENT_PLACEHOLDER,
      currentUserId,
      payload.optimisticAttachments,
      useAuthStore.getState().user?.fullName
    );
    setMessages((prev) => {
      const next = [...prev, optimistic];
      setConversationCache(workspaceId, type, id, { messages: next });
      return next;
    });
    try {
      const msg =
        type === "channel"
          ? await sendChannelMessage(accessToken, workspaceId, id, payload)
          : await sendDmMessage(accessToken, workspaceId, id, payload);
      setMessages((prev) => {
        const next = mergeConfirmedMessage(prev, optimistic.id, msg);
        setConversationCache(workspaceId, type, id, { messages: next });
        return next;
      });
    } catch (err) {
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
      throw err;
    } finally {
      sendingRef.current = false;
    }
  };

  const openChannelPanel = (view: Parameters<typeof toggleChannelDetailsView>[0]) => {
    toggleChannelDetailsView(view);
  };

  const handleDmSearchSelect = (hit: ChatSearchHit) => {
    if (hit.inThread && hit.parentId) {
      setActiveThread(hit.parentId);
      setScrollToMessageId(null);
      setHighlightMessageId(hit.parentId);
    } else {
      setActiveThread(null);
      setScrollToMessageId(hit.id);
      setHighlightMessageId(hit.id);
    }
  };

  const clearSearchHighlight = () => {
    setScrollToMessageId(null);
    window.setTimeout(() => setHighlightMessageId(null), 2500);
  };

  const handleDeleteChannel = async () => {
    if (!ready || type !== "channel") return;
    setDeletingChannel(true);
    try {
      await deleteChannel(accessToken, workspaceId, id);
      const remaining = useChatStore
        .getState()
        .sidebarListsCache?.channels.filter((c) => c.id !== id);
      removeChannelFromSidebar(id);
      invalidateChannelMembers(workspaceId, id);
      setChannelDetailsView(null);
      setActiveThread(null);
      toast.success(`#${channelName} deleted`);
      setDeleteChannelOpen(false);
      const nextChannel = remaining?.[0];
      router.push(nextChannel ? `/chat/c/${nextChannel.id}` : "/chat");
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Failed to delete channel"
      );
    } finally {
      setDeletingChannel(false);
    }
  };

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-card">
      <header className="flex h-14 shrink-0 items-center justify-between px-4">
        <div className="flex min-w-0 items-center gap-2.5">
          {type === "channel" ? (
            <div className="min-w-0">
              <h2 className="truncate text-base font-semibold leading-tight">
                <ChannelNameLabel
                  name={title}
                  starred={starred}
                  nameClassName="font-semibold text-foreground"
                />
              </h2>
              <p className="truncate text-xs text-muted-foreground">
                {channel?.topic?.trim()
                  ? channel.topic
                  : `${channel?.memberCount ?? cachedChannelMemberCount ?? 0} member${
                      (channel?.memberCount ?? cachedChannelMemberCount ?? 0) === 1
                        ? ""
                        : "s"
                    }`}
              </p>
            </div>
          ) : (
            <>
              {dmMeta?.isGroup && groupAvatarParticipants.length > 0 ? (
                <GroupDmAvatarStack
                  participants={groupAvatarParticipants}
                  size="md"
                />
              ) : (
                <Avatar className="size-8 shrink-0">
                  <AvatarFallback
                    className={cn(
                      "text-sm font-semibold",
                      avatarColorClassForKey(otherUserId, title)
                    )}
                  >
                    {avatarInitialFromName(title)}
                  </AvatarFallback>
                </Avatar>
              )}
              <div className="min-w-0">
                <h2 className="truncate text-base font-semibold leading-tight">
                  {title}
                </h2>
                <p className="truncate text-xs text-muted-foreground">
                  {dmMeta?.isGroup
                    ? `${dmMeta.participants?.length ?? dmMeta.members?.length ?? 0} members`
                    : "Direct message"}
                </p>
              </div>
            </>
          )}
        </div>
        {type === "channel" ? (
        <div className="flex items-center gap-0.5">
          <Button
            variant="ghost"
            size="icon-sm"
            title={channelPinned ? "Unpin channel" : "Pin channel"}
            onClick={() => void togglePin()}
            className={cn(channelPinned && "text-primary")}
          >
            <PinIcon
              className={cn("size-4", channelPinned && "fill-current")}
              strokeWidth={1.75}
            />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            title="Notifications"
            onClick={() => openChannelPanel("settings")}
          >
            <BellIcon className="size-4" strokeWidth={1.75} />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            title="Search"
            onClick={() => openChannelPanel("search")}
          >
            <SearchIcon className="size-4" strokeWidth={1.75} />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button variant="ghost" size="icon-sm" title="More options">
                  <MoreHorizontalIcon className="size-4" strokeWidth={1.75} />
                </Button>
              }
            />
            <DropdownMenuContent align="end" className="w-52">
              <>
                  <DropdownMenuItem
                    onClick={() => void markConversationUnread()}
                  >
                    Mark as unread
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => openModal("rename-channel", id)}
                  >
                    Rename
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => toast.success("Link copied")}>
                    <LinkIcon className="size-4" />
                    Copy link
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => void toggleFavorite()}>
                    <StarIcon
                      className={cn(
                        "size-4",
                        starred && "fill-amber-400 text-amber-400"
                      )}
                    />
                    {starred ? "Remove from favorites" : "Favorite"}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => toast("Email to channel — Phase 3")}>
                    <MailIcon className="size-4" />
                    Email to Channel
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => openChannelPanel("settings")}>
                    <BellIcon className="size-4" />
                    Notification settings
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => openChannelPanel("followers")}>
                    Follow / Unfollow
                  </DropdownMenuItem>
                  {canDeleteChannel ? (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        variant="destructive"
                        onClick={() => setDeleteChannelOpen(true)}
                      >
                        Delete Channel
                      </DropdownMenuItem>
                    </>
                  ) : null}
                </>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        ) : null}
      </header>
      <Separator />
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {error ? (
            <div className="flex flex-1 items-center justify-center p-6 text-sm text-destructive">
              {error}
            </div>
          ) : messagesLoading && messages.length === 0 ? (
            <div className="flex min-h-0 flex-1 flex-col">
              <PageLoader label="Loading messages…" />
            </div>
          ) : (
            <MessageList
              messages={messages}
              conversationType={type}
              conversationId={id}
              onToggleReaction={handleToggleReaction}
              onEditMessage={handleEditMessage}
              onDeleteMessage={handleDeleteMessage}
              onPinMessage={handlePinMessage}
              onMarkUnread={markConversationUnread}
              hasMoreOlder={hasMoreMessages}
              loadingOlder={loadingOlder}
              onLoadOlder={() => void loadOlderMessages()}
              scrollToMessageId={scrollToMessageId}
              highlightMessageId={highlightMessageId}
              onScrollComplete={clearSearchHighlight}
              readReceiptMembersById={readReceiptMembersById}
            />
          )}
          {typingUserIds.length > 0 ? (
            <p className="shrink-0 px-4 pb-1 text-xs text-muted-foreground hidden">
              {typingUserIds.length === 1
                ? "Someone is typing…"
                : `${typingUserIds.length} people are typing…`}
            </p>
          ) : null}
          <MessageComposer
            className="shrink-0"
            recipientLabel={recipientLabel}
            conversationType={type}
            conversationId={id}
            onSend={handleSend}
          />
        </div>
        {activeThreadMessageId && (
          <ThreadPanel
            type={type}
            conversationId={id}
            messageId={activeThreadMessageId}
            channelLabel={type === "channel" ? title : undefined}
            onReplySent={() => {
              if (!activeThreadMessageId) return;
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === activeThreadMessageId
                    ? { ...m, threadCount: (m.threadCount ?? 0) + 1 }
                    : m
                )
              );
            }}
            onToggleReaction={handleToggleReaction}
            onDeleteMessage={handleDeleteMessage}
          />
        )}
        {type === "channel" && channelDetailsView && (
          <ChannelDetailsPanel channelId={id} />
        )}
        {personProfileUserId && (
          <PersonProfilePanel
            userId={personProfileUserId}
            channelId={type === "channel" ? id : undefined}
          />
        )}
        {type === "dm" &&
          dmDetailsView === "members" &&
          dmMeta?.isGroup &&
          dmMeta.participants?.length ? (
            <DmGroupMembersPanel
              dmId={id}
              title={title}
              participants={dmMeta.participants}
            />
          ) : null}
        {type === "dm" && dmDetailsView === "search" && (
          <DmSearchPanel conversationId={id} onSelect={handleDmSearchSelect} />
        )}
        {type === "dm" && dmDetailsView === "replies" && (
          <DmRepliesPanel messages={messages} />
        )}
        {type === "dm" && dmDetailsView === "settings" && (
          <DmPersonSettingsPanel
            dmId={id}
            dm={dmMeta}
            messages={messages}
            otherUserId={otherUserId}
            onMarkUnread={markConversationUnread}
          />
        )}
        {type === "channel" && <ChannelDetailsRail channelId={id} />}
        {type === "dm" && <DmDetailsRail dm={dmMeta} />}
      </div>
      {type === "channel" ? (
        <ConfirmDialog
          open={deleteChannelOpen}
          onOpenChange={setDeleteChannelOpen}
          title="Delete channel?"
          description={`#${channelName} and all of its messages will be permanently deleted. This cannot be undone.`}
          confirmLabel="Delete channel"
          loading={deletingChannel}
          onConfirm={handleDeleteChannel}
        />
      ) : null}
      <MessageQuoteToolbar />
    </div>
  );
}
