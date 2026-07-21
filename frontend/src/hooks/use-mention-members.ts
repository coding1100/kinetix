"use client";

import { useMemo } from "react";
import { fetchWorkspaceMembers } from "@/lib/api/chat";
import type { ConversationType } from "@/lib/types/chat";
import { useChannelMembers } from "@/hooks/use-channel-members";
import { useHomeQuery } from "@/hooks/use-home-query";
import { useChatStore } from "@/stores/chat-store";

export type MentionMember = {
  id: string;
  fullName: string;
  email: string;
  avatarUrl?: string | null;
};

export function useMentionMembers(
  conversationType?: ConversationType,
  conversationId?: string
) {
  const isChannel = conversationType === "channel" && !!conversationId;
  const isDm = conversationType === "dm" && !!conversationId;

  const { members: channelMembers, loading: channelLoading } = useChannelMembers(
    isChannel ? conversationId! : "",
    { enabled: isChannel }
  );

  const isWorkspaceFallback = !isChannel && !isDm;

  const workspaceQuery = useHomeQuery(
    (token, ws) => fetchWorkspaceMembers(token, ws).then((r) => r.data),
    [conversationType, conversationId],
    { initialData: null }
  );

  const dmSidebarEntry = useChatStore((s) =>
    isDm && conversationId
      ? s.sidebarListsCache?.dms.find((d) => d.id === conversationId)
      : undefined
  );

  const members = useMemo((): MentionMember[] => {
    if (isChannel) {
      return channelMembers.map((m) => ({
        id: m.id,
        fullName: m.fullName,
        email: m.email,
        avatarUrl: m.avatarUrl,
      }));
    }
    if (isDm || isWorkspaceFallback) {
      const fromWorkspace = (workspaceQuery.data ?? []).map((m) => ({
        id: m.id,
        fullName: m.fullName,
        email: m.email,
        avatarUrl: m.avatarUrl,
      }));
      if (isWorkspaceFallback) return fromWorkspace;
      if (!dmSidebarEntry?.otherUserId || !dmSidebarEntry.name) {
        return fromWorkspace;
      }
      if (fromWorkspace.some((m) => m.id === dmSidebarEntry.otherUserId)) {
        return fromWorkspace;
      }
      return [
        ...fromWorkspace,
        {
          id: dmSidebarEntry.otherUserId,
          fullName: dmSidebarEntry.name,
          email: "",
          avatarUrl: dmSidebarEntry.avatarUrl,
        },
      ];
    }
    return [];
  }, [isChannel, isDm, isWorkspaceFallback, channelMembers, workspaceQuery.data, dmSidebarEntry]);

  const loading = isChannel ? channelLoading : (isDm || isWorkspaceFallback) ? workspaceQuery.loading : false;

  return { members, loading };
}
