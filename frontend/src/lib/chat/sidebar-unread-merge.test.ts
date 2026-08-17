import { describe, expect, it } from "vitest";
import { mergeConversationUnread } from "./sidebar-unread-merge";

describe("mergeConversationUnread", () => {
  it("uses fresh API unread count when not active", () => {
    expect(mergeConversationUnread(5, 0)).toBe(5);
    expect(mergeConversationUnread(0, 25)).toBe(0);
    expect(mergeConversationUnread(3, 25)).toBe(3);
  });

  it("resets unread to 0 for the active conversation", () => {
    expect(mergeConversationUnread(5, 0, { isActive: true })).toBe(0);
    expect(mergeConversationUnread(0, 25, { isActive: true })).toBe(0);
    expect(mergeConversationUnread(2, 25, { isActive: true })).toBe(0);
  });
});
