import { describe, expect, it } from "vitest";
import {
  ATTACHMENT_PLACEHOLDER,
  canEditMessageContent,
  createOptimisticMessage,
  mergeConfirmedMessage,
  normalizeEditableMessageBody,
  upsertChatMessage,
} from "./messages";
import type { ChatMessage } from "@/lib/types/chat";

const USER = "user-1";

function confirmed(
  id: string,
  body: string,
  attachments?: ChatMessage["attachments"]
): ChatMessage {
  return {
    id,
    authorId: USER,
    authorName: "You",
    body,
    createdAt: "2026-06-09T12:00:00.000Z",
    isSelf: true,
    reactions: [],
    threadCount: 0,
    attachments,
  };
}

describe("message edit helpers", () => {
  it("treats attachment placeholder as empty editable body", () => {
    expect(normalizeEditableMessageBody(ATTACHMENT_PLACEHOLDER)).toBe("");
    expect(normalizeEditableMessageBody("  ")).toBe("");
    expect(normalizeEditableMessageBody("hello")).toBe("hello");
  });

  it("allows editing attachment-only messages", () => {
    const imageOnly = confirmed("msg-1", "", [
      {
        id: "att-1",
        fileName: "photo.png",
        kind: "file",
        mimeType: "image/png",
        sizeBytes: 100,
      },
    ]);
    expect(canEditMessageContent(imageOnly)).toBe(true);
    expect(canEditMessageContent(confirmed("msg-2", ""))).toBe(false);
  });
});

describe("upsertChatMessage", () => {
  it("replaces pending row when attachment body differs from server", () => {
    const pending = createOptimisticMessage(ATTACHMENT_PLACEHOLDER, USER, [
      {
        id: "att-1",
        fileName: "photo.png",
        kind: "file",
        mimeType: "image/png",
        sizeBytes: 100,
      },
    ]);
    const incoming = confirmed("msg-1", "", [
      {
        id: "att-1",
        fileName: "photo.png",
        kind: "file",
        mimeType: "image/png",
        sizeBytes: 100,
        downloadUrl: "/files/photo.png",
      },
    ]);

    const next = upsertChatMessage([pending], incoming);
    expect(next).toHaveLength(1);
    expect(next[0].id).toBe("msg-1");
    expect(next[0].attachments).toHaveLength(1);
  });

  it("dedupes when socket arrives before REST merge", () => {
    const pending = createOptimisticMessage("hello", USER);
    const incoming = confirmed("msg-1", "hello");

    const afterSocket = upsertChatMessage([pending], incoming);
    const afterRest = mergeConfirmedMessage(afterSocket, pending.id, incoming);

    expect(afterRest).toHaveLength(1);
    expect(afterRest[0].id).toBe("msg-1");
  });
});
