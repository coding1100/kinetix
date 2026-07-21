import type { WorkspaceMemberRow } from "./workspace";
import { apiFetch } from "./client";

export interface TeamMemberPreview {
  id: string;
  fullName: string;
  avatarUrl?: string | null;
  role: string;
}

export interface TeamSummary {
  id: string;
  name: string;
  color: string;
  icon: string;
  description?: string | null;
  memberCount: number;
  membersPreview: TeamMemberPreview[];
  createdAt: string | null;
  createdBy: { id: string; fullName: string; avatarUrl?: string | null } | null;
}

export interface TeamDetail extends TeamSummary {
  members: TeamMemberPreview[];
  updatedAt: string | null;
}

export interface WorkspaceMemberWithTeams extends WorkspaceMemberRow {
  teams?: { id: string; name: string; color: string; icon: string }[];
}

function wsPath(workspaceId: string, path: string) {
  return `/workspaces/${workspaceId}${path}`;
}

export function fetchTeams(
  token: string,
  workspaceId: string,
  params?: { sort?: string; order?: string }
) {
  const qs = new URLSearchParams();
  if (params?.sort) qs.set("sort", params.sort);
  if (params?.order) qs.set("order", params.order);
  const query = qs.toString();
  return apiFetch<{ data: TeamSummary[] }>(
    wsPath(workspaceId, `/teams${query ? `?${query}` : ""}`),
    { token }
  );
}

export function fetchMyTeams(token: string, workspaceId: string) {
  return apiFetch<{ data: TeamSummary[] }>(
    wsPath(workspaceId, "/teams/mine"),
    { token }
  );
}

export function fetchTeam(token: string, workspaceId: string, teamId: string) {
  return apiFetch<TeamDetail>(wsPath(workspaceId, `/teams/${teamId}`), {
    token,
  });
}

export function createTeam(
  token: string,
  workspaceId: string,
  body: {
    name: string;
    color?: string;
    icon?: string;
    description?: string;
    memberIds?: string[];
  }
) {
  return apiFetch<TeamDetail>(wsPath(workspaceId, "/teams"), {
    method: "POST",
    token,
    body: JSON.stringify(body),
  });
}

export function updateTeam(
  token: string,
  workspaceId: string,
  teamId: string,
  body: {
    name?: string;
    color?: string;
    icon?: string;
    description?: string;
  }
) {
  return apiFetch<TeamDetail>(wsPath(workspaceId, `/teams/${teamId}`), {
    method: "PATCH",
    token,
    body: JSON.stringify(body),
  });
}

export function deleteTeam(
  token: string,
  workspaceId: string,
  teamId: string
) {
  return apiFetch<{ ok: boolean }>(
    wsPath(workspaceId, `/teams/${teamId}`),
    { method: "DELETE", token }
  );
}

export function addTeamMember(
  token: string,
  workspaceId: string,
  teamId: string,
  userId: string,
  role: "LEAD" | "MEMBER" = "MEMBER"
) {
  return apiFetch<TeamDetail>(
    wsPath(workspaceId, `/teams/${teamId}/members`),
    {
      method: "POST",
      token,
      body: JSON.stringify({ userId, role }),
    }
  );
}

export function removeTeamMember(
  token: string,
  workspaceId: string,
  teamId: string,
  userId: string
) {
  return apiFetch<TeamDetail>(
    wsPath(workspaceId, `/teams/${teamId}/members/${userId}`),
    { method: "DELETE", token }
  );
}
