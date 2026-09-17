"use client";

import { useEffect, useMemo, useRef } from "react";
import { usePathname } from "next/navigation";
import { useNotificationsUnread } from "@/hooks/use-notifications-unread";
import { useChatStore } from "@/stores/chat-store";
import { updateAppUnreadBadge } from "@/lib/notifications/badge";
import { isNotificationForConversation } from "@/lib/notifications/live-cache";

function getActiveConversation(
  pathname: string | null,
  activeFromStore: { kind: "channel" | "dm"; id: string } | null
): { channelId: string | null; dmId: string | null } {
  let channelId = activeFromStore?.kind === "channel" ? activeFromStore.id : null;
  let dmId = activeFromStore?.kind === "dm" ? activeFromStore.id : null;

  if (pathname) {
    const channelMatch = pathname.match(/\/(?:chat|home)\/c\/([^/?#]+)/);
    if (channelMatch) channelId = channelMatch[1];
    const dmMatch = pathname.match(/\/(?:chat|home)\/dm\/([^/?#]+)/);
    if (dmMatch) dmId = dmMatch[1];
  }

  return { channelId, dmId };
}

export function UnreadBadgeSync() {
  const pathname = usePathname();
  const { unreadCount: notificationUnread, items: notificationItems } =
    useNotificationsUnread();
  const sidebarCache = useChatStore((s) => s.sidebarListsCache);
  const activeConversation = useChatStore((s) => s.activeConversation);
  const realtimeEvent = useChatStore((s) => s.realtimeEvent);
  const totalUnreadRef = useRef(0);

  const { channelId: activeChannelId, dmId: activeDmId } = useMemo(
    () => getActiveConversation(pathname, activeConversation),
    [pathname, activeConversation]
  );

  const chatUnread = useMemo(() => {
    if (!sidebarCache) return 0;
    const channelsUnread = (sidebarCache.channels ?? []).reduce(
      (sum, c) => sum + (c.id === activeChannelId ? 0 : (c.unread ?? 0)),
      0
    );
    const dmsUnread = (sidebarCache.dms ?? []).reduce(
      (sum, d) => sum + (d.id === activeDmId ? 0 : (d.unread ?? 0)),
      0
    );
    return channelsUnread + dmsUnread;
  }, [sidebarCache, activeChannelId, activeDmId]);

  const effectiveNotificationUnread = useMemo(() => {
    if (!activeChannelId && !activeDmId) return notificationUnread;
    const kind = activeChannelId ? "channel" : "dm";
    const activeId = (activeChannelId || activeDmId)!;
    const activeConvNotifications = (notificationItems ?? []).filter(
      (item) =>
        item.unread && isNotificationForConversation(item.href, kind, activeId)
    ).length;
    return Math.max(0, notificationUnread - activeConvNotifications);
  }, [notificationUnread, notificationItems, activeChannelId, activeDmId]);

  const totalUnread = effectiveNotificationUnread + chatUnread;
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
      if (
        totalUnreadRef.current > 0 &&
        !document.title.startsWith(`(${totalUnreadRef.current})`)
      ) {
        updateAppUnreadBadge(totalUnreadRef.current);
      }
    });

    observer.observe(titleEl, {
      childList: true,
      characterData: true,
      subtree: true,
    });

    return () => observer.disconnect();
  }, []);

  return null;
}
