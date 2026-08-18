"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  const [error, setError] = useState<unknown>(null);
  const [liveTick, setLiveTick] = useState(0);
  const requestIdRef = useRef(0);
  const inFlightRef = useRef<{ key: string; promise: Promise<void> } | null>(null);

  const load = useCallback(async () => {
    if (!accessToken || !workspaceId) return;
    const key = `${accessToken}:${workspaceId}`;
    if (inFlightRef.current?.key === key) return inFlightRef.current.promise;

    const requestId = ++requestIdRef.current;
    const promise = (async () => {
      try {
        const res = await fetchNotifications(accessToken, workspaceId);
        // A slower response from an older workspace/request must never replace
        // the latest live state.
        if (requestId !== requestIdRef.current) return;
        setError(null);
        reconcileReadStateFromApi(res.data, res.unreadCount);
        setApiItems(res.data);
        setApiUnreadCount(res.unreadCount);
      } catch (err) {
        if (requestId === requestIdRef.current) setError(err);
      } finally {
        if (
          requestId === requestIdRef.current &&
          inFlightRef.current?.key === key
        ) {
          inFlightRef.current = null;
        }
      }
    })();
    inFlightRef.current = { key, promise };
    return promise;
  }, [accessToken, workspaceId]);

  useEffect(() => {
    requestIdRef.current += 1;
    inFlightRef.current = null;
    setApiItems([]);
    setApiUnreadCount(0);
    setError(null);
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

  return { unreadCount, items, error, reload: load };
}
