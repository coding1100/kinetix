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

  it("shows unread while active conversation is still loading", () => {
    expect(resolveSidebarUnread("channel", "ch-1", 1, true, null, now)).toBe(1);
  });

  it("keeps hold count visible until expiry", () => {
    expect(resolveSidebarUnread("channel", "ch-1", 0, true, hold, now)).toBe(3);
  });

  it("hides badge after hold expires", () => {
    expect(
      resolveSidebarUnread(
        "channel",
        "ch-1",
        0,
        true,
        hold,
        now + UNREAD_BADGE_HIDE_DELAY_MS
      )
    ).toBe(0);
  });

  it("ignores hold for a different conversation", () => {
    expect(resolveSidebarUnread("channel", "ch-2", 2, true, hold, now)).toBe(2);
  });
});
