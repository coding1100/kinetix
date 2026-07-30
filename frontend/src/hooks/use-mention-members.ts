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
  isDisabled?: boolean;
};

export function useMentionMembers(
  conversationType?: ConversationType,
  conversationId?: string
) {
  const isChannel = conversationType === "channel" && !!conversationId;
  const isDm = conversationType === "dm" && !!conversationId;

  // Only used to sort people already in the channel to the top.
  const { members: channelMembers } = useChannelMembers(
    isChannel ? conversationId! : "",
    { enabled: isChannel }
  );

  const isWorkspaceFallback = !isChannel && !isDm;

  // Everywhere - channel, DM or standalone composer - anyone in the workspace
  // can be mentioned. Whether a mention notifies is decided server-side
  // (mentioned people without channel access get no notification).
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
    const fromWorkspace = (workspaceQuery.data ?? []).map((m) => ({
      id: m.id,
      fullName: m.fullName,
      email: m.email,
      avatarUrl: m.avatarUrl,
      isDisabled: m.isDisabled,
    }));
    if (isChannel) {
      // Channel members first, then the rest of the workspace.
      const inChannel = new Set(channelMembers.map((m) => m.id));
      return [
        ...fromWorkspace.filter((m) => inChannel.has(m.id)),
        ...fromWorkspace.filter((m) => !inChannel.has(m.id)),
      ];
    }
    if (isDm || isWorkspaceFallback) {
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
          isDisabled: dmSidebarEntry.otherUserIsDisabled,
        },
      ];
    }
    return [];
  }, [isChannel, isDm, isWorkspaceFallback, channelMembers, workspaceQuery.data, dmSidebarEntry]);

  const loading =
    isChannel || isDm || isWorkspaceFallback ? workspaceQuery.loading : false;

  return { members, loading };
}
