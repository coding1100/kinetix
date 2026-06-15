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

export type WorkspaceMemberJoinedPayload = {
  workspaceId: string;
  member: import("@/lib/api/workspace").WorkspaceMemberRow;
  inviteEmail: string;
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
