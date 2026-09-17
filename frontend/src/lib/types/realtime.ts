import type { PresenceStatus } from "@/stores/profile-store";

export type ChatRealtimePayload = {
  workspaceId: string;
  kind: "channel" | "dm";
  conversationId: string;
  message: import("@/lib/types/chat").ChatMessage;
  parentId?: string | null;
};

export type ChatMessageEditPayload = ChatRealtimePayload;

export type ChatMessageDeletePayload = {
  workspaceId: string;
  kind: "channel" | "dm";
  conversationId: string;
  messageId: string;
  parentId?: string | null;
};

export type ChatReactionPayload = {
  workspaceId: string;
  messageId: string;
  reactions: { emoji: string; count: number }[];
};

export type ChatChannelJoinedPayload = {
  workspaceId: string;
  userIds: string[];
  channel: import("@/lib/types/chat").Channel;
};

export type ChatDmJoinedPayload = {
  workspaceId: string;
  userIds: string[];
  conversationId: string;
};

export type ChatChannelRemovedPayload = {
  workspaceId: string;
  userIds: string[];
  channelId: string;
};

export type ChatChannelMemberPayload = {
  workspaceId: string;
  channelId: string;
  member: import("@/lib/types/chat").ChannelMember;
  removed?: boolean;
};

export type ChatChannelRenamedPayload = {
  workspaceId: string;
  channelId: string;
  name: string;
};

export type ChatChannelPrivacyPayload = {
  workspaceId: string;
  channelId: string;
  isPrivate: boolean;
};

export type ChatChannelCanvasPayload = {
  workspaceId: string;
  channelId: string;
  canvas: import("@/lib/types/chat").ChannelCanvas;
};

export type ChatChannelHuddlePayload = {
  workspaceId: string;
  channelId: string;
  huddle: import("@/lib/types/chat").ChannelHuddle;
};

export type { HomeNotificationPayload } from "@/lib/notifications/realtime";

export type PresenceSyncPayload = {
  workspaceId: string;
  users: { userId: string; status: PresenceStatus }[];
};

export type PresenceUpdatePayload = {
  workspaceId: string;
  userId: string;
  status: PresenceStatus;
};

export type ChatTypingPayload = {
  workspaceId: string;
  kind: "channel" | "dm";
  conversationId: string;
  userId: string;
  typing: boolean;
};

export type ChatReadPayload = {
  workspaceId: string;
  kind: "channel" | "dm";
  conversationId: string;
  userId: string;
  readAt: string;
};

export type { TaskRealtimePayload } from "@/lib/tasks/realtime";

export type WorkspaceMemberRolePayload = {
  workspaceId: string;
  userId: string;
  role: string;
};

export type WorkspaceStatusPayload = {
  workspaceId: string;
};


export type WorkspaceMemberSuspendedPayload = {
  workspaceId: string;
  userId: string;
};

export type WorkspaceMemberReactivatedPayload = {
  workspaceId: string;
  userId: string;
};

export type AccountDisabledPayload = {
  userId: string;
};

export type ResourceAccessChangedPayload = {
  workspaceId: string;
  userIds: string[];
  resourceType: "space" | "folder" | "list";
  resourceId: string;
};

export type WorkspaceMemberRemovedPayload = {
  workspaceId: string;
  userId: string;
};

export type WorkspaceMemberJoinedPayload = {
  workspaceId: string;
  userId: string;
  role: string;
  user?: {
    id: string;
    email?: string;
    fullName?: string;
    avatarUrl?: string | null;
  };
};
