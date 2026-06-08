"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchChannelFiles } from "@/lib/api/attachments";
import type { MessageAttachment } from "@/lib/types/chat";
import { useWorkspaceApi } from "@/hooks/use-workspace-api";

export function useChannelFiles(channelId: string | null) {
  const { accessToken, workspaceId, ready } = useWorkspaceApi();
  const [files, setFiles] = useState<MessageAttachment[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!ready || !channelId) {
      setFiles([]);
      return;
    }
    setLoading(true);
    try {
      const res = await fetchChannelFiles(accessToken, workspaceId, channelId);
      setFiles(res.data);
    } catch {
      setFiles([]);
    } finally {
      setLoading(false);
    }
  }, [ready, channelId, accessToken, workspaceId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { files, loading, refresh };
}
