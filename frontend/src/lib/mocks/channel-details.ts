import type { ChatMessage } from "@/lib/mocks/chat";
import { getMessagesForConversation, MOCK_CHANNELS } from "@/lib/mocks/chat";

export interface ChannelFollower {
  id: string;
  name: string;
  role: "admin" | "member" | "guest";
  online?: boolean;
}

export interface ChannelThreadReply {
  id: string;
  messageId: string;
  channelId: string;
  authorName: string;
  preview: string;
  replyCount: number;
  unread: boolean;
  lastAt: Date;
}

export interface ChannelAssignedMessage {
  id: string;
  channelId: string;
  body: string;
  assignedBy: string;
  due?: string;
  resolved: boolean;
  messageId: string;
}

export interface ChannelMeta {
  topic?: string;
  description?: string;
  following: boolean;
  notifications: "all" | "mentions" | "none";
  isPrivate?: boolean;
}

export interface ChannelAccessUser {
  id: string;
  name: string;
  role: "admin" | "member" | "guest";
  permission: "view" | "comment" | "edit" | "full";
  source: "inherited" | "direct";
}

export interface ChannelFilePreview {
  id: string;
  channelId: string;
  name: string;
  kind: "image" | "doc" | "attachment";
}

const FOLLOWERS_BY_CHANNEL: Record<string, ChannelFollower[]> = {
  c1: [
    { id: "u1", name: "You", role: "admin", online: true },
    { id: "u2", name: "Alex Rivera", role: "admin", online: true },
    { id: "u3", name: "Sam Chen", role: "member", online: false },
    { id: "u4", name: "Jordan Lee", role: "member", online: true },
    { id: "u5", name: "Morgan Blake", role: "member" },
    { id: "u6", name: "Taylor Kim", role: "guest" },
  ],
  c2: [
    { id: "u1", name: "You", role: "member", online: true },
    { id: "u2", name: "Alex Rivera", role: "admin", online: true },
    { id: "u3", name: "Sam Chen", role: "member" },
  ],
};

const DEFAULT_FOLLOWERS: ChannelFollower[] = [
  { id: "u1", name: "You", role: "member", online: true },
  { id: "u2", name: "Alex Rivera", role: "admin" },
  { id: "u3", name: "Sam Chen", role: "member" },
];

const ACCESS_BY_CHANNEL: Record<string, ChannelAccessUser[]> = {
  c1: [
    { id: "u1", name: "You", role: "admin", permission: "full", source: "direct" },
    { id: "u2", name: "Alex Rivera", role: "admin", permission: "full", source: "direct" },
    { id: "u3", name: "Sam Chen", role: "member", permission: "edit", source: "inherited" },
    { id: "u4", name: "Jordan Lee", role: "member", permission: "comment", source: "inherited" },
    { id: "u5", name: "Morgan Blake", role: "member", permission: "view", source: "inherited" },
    { id: "u6", name: "Taylor Kim", role: "guest", permission: "view", source: "direct" },
  ],
  c2: [
    { id: "u1", name: "You", role: "member", permission: "edit", source: "direct" },
    { id: "u2", name: "Alex Rivera", role: "admin", permission: "full", source: "direct" },
    { id: "u3", name: "Sam Chen", role: "member", permission: "comment", source: "inherited" },
  ],
};

const DEFAULT_ACCESS_USERS: ChannelAccessUser[] = [
  { id: "u1", name: "You", role: "member", permission: "edit", source: "direct" },
  { id: "u2", name: "Alex Rivera", role: "admin", permission: "full", source: "direct" },
  { id: "u3", name: "Sam Chen", role: "member", permission: "view", source: "inherited" },
];

const FILES_BY_CHANNEL: Record<string, ChannelFilePreview[]> = {
  c1: [
    { id: "f1", channelId: "c1", name: "Retro notes", kind: "doc" },
    { id: "f2", channelId: "c1", name: "UI sketch", kind: "image" },
    { id: "f3", channelId: "c1", name: "Release checklist", kind: "doc" },
    { id: "f4", channelId: "c1", name: "Design exports", kind: "attachment" },
    { id: "f5", channelId: "c1", name: "Roadmap slide", kind: "image" },
  ],
  c2: [
    { id: "f6", channelId: "c2", name: "Sprint plan", kind: "doc" },
    { id: "f7", channelId: "c2", name: "User flow", kind: "image" },
    { id: "f8", channelId: "c2", name: "API sheet", kind: "attachment" },
  ],
};

