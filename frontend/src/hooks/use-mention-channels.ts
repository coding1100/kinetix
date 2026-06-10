"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { loadSidebarLists } from "@/lib/chat/sidebar-lists-loader";
import { useWorkspaceApi } from "@/hooks/use-workspace-api";
import { useAuthStore } from "@/stores/auth-store";
import { isSidebarCacheForSession, useChatStore } from "@/stores/chat-store";

export type MentionChannel = {
  id: string;
  name: string;
};

export function useMentionChannels() {
  const { accessToken, workspaceId, ready } = useWorkspaceApi();
  const userId = useAuthStore((s) => s.user?.id);
  const sidebarListsCache = useChatStore((s) => s.sidebarListsCache);
  const [fetched, setFetched] = useState<MentionChannel[] | null>(null);
  const [loading, setLoading] = useState(false);
  const inflight = useRef(false);

  const cached = useMemo((): MentionChannel[] | null => {
    if (!isSidebarCacheForSession(sidebarListsCache, userId, workspaceId)) {
      return null;
    }
    return sidebarListsCache!.channels.map((c) => ({
      id: c.id,
      name: c.name,
    }));
  }, [sidebarListsCache, userId, workspaceId]);

  useEffect(() => {
    if (!ready || cached || inflight.current) return;

    inflight.current = true;
    setLoading(true);

    void loadSidebarLists(accessToken, workspaceId)
      .then((lists) => {
        const channels = lists.channels.map((c) => ({ id: c.id, name: c.name }));
        setFetched(channels);
      })
      .catch(() => {
        setFetched([]);
      })
      .finally(() => {
        inflight.current = false;
        setLoading(false);
      });
  }, [ready, cached, accessToken, workspaceId]);

  const channels = cached ?? fetched ?? [];

  return {
    channels,
    loading: loading && channels.length === 0,
  };
}
