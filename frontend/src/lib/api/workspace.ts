import { apiFetch } from "./client";

export interface WorkspaceMemberRow {
  id: string;
  membershipId: string;
  email: string;
  fullName: string;
  avatarUrl?: string | null;
  role: string;
  status: string;
  joinedAt: string | null;
  presence?: import("@/stores/profile-store").PresenceStatus;
}

export interface WorkspaceInviteRow {
  id: string;
  email: string;
  role: string;
  expiresAt: string;
  createdAt: string | null;
  status: "pending" | "expired";
  invitedBy: { id: string; fullName: string } | null;
  inviteUrl: string;
}

export interface CreateInviteResponse {
  id: string;
  email: string;
  role: string;
  inviteUrl: string;
  token: string;
  status: string;
  emailSent?: boolean;
}

function wsPath(workspaceId: string, path: string) {
  return `/workspaces/${workspaceId}${path}`;
}

export function fetchWorkspacePeople(token: string, workspaceId: string) {
  return apiFetch<{ data: WorkspaceMemberRow[] }>(
    wsPath(workspaceId, "/members"),
    { token }
  );
}

export function fetchWorkspaceInvites(token: string, workspaceId: string) {
  return apiFetch<{ data: WorkspaceInviteRow[] }>(
    wsPath(workspaceId, "/invites"),
    { token }
  );
}

export function createWorkspaceInvite(
  token: string,
  workspaceId: string,
  email: string,
  role: string
) {
  return apiFetch<CreateInviteResponse>(wsPath(workspaceId, "/invites"), {
    method: "POST",
    token,
    body: JSON.stringify({ email, role }),
  });
}

export function cancelWorkspaceInvite(
  token: string,
  workspaceId: string,
  inviteId: string
) {
  return apiFetch<{ ok: boolean }>(
    wsPath(workspaceId, `/invites/${inviteId}`),
    { method: "DELETE", token }
  );
}

export function resendWorkspaceInvite(
  token: string,
  workspaceId: string,
  inviteId: string
) {
  return apiFetch<CreateInviteResponse>(
    wsPath(workspaceId, `/invites/${inviteId}/resend`),
    { method: "POST", token }
  );
}

export function updateWorkspaceMemberRole(
  token: string,
  workspaceId: string,
  userId: string,
  role: string
) {
  return apiFetch<{ ok: boolean }>(
    wsPath(workspaceId, `/members/${userId}`),
    { method: "PATCH", token, body: JSON.stringify({ role }) }
  );
}

export function removeWorkspaceMember(
  token: string,
  workspaceId: string,
  userId: string
) {
  return apiFetch<{ ok: boolean }>(
    wsPath(workspaceId, `/members/${userId}`),
    { method: "DELETE", token }
  );
}
