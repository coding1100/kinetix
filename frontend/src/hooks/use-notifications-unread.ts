"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchNotifications, type NotificationDto } from "@/lib/api/home";
import {
  countUnreadNotifications,
  mergeNotifications,
  reconcileReadStateFromApi,
} from "@/lib/notifications/live-cache";
import { subscribeNotificationsRefresh } from "@/lib/notifications/realtime";
import { useWorkspaceApi } from "@/hooks/use-workspace-api";

export function useNotificationsUnread() {
  const { accessToken, workspaceId, ready } = useWorkspaceApi();
  const [apiItems, setApiItems] = useState<NotificationDto[]>([]);
  const [apiUnreadCount, setApiUnreadCount] = useState(0);
  const [liveTick, setLiveTick] = useState(0);

  const load = useCallback(async () => {
    if (!accessToken || !workspaceId) return;
    try {
      const res = await fetchNotifications(accessToken, workspaceId);
      reconcileReadStateFromApi(res.data, res.unreadCount);
      setApiItems(res.data);
      setApiUnreadCount(res.unreadCount);
    } catch {
      setApiItems([]);
      setApiUnreadCount(0);
    }
  }, [accessToken, workspaceId]);

  useEffect(() => {
    if (ready) void load();
  }, [ready, load]);

  useEffect(
    () =>
      subscribeNotificationsRefresh(() => {
        setLiveTick((t) => t + 1);
        void load();
      }),
    [load]
  );

  const items = useMemo(
    () => mergeNotifications(apiItems),
    [apiItems, liveTick]
  );

  const unreadCount = useMemo(
    () => countUnreadNotifications(apiItems, apiUnreadCount),
    [apiItems, apiUnreadCount, liveTick]
  );

  return { unreadCount, items, reload: load };
}
