export interface InboxItem {
  id: string;
  type: "comment" | "mention" | "assignment" | "chat" | "reminder";
  title: string;
  preview: string;
  source: string;
  createdAt: Date;
  unread: boolean;
  group: "today" | "earlier";
}

export const MOCK_INBOX: InboxItem[] = [
  {
    id: "i1",
    type: "mention",
    title: "Alex mentioned you in #product",
    preview: "@you can you review the sidebar spec?",
    source: "product",
    createdAt: new Date(Date.now() - 1000 * 60 * 20),
    unread: true,
    group: "today",
  },
  {
    id: "i2",
    type: "assignment",
    title: "Task assigned to you",
    preview: "Finalize Home screen registry",
    source: "Engineering · Sprint 12",
    createdAt: new Date(Date.now() - 1000 * 60 * 90),
    unread: true,
    group: "today",
  },
  {
    id: "i3",
    type: "comment",
    title: "New comment on API spec",
    preview: "Jordan: Updated the auth flow diagram",
    source: "Docs · API Spec",
    createdAt: new Date(Date.now() - 1000 * 60 * 180),
    unread: false,
    group: "today",
  },
  {
    id: "i4",
    type: "chat",
    title: "Unread in #general",
    preview: "Shipped the inbox redesign",
    source: "general",
    createdAt: new Date(Date.now() - 1000 * 60 * 300),
    unread: true,
    group: "today",
  },
  {
    id: "i5",
    type: "reminder",
    title: "Reminder: Standup prep",
    preview: "Due today at 9:00 AM",
    source: "Personal",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 26),
    unread: false,
    group: "earlier",
  },
  {
    id: "i6",
    type: "comment",
    title: "Resolved thread on Design tokens",
    preview: "Sam marked the thread as resolved",
    source: "Design",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 48),
    unread: false,
    group: "earlier",
  },
];

export const MOCK_LATER: InboxItem[] = [
  {
    id: "l1",
    type: "chat",
    title: "Saved message from Alex",
    preview: "Let's revisit notifications in Phase 5",
    source: "DM · Alex Rivera",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2),
    unread: false,
    group: "today",
  },
  {
    id: "l2",
    type: "reminder",
    title: "Follow up on integration spike",
    preview: "Snoozed until tomorrow",
    source: "Tasks",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 5),
    unread: false,
    group: "today",
  },
];

export const MOCK_REPLIES = [
  {
    id: "rp1",
    channel: "product",
    preview: "Replying to your thread on sidebar spec",
    unread: true,
    href: "/chat/c/c2",
  },
  {
    id: "rp2",
    channel: "general",
    preview: "New reply from Sam on deploy thread",
    unread: false,
    href: "/chat/c/c1",
  },
];

export const MOCK_ASSIGNED_COMMENTS = [
  {
    id: "ac1",
    task: "API Spec",
    comment: "Please verify OAuth redirect URLs",
    author: "Jordan",
    due: "Today",
  },
  {
    id: "ac2",
    task: "Design tokens",
    comment: "Contrast check on sidebar hover",
    author: "Sam",
    due: "Yesterday",
  },
];

export const MOCK_CHAT_ACTIVITY = [
  {
    id: "ca1",
    kind: "mention" as const,
    text: "Alex mentioned you in #product",
    time: "20m",
    href: "/chat/c/c2",
  },
  {
    id: "ca2",
    kind: "reaction" as const,
    text: "Sam reacted to your message in #general",
    time: "1h",
    href: "/chat/c/c1",
  },
  {
    id: "ca3",
    kind: "assigned" as const,
    text: "Message assigned to you in Launch Squad",
    time: "3h",
    href: "/chat/dm/d4",
  },
];

export const MOCK_DRAFTS = [
  {
    id: "dr1",
    target: "#engineering",
    preview: "Draft: deployment checklist for Friday...",
    type: "draft" as const,
  },
  {
    id: "dr2",
    target: "Alex Rivera",
    preview: "Draft: thanks for the review...",
    type: "draft" as const,
  },
];

export const MOCK_SENT = [
  {
    id: "sn1",
    target: "#general",
    preview: "Shipped the inbox redesign",
    type: "sent" as const,
    at: "12m ago",
  },
];

export const MOCK_SCHEDULED = [
  {
    id: "sc1",
    target: "#announcements",
    preview: "Scheduled: Q2 kickoff reminder",
    type: "scheduled" as const,
    at: "Tomorrow 9:00 AM",
  },
];