const DEFAULT_FILES: ChannelFilePreview[] = [
  { id: "f9", channelId: "default", name: "Brief", kind: "doc" },
  { id: "f10", channelId: "default", name: "Assets", kind: "attachment" },
  { id: "f11", channelId: "default", name: "Spec image", kind: "image" },
];

const THREAD_REPLIES: ChannelThreadReply[] = [
  {
    id: "tr1",
    messageId: "m4",
    channelId: "c1",
    authorName: "Jordan Lee",
    preview: "I'll add the DM details sidebar tabs today.",
    replyCount: 2,
    unread: true,
    lastAt: new Date(Date.now() - 1000 * 60 * 30),
  },
  {
    id: "tr2",
    messageId: "m2",
    channelId: "c1",
    authorName: "Sam Chen",
    preview: "Pushed the latest mock data for home screens.",
    replyCount: 4,
    unread: false,
    lastAt: new Date(Date.now() - 1000 * 60 * 60 * 2),
  },
  {
    id: "tr3",
    messageId: "m4",
    channelId: "c2",
    authorName: "Alex Rivera",
    preview: "Sidebar spec — can we align with Kinetix rail?",
    replyCount: 1,
    unread: true,
    lastAt: new Date(Date.now() - 1000 * 60 * 20),
  },
];

const ASSIGNED_MESSAGES: ChannelAssignedMessage[] = [
  {
    id: "am1",
    channelId: "c1",
    body: "@you please confirm deploy window for Friday",
    assignedBy: "Alex Rivera",
    due: "Today",
    resolved: false,
    messageId: "m5",
  },
  {
    id: "am2",
    channelId: "c1",
    body: "Review thread summary before standup",
    assignedBy: "Jordan Lee",
    due: "Tomorrow",
    resolved: false,
    messageId: "m4",
  },
  {
    id: "am3",
    channelId: "c2",
    body: "Finalize Gantt mockup feedback",
    assignedBy: "Sam Chen",
    resolved: true,
    messageId: "m3",
  },
];

const META_BY_CHANNEL: Record<string, ChannelMeta> = {
  c1: {
    topic: "Team-wide announcements and daily updates",
    description: "Default channel for the workspace. Keep messages concise.",
    following: true,
    notifications: "all",
  },
  c2: {
    topic: "Product planning and specs",
    following: true,
    notifications: "mentions",
  },
  c5: {
    topic: "Company-wide announcements",
    description: "Read-only for most members.",
    following: true,
    notifications: "all",
    isPrivate: false,
  },
};

export function getChannelById(channelId: string) {
  return MOCK_CHANNELS.find((c) => c.id === channelId);
}

export function getChannelFollowers(channelId: string): ChannelFollower[] {
  return FOLLOWERS_BY_CHANNEL[channelId] ?? DEFAULT_FOLLOWERS;
}

export function getChannelAccessUsers(channelId: string): ChannelAccessUser[] {
  return ACCESS_BY_CHANNEL[channelId] ?? DEFAULT_ACCESS_USERS;
}

export function getChannelFilesPreview(channelId: string): ChannelFilePreview[] {
  return FILES_BY_CHANNEL[channelId] ?? DEFAULT_FILES;
}

const VISIBLE_FOLLOWER_AVATARS = 3;

/** Stacked avatars on channel rail: preview faces + total member count badge. */
export function getChannelFollowerStack(channelId: string) {
  const followers = getChannelFollowers(channelId);
  const channel = getChannelById(channelId);
  const totalWithAccess = channel?.memberCount ?? followers.length;
  const preview = followers.slice(0, VISIBLE_FOLLOWER_AVATARS);
  const showTotalBadge = totalWithAccess > preview.length;
  return { preview, showTotalBadge, totalWithAccess };
}

export function getChannelThreadReplies(channelId: string): ChannelThreadReply[] {
  return THREAD_REPLIES.filter((t) => t.channelId === channelId).sort(
    (a, b) => b.lastAt.getTime() - a.lastAt.getTime()
  );
}

export function getChannelAssignedMessages(
  channelId: string
): ChannelAssignedMessage[] {
  return ASSIGNED_MESSAGES.filter((a) => a.channelId === channelId);
}

export function getChannelMeta(channelId: string): ChannelMeta {
  return (
    META_BY_CHANNEL[channelId] ?? {
      following: true,
      notifications: "mentions",
    }
  );
}

export function searchChannelMessages(
  channelId: string,
  query: string
): ChatMessage[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return getMessagesForConversation("channel", channelId).filter(
    (m) =>
      m.body.toLowerCase().includes(q) ||
      m.authorName.toLowerCase().includes(q)
  );
}
