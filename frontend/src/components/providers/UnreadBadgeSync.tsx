"use client";

import { useEffect, useMemo } from "react";
import { useNotificationsUnread } from "@/hooks/use-notifications-unread";
import { useChatStore } from "@/stores/chat-store";
import { updateAppUnreadBadge } from "@/lib/notifications/badge";

export function UnreadBadgeSync() {
  const { unreadCount: notificationUnread } = useNotificationsUnread();
  const sidebarCache = useChatStore((s) => s.sidebarListsCache);

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

  useEffect(() => {
    updateAppUnreadBadge(totalUnread);
  }, [totalUnread]);

  return null;
}
