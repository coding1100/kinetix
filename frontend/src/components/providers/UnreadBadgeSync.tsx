"use client";

import { useEffect, useMemo, useRef } from "react";
import { usePathname } from "next/navigation";
import { useNotificationsUnread } from "@/hooks/use-notifications-unread";
import { useChatStore } from "@/stores/chat-store";
import { updateAppUnreadBadge } from "@/lib/notifications/badge";

export function UnreadBadgeSync() {
  const pathname = usePathname();
  const { unreadCount: notificationUnread } = useNotificationsUnread();
  const sidebarCache = useChatStore((s) => s.sidebarListsCache);
  const realtimeEvent = useChatStore((s) => s.realtimeEvent);
  const totalUnreadRef = useRef(0);

  const chatUnread = useMemo(() => {
    if (!sidebarCache) return 0;
    const channelsUnread = (sidebarCache.channels ?? []).reduce(
      (sum, c) => sum + (c.unread ?? 0),
      0
    );
    const dmsUnread = (sidebarCache.dms ?? []).reduce(
      (sum, d) => sum + (d.unread ?? 0),
      0
    );
    return channelsUnread + dmsUnread;
  }, [sidebarCache]);

  const totalUnread = notificationUnread + chatUnread;
  totalUnreadRef.current = totalUnread;

  // Re-apply badge on count change, route navigation (pathname), or socket realtime events
  useEffect(() => {
    updateAppUnreadBadge(totalUnread);
  }, [totalUnread, pathname, realtimeEvent]);

  // MutationObserver on <title> element: prevents Next.js route transitions from wiping (N) Kinetix from taskbar
  useEffect(() => {
    if (typeof document === "undefined") return;

    let titleEl = document.querySelector("title");
    if (!titleEl) {
      titleEl = document.createElement("title");
      document.head.appendChild(titleEl);
    }

    const observer = new MutationObserver(() => {
      if (totalUnreadRef.current > 0 && !document.title.startsWith(`(${totalUnreadRef.current})`)) {
        updateAppUnreadBadge(totalUnreadRef.current);
      }
    });

    observer.observe(titleEl, { childList: true, characterData: true, subtree: true });

    return () => observer.disconnect();
  }, []);

  return null;
}
