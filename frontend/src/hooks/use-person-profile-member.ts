"use client";

import { useEffect, useState } from "react";
import { fetchWorkspacePeople } from "@/lib/api/workspace";
import {
  getCachedChannelMembers,
  loadChannelMembers,
} from "@/lib/chat/channel-members-cache";
import { useWorkspaceApi } from "@/hooks/use-workspace-api";
import type { ChannelMember } from "@/lib/types/chat";

export type PersonProfileMember = {
  id: string;
  fullName: string;
  email: string;
  avatarUrl?: string | null;
  workspaceRole?: string | null;
  joinedAt?: string | null;
};

function toProfileMember(member: ChannelMember): PersonProfileMember {
  return {
    id: member.id,
    fullName: member.fullName,
    email: member.email,
    avatarUrl: member.avatarUrl,
    workspaceRole: member.workspaceRole,
    joinedAt: member.joinedAt,
  };
}

export function usePersonProfileMember(
  userId: string,
  channelId?: string
): { member: PersonProfileMember | null; loading: boolean } {
  const { accessToken, workspaceId, ready } = useWorkspaceApi();
  const [member, setMember] = useState<PersonProfileMember | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!ready || !userId) {
      setMember(null);
      setLoading(false);
      return;
    }

    let cancelled = false;

    const resolve = async () => {
      setLoading(true);

      if (channelId) {
        const cached = getCachedChannelMembers(workspaceId, channelId);
        const hit = cached?.find((m) => m.id === userId);
        if (hit) {
          if (!cancelled) {
            setMember(toProfileMember(hit));
            setLoading(false);
          }
          return;
        }

        try {
          const members = await loadChannelMembers(
            accessToken,
            workspaceId,
            channelId
          );
          const loaded = members.find((m) => m.id === userId);
          if (loaded && !cancelled) {
            setMember(toProfileMember(loaded));
            setLoading(false);
            return;
          }
        } catch {
          /* fall through to workspace members */
        }
      }

      try {
        const res = await fetchWorkspacePeople(accessToken, workspaceId);
        const row = res.data.find((m) => m.id === userId);
        if (!cancelled) {
          setMember(
            row
              ? {
                  id: row.id,
                  fullName: row.fullName,
                  email: row.email,
                  avatarUrl: row.avatarUrl,
                  workspaceRole: row.role,
                  joinedAt: row.joinedAt,
                }
              : null
          );
        }
      } catch {
        if (!cancelled) setMember(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void resolve();
    return () => {
      cancelled = true;
    };
  }, [ready, accessToken, workspaceId, userId, channelId]);

  return { member, loading };
}
