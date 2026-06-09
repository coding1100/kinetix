import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Channel, DirectMessage } from "@/lib/types/chat";
import {
  bumpSidebarConversationUnread,
  patchSidebarConversationUnread,
} from "@/lib/chat/sidebar-unread";
import type {
  ChatMessageEditPayload,
  ChatReactionPayload,
  ChatRealtimePayload,
} from "@/lib/types/realtime";

export type ChatSidebarLists = {
  workspaceId: string;
  channels: Channel[];
  dms: DirectMessage[];
};

const SIDEBAR_REFRESH_MS = 1200;
let sidebarRefreshTimer: ReturnType<typeof setTimeout> | undefined;

function scheduleSidebarRefresh() {
  if (sidebarRefreshTimer) clearTimeout(sidebarRefreshTimer);
  sidebarRefreshTimer = setTimeout(() => {
    useChatStore.setState((s) => ({
      sidebarRefreshKey: s.sidebarRefreshKey + 1,
    }));
    sidebarRefreshTimer = undefined;
  }, SIDEBAR_REFRESH_MS);
}

export type ChatFilter = "all" | "unread" | "dms" | "channels";
export type ChatLayout = "organized" | "recents";

export type ChannelDetailsView =
  | "followers"
  | "search"
  | "replies"
  | "settings";

export type DmDetailsView = "search" | "replies" | "settings";

export type ActiveConversation = {
  kind: "channel" | "dm";
  id: string;
};

export type PersonProfileTab =
  | "activity"
  | "tasks"
  | "comments"
  | "calendar";

interface ChatState {
  filter: ChatFilter;
  layout: ChatLayout;
  collapsed: boolean;
  sidebarRefreshKey: number;
  sidebarListsCache: ChatSidebarLists | null;
  realtimeEvent: ChatRealtimePayload | null;
  messageEditEvent: ChatMessageEditPayload | null;
  reactionEvent: ChatReactionPayload | null;
  activeThreadMessageId: string | null;
  dmDetailsView: DmDetailsView | null;
  channelDetailsView: ChannelDetailsView | null;
  personProfileUserId: string | null;
  personProfileTab: PersonProfileTab;
  channelFollowing: Record<string, boolean>;
  channelNotifications: Record<string, "all" | "mentions" | "none">;
  channelMetaOverrides: Record<
    string,
    Partial<Pick<Channel, "name" | "starred">>
  >;
  messageScrollTarget: string | null;
  activeConversation: ActiveConversation | null;
  setFilter: (f: ChatFilter) => void;
  setLayout: (l: ChatLayout) => void;
  setCollapsed: (v: boolean) => void;
  setActiveThread: (id: string | null) => void;
  setDmDetailsView: (v: DmDetailsView | null) => void;
  toggleDmDetailsView: (v: DmDetailsView) => void;
  setChannelDetailsView: (v: ChannelDetailsView | null) => void;
  toggleChannelDetailsView: (v: ChannelDetailsView) => void;
  openPersonProfile: (userId: string) => void;
  closePersonProfile: () => void;
  setPersonProfileTab: (tab: PersonProfileTab) => void;
  setChannelFollowing: (channelId: string, following: boolean) => void;
  setChannelNotifications: (
    channelId: string,
    level: "all" | "mentions" | "none"
  ) => void;
  requestMessageScroll: (messageId: string) => void;
  clearMessageScrollTarget: () => void;
  setSidebarListsCache: (cache: ChatSidebarLists) => void;
  setActiveConversation: (conversation: ActiveConversation | null) => void;
  setConversationUnread: (
    kind: "channel" | "dm",
    conversationId: string,
    unread: number
  ) => void;
  bumpConversationUnread: (
    kind: "channel" | "dm",
    conversationId: string
  ) => void;
  ingestRealtimeEvent: (event: ChatRealtimePayload) => void;
  clearRealtimeEvent: () => void;
  ingestMessageEditEvent: (event: ChatMessageEditPayload) => void;
  clearMessageEditEvent: () => void;
  ingestReactionEvent: (event: ChatReactionPayload) => void;
  clearReactionEvent: () => void;
}

