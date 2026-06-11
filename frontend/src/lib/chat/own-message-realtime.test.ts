import { describe, expect, it } from "vitest";
import {
  createOptimisticMessage,
  mergeIncomingMessage,
  upsertChatMessage,
} from "./messages";
import type { ChatMessage } from "@/lib/types/chat";

const USER = "user-1";

function shouldAppendRealtimeOwnMessage(
  prev: ChatMessage[],
  incoming: ChatMessage,
  currentUserId: string
): boolean {
  if (incoming.authorId !== currentUserId) return true;
  if (prev.some((m) => m.id === incoming.id)) return false;
  return prev.some(
    (m) => m.id.startsWith("pending-") && m.authorId === currentUserId
  );
}

function applyRealtimeMessage(
  prev: ChatMessage[],
  incoming: ChatMessage,
  currentUserId: string
): ChatMessage[] {
  if (!shouldAppendRealtimeOwnMessage(prev, incoming, currentUserId)) {
    return prev;
  }
  return mergeIncomingMessage(prev, incoming);
}

describe("own message realtime ingest", () => {
  it("ignores duplicate socket echo after REST confirm", () => {
    const confirmed: ChatMessage = {
      id: "msg-1",
      authorId: USER,
      authorName: "You",
      body: "hello",
      createdAt: "2026-06-09T12:00:00.000Z",
      isSelf: true,
      reactions: [],
      threadCount: 0,
    };
    const next = applyRealtimeMessage([confirmed], confirmed, USER);
    expect(next).toHaveLength(1);
  });

  it("replaces pending row when socket arrives before REST", () => {
    const pending = createOptimisticMessage("hello", USER);
    const confirmed: ChatMessage = {
      id: "msg-1",
      authorId: USER,
      authorName: "You",
      body: "hello",
      createdAt: "2026-06-09T12:00:00.000Z",
      isSelf: true,
      reactions: [],
      threadCount: 0,
    };
    const next = applyRealtimeMessage([pending], confirmed, USER);
    expect(next).toHaveLength(1);
    expect(next[0].id).toBe("msg-1");
  });

  it("does not add a third copy after REST and socket", () => {
    const pending = createOptimisticMessage("hello", USER);
    const confirmed: ChatMessage = {
      id: "msg-1",
      authorId: USER,
      authorName: "You",
      body: "hello",
      createdAt: "2026-06-09T12:00:00.000Z",
      isSelf: true,
      reactions: [],
      threadCount: 0,
    };
    const afterSocket = applyRealtimeMessage([pending], confirmed, USER);
    const afterRest = upsertChatMessage(afterSocket, confirmed);
    const afterSocketAgain = applyRealtimeMessage(afterRest, confirmed, USER);
    expect(afterSocketAgain).toHaveLength(1);
    expect(afterSocketAgain[0].id).toBe("msg-1");
  });
});
