export type ConversationType = "channel" | "dm";

export interface Channel {
  id: string;
  name: string;
  memberCount: number;
  lastMessage: string;
  lastAt: Date;
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
  participants?: { id: string; fullName: string }[];
  avatarUrl?: string;
  lastMessage: string;
  lastAt: Date;
  unread: number;
  online?: boolean;
  starred?: boolean;
}

export interface ChatMessage {
  id: string;
  authorId: string;
  authorName: string;
  body: string;
  createdAt: Date;
  isSelf?: boolean;
  reactions?: { emoji: string; count: number }[];
  threadCount?: number;
}

export const MOCK_CHANNELS: Channel[] = [
  {
    id: "c1",
    name: "general",
    memberCount: 24,
    lastMessage: "Shipped the inbox redesign",
    lastAt: new Date(Date.now() - 1000 * 60 * 60 * 3),
    unread: 3,
    starred: true,
    spaceLabel: "in Workspace",
    isFollowing: true,
  },
  {
    id: "c2",
    name: "product",
    memberCount: 10,
    lastMessage: "Can we review the Gantt view mockups?",
    lastAt: new Date(Date.now() - 1000 * 60 * 60 * 48),
    unread: 0,
    spaceLabel: "in Product Development",
    isPrivate: true,
    isFollowing: true,
  },
  {
    id: "c3",
    name: "engineering",
    memberCount: 32,
    lastMessage: "PR #442 is ready for review",
    lastAt: new Date(Date.now() - 1000 * 60 * 60 * 120),
    unread: 1,
    spaceLabel: "in Engineering",
    isPrivate: true,
    isFollowing: true,
    customIconColor: "bg-teal-600",
  },
  {
    id: "c4",
    name: "design",
    memberCount: 8,
    lastMessage: "Updated Figma tokens for 4.0",
    lastAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 14),
    unread: 0,
    spaceLabel: "in Workspace",
    topic: "Design system updates",
    isFollowing: false,
  },
  {
    id: "c5",
    name: "announcements",
    memberCount: 120,
    lastMessage: "Q2 planning kickoff Thursday 2pm",
    lastAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 180),
    unread: 0,
    starred: true,
    spaceLabel: "in Workspace",
    isFollowing: true,
  },
  {
    id: "c6",
    name: "support",
    memberCount: 15,
    lastMessage: "Ticket queue cleared for today",
    lastAt: new Date(Date.now() - 1000 * 60 * 60 * 72),
    unread: 0,
    spaceLabel: "in Customer Success",
    isFollowing: false,
  },
  {
    id: "c7",
    name: "random",
    memberCount: 42,
    lastMessage: "Friday social thread is open",
    lastAt: new Date(Date.now() - 1000 * 60 * 30),
    unread: 0,
    spaceLabel: "in Workspace",
    isFollowing: true,
  },
];

export function getChannelById(id: string, extra: Channel[] = []): Channel | undefined {
  return [...MOCK_CHANNELS, ...extra].find((c) => c.id === id);
}

export function mergeChannels(extra: Channel[]): Channel[] {
  return [...MOCK_CHANNELS, ...extra];
}

export const MOCK_DMS: DirectMessage[] = [
  {
    id: "d1",
    name: "Alex Rivera",
    isGroup: false,
    avatarUrl: "https://i.pravatar.cc/64?img=12",
    lastMessage: "Let's sync on the home sidebar",
    lastAt: new Date(Date.now() - 1000 * 60 * 8),
    unread: 2,
    online: true,
    starred: true,
  },
  {
    id: "d2",
    name: "Sam Chen",
    isGroup: false,
    avatarUrl: "https://i.pravatar.cc/64?img=32",
    lastMessage: "Thanks for the update!",
    lastAt: new Date(Date.now() - 1000 * 60 * 90),
    unread: 0,
    online: false,
  },
  {
    id: "d3",
    name: "Jordan Lee",
    isGroup: false,
    avatarUrl: "https://i.pravatar.cc/64?img=22",
    lastMessage: "Assigned you a comment on API spec",
    lastAt: new Date(Date.now() - 1000 * 60 * 200),
    unread: 1,
    online: true,
  },
  {
    id: "d4",
    name: "Alex Rivera, Sam Chen, Jordan Lee",
    isGroup: true,
    members: ["Alex", "Sam", "Jordan"],
    participants: [
      { id: "u1", fullName: "Alex Rivera" },
      { id: "u2", fullName: "Sam Chen" },
      { id: "u3", fullName: "Jordan Lee" },
    ],
    lastMessage: "Jordan: Draft post is in Kinetix",
    lastAt: new Date(Date.now() - 1000 * 60 * 30),
    unread: 4,
  },
  {
    id: "d5",
    name: "Morgan Blake",
    isGroup: false,
    avatarUrl: "https://i.pravatar.cc/64?img=52",
    lastMessage: "See you in standup",
    lastAt: new Date(Date.now() - 1000 * 60 * 1440),
    unread: 0,
  },
];

function makeMessages(channelName: string): ChatMessage[] {
  const now = Date.now();
  return [
    {
      id: "m1",
      authorId: "u2",
      authorName: "Alex Rivera",
      body: `Welcome to #${channelName}! Drop updates here.`,
      createdAt: new Date(now - 1000 * 60 * 60 * 5),
    },
    {
      id: "m2",
      authorId: "u3",
      authorName: "Sam Chen",
      body: "Pushed the latest mock data for home screens.",
      createdAt: new Date(now - 1000 * 60 * 60 * 3),
      reactions: [{ emoji: "👍", count: 2 }],
      threadCount: 4,
    },
    {
      id: "m3",
      authorId: "u1",
      authorName: "You",
      body: "Looks great — threading UI next.",
      createdAt: new Date(now - 1000 * 60 * 60 * 2),
      isSelf: true,
    },
    {
      id: "m4",
      authorId: "u4",
      authorName: "Jordan Lee",
      body: "I'll add the DM details sidebar tabs today.",
      createdAt: new Date(now - 1000 * 60 * 45),
      threadCount: 2,
    },
    {
      id: "m5",
      authorId: "u2",
      authorName: "Alex Rivera",
      body: "Shipped the inbox redesign",
      createdAt: new Date(now - 1000 * 60 * 12),
      reactions: [{ emoji: "🎉", count: 5 }],
    },
  ];
}

export function getMessagesForConversation(
  type: ConversationType,
  id: string
): ChatMessage[] {
  if (type === "channel") {
    const ch = getChannelById(id);
    return makeMessages(ch?.name ?? "channel");
  }
  const dm = MOCK_DMS.find((d) => d.id === id);
  return makeMessages(dm?.name ?? "dm");
}

export function getConversationTitle(
  type: ConversationType,
  id: string,
  extraChannels: Channel[] = []
): string {
  if (type === "channel") {
    return getChannelById(id, extraChannels)?.name ?? "Channel";
  }
  return MOCK_DMS.find((d) => d.id === id)?.name ?? "Direct message";
}

export function getDmById(id: string) {
  return MOCK_DMS.find((d) => d.id === id);
}
