"use client";

import { useMemo } from "react";
import { fetchWorkspaceMembers } from "@/lib/api/chat";
import type { ConversationType } from "@/lib/types/chat";
import { useChannelMembers } from "@/hooks/use-channel-members";
import { useHomeQuery } from "@/hooks/use-home-query";

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

  const workspaceQuery = useHomeQuery(
    (token, ws) => fetchWorkspaceMembers(token, ws).then((r) => r.data),
    [conversationType, conversationId],
    { initialData: isDm ? [] : null }
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
    if (isDm) {
      return (workspaceQuery.data ?? []).map((m) => ({
        id: m.id,
        fullName: m.fullName,
        email: m.email,
        avatarUrl: m.avatarUrl,
      }));
    }
    return [];
  }, [isChannel, isDm, channelMembers, workspaceQuery.data]);

  const loading = isChannel ? channelLoading : isDm ? workspaceQuery.loading : false;

  return { members, loading };
}
