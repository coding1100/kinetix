"use client";

import { useEffect, useRef } from "react";
import { loadSidebarLists } from "@/lib/chat/sidebar-lists-loader";
import { useWorkspaceApi } from "@/hooks/use-workspace-api";
import { useAuthStore } from "@/stores/auth-store";
import { useChatStore } from "@/stores/chat-store";

/** Warms sidebar cache as soon as the user enters the chat section. */
export function ChatSidebarPrefetch() {
  const hydrated = useAuthStore((s) => s.hydrated);
  const { accessToken, workspaceId, ready } = useWorkspaceApi();
  const sidebarListsCache = useChatStore((s) => s.sidebarListsCache);
  const started = useRef(false);

  useEffect(() => {
    if (!hydrated || !ready || started.current) return;
    if (sidebarListsCache?.workspaceId === workspaceId) return;

    started.current = true;
    let cancelled = false;

    void loadSidebarLists(accessToken, workspaceId).catch(() => {
      if (!cancelled) started.current = false;
    });

    return () => {
      cancelled = true;
    };
  }, [hydrated, ready, accessToken, workspaceId, sidebarListsCache?.workspaceId]);

  return null;
}
