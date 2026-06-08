import type { PresenceStatus } from "@/stores/profile-store";

export type ChatRealtimePayload = {
  workspaceId: string;
  kind: "channel" | "dm";
  conversationId: string;
  message: import("@/lib/types/chat").ChatMessage;
  parentId?: string | null;
};

export type ChatMessageEditPayload = ChatRealtimePayload;

export type ChatReactionPayload = {
  workspaceId: string;
  messageId: string;
  reactions: { emoji: string; count: number }[];
};

export type PresenceSyncPayload = {
  workspaceId: string;
  users: { userId: string; status: PresenceStatus }[];
};

export type PresenceUpdatePayload = {
  workspaceId: string;
  userId: string;
  status: PresenceStatus;
};
