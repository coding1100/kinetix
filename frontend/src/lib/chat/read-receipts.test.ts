import { describe, expect, it } from "vitest";
import { lastReadOwnMessageId } from "./read-receipts";
import type { ChatMessage } from "@/lib/types/chat";

function msg(
  id: string,
  createdAt: string,
  isSelf: boolean,
  readByUserIds?: string[]
): ChatMessage {
  return {
    id,
    authorId: isSelf ? "me" : "other",
    authorName: "User",
    body: "hi",
    createdAt,
    isSelf,
    readByUserIds,
  };
}

describe("lastReadOwnMessageId", () => {
  it("returns the latest own message that has readers", () => {
    const messages = [
      msg("a", "2026-01-01T10:00:00Z", true, ["u1"]),
      msg("b", "2026-01-01T10:01:00Z", true, ["u1"]),
      msg("c", "2026-01-01T10:02:00Z", true),
      msg("d", "2026-01-01T10:03:00Z", false, ["u1"]),
    ];
    expect(lastReadOwnMessageId(messages)).toBe("b");
  });

  it("returns null when no own read messages", () => {
    expect(lastReadOwnMessageId([msg("a", "2026-01-01T10:00:00Z", false)])).toBe(
      null
    );
  });
});
