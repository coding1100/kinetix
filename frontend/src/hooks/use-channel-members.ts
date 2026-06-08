"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { ApiError } from "@/lib/api/client";
import {
  getCachedChannelMembers,
  getChannelMembersRevision,
  invalidateChannelMembers,
  loadChannelMembers,
  subscribeChannelMembers,
} from "@/lib/chat/channel-members-cache";
import type { ChannelMember } from "@/lib/types/chat";
import { useWorkspaceApi } from "@/hooks/use-workspace-api";

export function useChannelMembers(
  channelId: string,
  options?: { enabled?: boolean }
) {
  const enabled = options?.enabled ?? true;
  const { accessToken, workspaceId, ready } = useWorkspaceApi();
  const revision = useSyncExternalStore(
    subscribeChannelMembers,
    () =>
      channelId && workspaceId
        ? getChannelMembersRevision(workspaceId, channelId)
        : 0,
    () => 0
  );

  const initialCached =
    ready && channelId
      ? getCachedChannelMembers(workspaceId, channelId)
      : undefined;

  const [members, setMembers] = useState<ChannelMember[]>(initialCached ?? []);
  const [loading, setLoading] = useState(
    enabled && ready && !!channelId && !initialCached
  );
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const reload = useCallback(() => {
    if (!channelId) return;
    invalidateChannelMembers(workspaceId, channelId);
    setReloadKey((k) => k + 1);
  }, [workspaceId, channelId]);

  useEffect(() => {
    if (!enabled || !ready || !channelId) {
      setLoading(false);
      return;
    }

    const cached = getCachedChannelMembers(workspaceId, channelId);
    if (cached) {
      setMembers(cached);
      setLoading(false);
    } else if (reloadKey === 0) {
      setLoading(true);
    }

    let cancelled = false;

    void loadChannelMembers(accessToken, workspaceId, channelId, {
      force: reloadKey > 0,
    })
      .then((data) => {
        if (!cancelled) {
          setMembers(data);
          setError(null);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(
            err instanceof ApiError ? err.message : "Failed to load members"
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [
    enabled,
    ready,
    accessToken,
    workspaceId,
    channelId,
    reloadKey,
    revision,
  ]);

  return {
    members,
    loading: loading && members.length === 0,
    error,
    reload,
  };
}