export const useChatStore = create<ChatState>()(
  persist(
    (set) => ({
      filter: "all",
      layout: "organized",
      collapsed: false,
      sidebarRefreshKey: 0,
      sidebarListsCache: null,
      realtimeEvent: null,
      messageEditEvent: null,
      reactionEvent: null,
      activeThreadMessageId: null,
      dmDetailsView: null,
      channelDetailsView: null,
      personProfileUserId: null,
      personProfileTab: "activity",
      channelFollowing: {},
      channelNotifications: {},
      channelMetaOverrides: {},
      messageScrollTarget: null,
      activeConversation: null,
      setFilter: (filter) => set({ filter }),
      setLayout: (layout) => set({ layout }),
      setCollapsed: (collapsed) => set({ collapsed }),
      setActiveThread: (activeThreadMessageId) =>
        set({
          activeThreadMessageId,
          ...(activeThreadMessageId ? { personProfileUserId: null } : {}),
        }),
      setDmDetailsView: (dmDetailsView) =>
        set({
          dmDetailsView,
          ...(dmDetailsView ? { personProfileUserId: null } : {}),
        }),
      toggleDmDetailsView: (view) =>
        set((s) => ({
          dmDetailsView: s.dmDetailsView === view ? null : view,
          channelDetailsView: null,
          personProfileUserId: null,
        })),
      setChannelDetailsView: (channelDetailsView) =>
        set({
          channelDetailsView,
          dmDetailsView: null,
          ...(channelDetailsView ? { personProfileUserId: null } : {}),
        }),
      toggleChannelDetailsView: (view) =>
        set((s) => ({
          channelDetailsView: s.channelDetailsView === view ? null : view,
          dmDetailsView: null,
          personProfileUserId: null,
        })),
      openPersonProfile: (personProfileUserId) =>
        set({
          personProfileUserId,
          personProfileTab: "activity",
          activeThreadMessageId: null,
          channelDetailsView: null,
          dmDetailsView: null,
        }),
      closePersonProfile: () => set({ personProfileUserId: null }),
      setPersonProfileTab: (personProfileTab) => set({ personProfileTab }),
      setChannelFollowing: (channelId, following) =>
        set((s) => ({
          channelFollowing: { ...s.channelFollowing, [channelId]: following },
        })),
      setChannelNotifications: (channelId, level) =>
        set((s) => ({
          channelNotifications: {
            ...s.channelNotifications,
            [channelId]: level,
          },
        })),
      requestMessageScroll: (messageId) =>
        set({ messageScrollTarget: messageId }),
      clearMessageScrollTarget: () => set({ messageScrollTarget: null }),
      setSidebarListsCache: (sidebarListsCache) => set({ sidebarListsCache }),
      setActiveConversation: (activeConversation) => set({ activeConversation }),
      setConversationUnread: (kind, conversationId, unread) =>
        set((s) => {
          const workspaceId = s.sidebarListsCache?.workspaceId;
          if (!workspaceId || !s.sidebarListsCache) return s;
          return {
            sidebarListsCache: patchSidebarConversationUnread(
              s.sidebarListsCache,
              workspaceId,
              kind,
              conversationId,
              unread
            ),
          };
        }),
      bumpConversationUnread: (kind, conversationId) =>
        set((s) => {
          const workspaceId = s.sidebarListsCache?.workspaceId;
          if (!workspaceId || !s.sidebarListsCache) return s;
          return {
            sidebarListsCache: bumpSidebarConversationUnread(
              s.sidebarListsCache,
              workspaceId,
              kind,
              conversationId
            ),
          };
        }),
      ingestRealtimeEvent: (event) => {
        scheduleSidebarRefresh();
        set({ realtimeEvent: event });
      },
      clearRealtimeEvent: () => set({ realtimeEvent: null }),
      ingestMessageEditEvent: (event) => set({ messageEditEvent: event }),
      clearMessageEditEvent: () => set({ messageEditEvent: null }),
      ingestReactionEvent: (event) => set({ reactionEvent: event }),
      clearReactionEvent: () => set({ reactionEvent: null }),
    }),
    {
      name: "riseup-chat",
      partialize: (s) => ({
        layout: s.layout,
        sidebarListsCache: s.sidebarListsCache,
      }),
    }
  )
);
