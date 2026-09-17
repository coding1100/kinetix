import { describe, expect, it, beforeEach, vi } from "vitest";
import type { NotificationDto } from "@/lib/api/home";
import {
  clearLiveNotifications,
  countUnreadNotifications,
  ingestLiveNotification,
  markAllNotificationsReadLocal,
  mergeNotifications,
} from "@/lib/notifications/live-cache";

function notification(
  id: string,
  createdAt: string,
  unread = true
): NotificationDto {
  return {
    id,
    type: "mention",
    title: `Notification ${id}`,
    preview: "Preview",
    source: "Source",
    createdAt,
    unread,
    href: "/home/inbox",
  };
}

describe("notification live cache", () => {
  beforeEach(() => {
    clearLiveNotifications();
    vi.useRealTimers();
  });

  it("does not mark notifications created after a bulk clear as read", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-17T10:00:00.000Z"));

    const older = notification("older", "2026-08-17T09:59:00.000Z");
    markAllNotificationsReadLocal([older.id]);

    vi.setSystemTime(new Date("2026-08-17T10:01:00.000Z"));
    const newer = notification("newer", "2026-08-17T10:01:00.000Z");
    ingestLiveNotification(newer);

    expect(mergeNotifications([older])).toEqual([
      expect.objectContaining({ id: "newer", unread: true }),
      expect.objectContaining({ id: "older", unread: false }),
    ]);
    expect(countUnreadNotifications([older], 1)).toBe(1);
  });

  it("counts API notifications created after a bulk clear", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-17T10:00:00.000Z"));
    markAllNotificationsReadLocal();

    const newerFromApi = notification("api-newer", "2026-08-17T10:01:00.000Z");

    expect(mergeNotifications([newerFromApi])).toEqual([
      expect.objectContaining({ id: "api-newer", unread: true }),
    ]);
    expect(countUnreadNotifications([newerFromApi], 1)).toBe(1);
  });

  it("ignores late live events created before a bulk clear", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-17T10:00:00.000Z"));
    markAllNotificationsReadLocal();

    ingestLiveNotification(
      notification("late-older", "2026-08-17T09:59:00.000Z")
    );

    expect(mergeNotifications([])).toEqual([
      expect.objectContaining({ id: "late-older", unread: false }),
    ]);
    expect(countUnreadNotifications([], 0)).toBe(0);
  });

  it("identifies notifications belonging to a conversation", async () => {
    const { isNotificationForConversation } = await import("./live-cache");
    expect(isNotificationForConversation("/chat/c/ch-123", "channel", "ch-123")).toBe(true);
    expect(isNotificationForConversation("/chat/c/ch-123?message=msg-1", "channel", "ch-123")).toBe(true);
    expect(isNotificationForConversation("/home/c/ch-123?thread=t-1", "channel", "ch-123")).toBe(true);
    expect(isNotificationForConversation("/chat/c/ch-456", "channel", "ch-123")).toBe(false);
    expect(isNotificationForConversation("/chat/dm/dm-789", "dm", "dm-789")).toBe(true);
  });

  it("marks notifications for a specific conversation as read locally", async () => {
    const { markConversationNotificationsReadLocal, countUnreadNotifications, mergeNotifications } =
      await import("./live-cache");

    const chNotif = {
      ...notification("n-1", "2026-08-17T10:00:00.000Z"),
      href: "/chat/c/ch-target?message=m1",
    };
    const otherNotif = {
      ...notification("n-2", "2026-08-17T10:00:00.000Z"),
      href: "/chat/c/ch-other?message=m2",
    };

    markConversationNotificationsReadLocal("channel", "ch-target", [chNotif, otherNotif]);

    const merged = mergeNotifications([chNotif, otherNotif]);
    expect(merged.find((n) => n.id === "n-1")?.unread).toBe(false);
    expect(merged.find((n) => n.id === "n-2")?.unread).toBe(true);
  });
});
