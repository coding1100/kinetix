"use client";

import { useCallback, useState } from "react";
import { toast } from "sonner";
import { pinChannel } from "@/lib/api/chat";
import { ApiError } from "@/lib/api/client";
import { bumpSidebarRefresh, patchSidebarChannel } from "@/lib/chat/sidebar-channel";
import { useChatStore } from "@/stores/chat-store";
import { useWorkspaceApi } from "@/hooks/use-workspace-api";

export function useChannelPin(channelId: string, fallbackPinned = false) {
  const { accessToken, workspaceId, ready } = useWorkspaceApi();
  const pinned = useChatStore((s) => {
    const cached = s.sidebarListsCache?.channels.find(
      (c) => c.id === channelId
    )?.pinnedAt;
    return Boolean(cached) || fallbackPinned;
  });
  const [toggling, setToggling] = useState(false);

  const togglePin = useCallback(async () => {
    if (!ready) return;
    const next = !pinned;
    setToggling(true);
    try {
      await pinChannel(accessToken, workspaceId, channelId, next);
      patchSidebarChannel(channelId, {
        pinnedAt: next ? new Date().toISOString() : undefined,
      });
      bumpSidebarRefresh();
      toast.success(next ? "Channel pinned" : "Channel unpinned");
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Failed to update pin"
      );
    } finally {
      setToggling(false);
    }
  }, [ready, pinned, accessToken, workspaceId, channelId]);

  return { pinned, togglePin, toggling };
}
