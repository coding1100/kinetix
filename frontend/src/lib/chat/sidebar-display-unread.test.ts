import { describe, expect, it } from "vitest";
import {
  resolveSidebarUnread,
  UNREAD_BADGE_HIDE_DELAY_MS,
} from "./sidebar-display-unread";

describe("resolveSidebarUnread", () => {
  const now = 1_000_000;
  const hold = {
    kind: "channel" as const,
    id: "ch-1",
    count: 3,
    expiresAt: now + UNREAD_BADGE_HIDE_DELAY_MS,
  };

  it("shows stored unread for inactive conversations", () => {
    expect(resolveSidebarUnread("channel", "ch-1", 5, false, hold, now)).toBe(5);
  });

  it("instantly clears unread when conversation is active", () => {
    expect(resolveSidebarUnread("channel", "ch-1", 7, true, null, now)).toBe(0);
    expect(resolveSidebarUnread("channel", "ch-1", 7, true, hold, now)).toBe(0);
  });

  it("returns unread for inactive conversation even if hold is present", () => {
    expect(resolveSidebarUnread("channel", "ch-2", 4, false, hold, now)).toBe(4);
  });
});
