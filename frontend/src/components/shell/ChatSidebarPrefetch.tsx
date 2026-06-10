"use client";

import { useEffect } from "react";
import { loadSidebarLists } from "@/lib/chat/sidebar-lists-loader";
import { useWorkspaceApi } from "@/hooks/use-workspace-api";
import { useAuthStore } from "@/stores/auth-store";

/** Warms sidebar cache and revalidates stale persisted data on chat entry. */
export function ChatSidebarPrefetch() {
  const hydrated = useAuthStore((s) => s.hydrated);
  const { accessToken, workspaceId, ready } = useWorkspaceApi();

  useEffect(() => {
    if (!hydrated || !ready) return;
    void loadSidebarLists(accessToken, workspaceId);
  }, [hydrated, ready, accessToken, workspaceId]);

  return null;
}
