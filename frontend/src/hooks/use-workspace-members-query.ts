"use client";

import { fetchWorkspaceMembers } from "@/lib/api/chat";
import { useHomeQuery } from "@/hooks/use-home-query";
import { useWorkspaceStore } from "@/stores/workspace-store";

export function useWorkspaceMembersQuery() {
  const peopleRefreshKey = useWorkspaceStore((s) => s.peopleRefreshKey);

  return useHomeQuery(
    (token, ws) => fetchWorkspaceMembers(token, ws).then((r) => r.data),
    [peopleRefreshKey],
    { refreshKey: peopleRefreshKey }
  );
}
