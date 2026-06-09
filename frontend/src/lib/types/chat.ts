import type { PresenceStatus } from "@/stores/profile-store";

export type ConversationType = "channel" | "dm";

export interface Channel {
  id: string;
  name: string;
  memberCount: number;
  lastMessage: string;
  lastAt: string;
  unread: number;
  starred?: boolean;
  topic?: string;
  spaceLabel?: string;
  isPrivate?: boolean;
  isFollowing?: boolean;
  customIconColor?: string;
}

export interface DirectMessage {
  id: string;
  name: string;
  isGroup: boolean;
  members?: string[];
  avatarUrl?: string;
  lastMessage: string;
  lastAt: string;
  unread: number;
  presence?: PresenceStatus;
  starred?: boolean;
  otherUserId?: string;
}

export type AttachmentKind = "file" | "video" | "clip" | "doc" | "audio";

export interface MessageAttachment {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  kind: AttachmentKind;
  downloadUrl?: string | null;
}

export interface ChatMessage {
  id: string;
  authorId: string;
  authorName: string;
  body: string;
  createdAt: string;
  isSelf?: boolean;
  reactions?: { emoji: string; count: number }[];
  threadCount?: number;
  attachments?: MessageAttachment[];
}

export type OptimisticAttachment = Pick<
  MessageAttachment,
  "id" | "fileName" | "kind" | "mimeType" | "sizeBytes"
>;

export type SendMessagePayload = {
  body: string;
  attachmentIds?: string[];
  /** Composer preview rows — shown on the optimistic message until REST/socket confirm. */
  optimisticAttachments?: OptimisticAttachment[];
};

export interface ChatSearchHit extends ChatMessage {
  parentId?: string;
  inThread?: boolean;
}

export interface ThreadBundle {
  parent: ChatMessage;
  replies: ChatMessage[];
  hasNew: boolean;
}

export interface WorkspaceMemberOption {
  id: string;
  fullName: string;
  email: string;
  avatarUrl?: string | null;
  role?: string;
}

export interface ChannelMember {
  id: string;
  fullName: string;
  email: string;
  avatarUrl?: string | null;
  isFollowing: boolean;
  starred: boolean;
  joinedAt: string | null;
  workspaceRole?: string | null;
}
