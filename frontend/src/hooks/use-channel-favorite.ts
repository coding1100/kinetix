"use client";

import { useCallback, useState } from "react";
import { toast } from "sonner";
import { updateChannelMember } from "@/lib/api/chat";
import { ApiError } from "@/lib/api/client";
import {
  bumpSidebarRefresh,
  patchSidebarChannel,
} from "@/lib/chat/sidebar-channel";
import { useChatStore } from "@/stores/chat-store";
import { useWorkspaceApi } from "@/hooks/use-workspace-api";

export function useChannelFavorite(channelId: string, fallbackStarred = false) {
  const { accessToken, workspaceId, ready } = useWorkspaceApi();
  const starred = useChatStore((s) => {
    const override = s.channelMetaOverrides[channelId]?.starred;
    const cached = s.sidebarListsCache?.channels.find(
      (c) => c.id === channelId
    )?.starred;
    return override ?? cached ?? fallbackStarred;
  });
  const [toggling, setToggling] = useState(false);

  const toggleFavorite = useCallback(async () => {
    if (!ready) return;
    const next = !starred;
    setToggling(true);
    try {
      await updateChannelMember(accessToken, workspaceId, channelId, {
        starred: next,
      });
      patchSidebarChannel(channelId, { starred: next });
      bumpSidebarRefresh();
      toast.success(next ? "Added to favorites" : "Removed from favorites");
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Failed to update favorite"
      );
    } finally {
      setToggling(false);
    }
  }, [ready, starred, accessToken, workspaceId, channelId]);

  return { starred, toggleFavorite, toggling };
}
