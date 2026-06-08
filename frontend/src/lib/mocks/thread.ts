import type { ChatMessage } from "@/lib/mocks/chat";

export interface ThreadReplyMessage extends ChatMessage {
  isNew?: boolean;
}

export interface ThreadBundle {
  parent: ChatMessage;
  replies: ThreadReplyMessage[];
  hasNew: boolean;
}

const THREAD_REPLIES: Record<string, ThreadReplyMessage[]> = {
  m4: [
    {
      id: "tr-m4-1",
      authorId: "u2",
      authorName: "Alex Rivera",
      body: "Agreed — let's ship the thread panel first.",
      createdAt: new Date(Date.now() - 1000 * 60 * 35),
      reactions: [{ emoji: "👍", count: 1 }],
      isNew: true,
    },
    {
      id: "tr-m4-2",
      authorId: "u1",
      authorName: "You",
      body: "Sounds good.",
      createdAt: new Date(Date.now() - 1000 * 60 * 28),
      isSelf: true,
    },
  ],
  m2: [
    {
      id: "tr-m2-1",
      authorId: "u4",
      authorName: "Jordan Lee",
      body: "Sidebar spec looks aligned with Kinetix.",
      createdAt: new Date(Date.now() - 1000 * 60 * 60),
      reactions: [{ emoji: "👍", count: 1 }],
    },
    {
      id: "tr-m2-2",
      authorId: "u1",
      authorName: "You",
      body: "Will add the rail icons today.",
      createdAt: new Date(Date.now() - 1000 * 60 * 45),
      isSelf: true,
    },
    {
      id: "tr-m2-3",
      authorId: "u2",
      authorName: "Alex Rivera",
      body: "@You sounds good.",
      createdAt: new Date(Date.now() - 1000 * 60 * 30),
    },
  ],
};

export function formatThreadMessageTime(date: Date): string {
  const datePart = date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
  const timePart = date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  return `${datePart} at ${timePart}`;
}

export function getThreadTitle(authorName: string): string {
  const first = authorName.split(" ")[0] || authorName;
  const possessive =
    first.endsWith("s") || first.endsWith("S") ? `${first}'` : `${first}'s`;
  return `${possessive} Thread`;
}

export function getThreadBundle(
  messageId: string,
  messages: ChatMessage[]
): ThreadBundle | null {
  const parent = messages.find((m) => m.id === messageId);
  if (!parent) return null;

  const replies = THREAD_REPLIES[messageId] ?? [];
  const hasNew = replies.some((r) => r.isNew);

  return { parent, replies, hasNew };
}
