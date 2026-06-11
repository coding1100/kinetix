import { describe, expect, it } from "vitest";
import { mergeConversationUnread } from "./sidebar-unread-merge";

describe("mergeConversationUnread", () => {
  it("keeps local zero when API refetch is stale", () => {
    expect(mergeConversationUnread(0, 25)).toBe(0);
  });

  it("allows API to lower unread", () => {
    expect(mergeConversationUnread(5, 2)).toBe(2);
  });

  it("keeps socket bump when API is behind", () => {
    expect(mergeConversationUnread(3, 25)).toBe(3);
  });

  it("uses local unread for the active conversation", () => {
    expect(mergeConversationUnread(0, 25, { isActive: true })).toBe(0);
    expect(mergeConversationUnread(2, 25, { isActive: true })).toBe(2);
  });
});
