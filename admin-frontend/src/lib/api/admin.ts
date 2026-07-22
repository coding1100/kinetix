import { apiFetch } from "./client";

export interface AdminUser {
  id: string;
  email: string;
  fullName: string;
  role: string;
}

export interface AdminLoginResponse {
  user: AdminUser;
  accessToken: string;
  refreshToken?: string;
}

export function adminLogin(email: string, password: string) {
  return apiFetch<AdminLoginResponse>("/admin/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export function adminRefresh(refreshToken?: string | null) {
  return apiFetch<AdminLoginResponse>("/admin/auth/refresh", {
    method: "POST",
    body: refreshToken ? JSON.stringify({ refreshToken }) : undefined,
  });
}

export function adminLogout() {
  return apiFetch<{ message: string }>("/admin/auth/logout", { method: "POST" });
}

export interface WorkspaceOwner {
  id: string;
  email: string;
  fullName: string;
}

export interface AdminWorkspace {
  id: string;
  name: string;
  slug: string;
  status: "ACTIVE" | "SUSPENDED";
  isDeleted: boolean;
  deletedAt: string | null;
  memberCount: number;
  owner: WorkspaceOwner | null;
  createdAt: string;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

export function listWorkspaces(
  token: string,
  params: {
    q?: string;
    status?: "ACTIVE" | "SUSPENDED";
    includeDeleted?: boolean;
    limit?: number;
    offset?: number;
    signal?: AbortSignal;
  } = {}
) {
  const qs = new URLSearchParams();
  if (params.q) qs.set("q", params.q);
  if (params.status) qs.set("status", params.status);
  if (params.includeDeleted) qs.set("includeDeleted", "true");
  if (params.limit) qs.set("limit", String(params.limit));
  if (params.offset) qs.set("offset", String(params.offset));
  const suffix = qs.toString() ? `?${qs}` : "";
  return apiFetch<Paginated<AdminWorkspace>>(`/admin/workspaces${suffix}`, {
    token,
    signal: params.signal,
  });
}

export function suspendWorkspace(token: string, workspaceId: string) {
  return apiFetch<{ id: string; status: string }>(
    `/admin/workspaces/${workspaceId}/suspend`,
    { method: "POST", token }
  );
}

export function reactivateWorkspace(token: string, workspaceId: string) {
  return apiFetch<{ id: string; status: string }>(
    `/admin/workspaces/${workspaceId}/reactivate`,
    { method: "POST", token }
  );
}

export function deleteWorkspace(token: string, workspaceId: string) {
  return apiFetch<{ ok: boolean }>(`/admin/workspaces/${workspaceId}`, {
    method: "DELETE",
    token,
  });
}

export function restoreWorkspace(token: string, workspaceId: string) {
  return apiFetch<{ id: string; isDeleted: boolean }>(
    `/admin/workspaces/${workspaceId}/restore`,
    { method: "POST", token }
  );
}

export type TransferOwnershipTarget =
  | { newOwnerUserId: string }
  | { newOwnerEmail: string };

export function transferOwnership(
  token: string,
  workspaceId: string,
  target: TransferOwnershipTarget
) {
  return apiFetch<{ ok: boolean; newOwnerUserId: string }>(
    `/admin/workspaces/${workspaceId}/transfer-ownership`,
    {
      method: "POST",
      token,
      body: JSON.stringify(target),
    }
  );
}

export const WORKSPACE_ROLES = [
  "SUPER_ADMIN",
  "ADMIN",
  "MEMBER",
  "LIMITED_MEMBER",
  "GUEST",
] as const;

export type WorkspaceRole = "OWNER" | (typeof WORKSPACE_ROLES)[number];

export interface AdminWorkspaceMember {
  id: string; // user id
  membershipId: string;
  email: string;
  fullName: string;
  isDisabled: boolean;
  role: WorkspaceRole;
}

export function listWorkspaceMembers(token: string, workspaceId: string) {
  return apiFetch<{ items: AdminWorkspaceMember[] }>(
    `/admin/workspaces/${workspaceId}/members`,
    { token }
  );
}

export function updateMemberRole(
  token: string,
  workspaceId: string,
  userId: string,
  role: WorkspaceRole
) {
  return apiFetch<{ id: string; userId: string; role: string }>(
    `/admin/workspaces/${workspaceId}/members/${userId}/role`,
    { method: "PATCH", token, body: JSON.stringify({ role }) }
  );
}

export interface AdminUserWorkspace {
  id: string;
  name: string;
  slug: string;
  role: WorkspaceRole;
  status: "ACTIVE" | "SUSPENDED";
  isDeleted: boolean;
}

export function listUserWorkspaces(token: string, userId: string) {
  return apiFetch<{ items: AdminUserWorkspace[] }>(
    `/admin/users/${userId}/workspaces`,
    { token }
  );
}

export interface AdminUserRow {
  id: string;
  email: string;
  fullName: string;
  isDisabled: boolean;
  workspaceCount: number;
  createdAt: string;
}

export function listUsers(
  token: string,
  params: {
    q?: string;
    isDisabled?: boolean;
    limit?: number;
    offset?: number;
    signal?: AbortSignal;
  } = {}
) {
  const qs = new URLSearchParams();
  if (params.q) qs.set("q", params.q);
  if (params.isDisabled !== undefined) qs.set("isDisabled", String(params.isDisabled));
  if (params.limit) qs.set("limit", String(params.limit));
  if (params.offset) qs.set("offset", String(params.offset));
  const suffix = qs.toString() ? `?${qs}` : "";
  return apiFetch<Paginated<AdminUserRow>>(`/admin/users${suffix}`, {
    token,
    signal: params.signal,
  });
}

export function disableUser(token: string, userId: string) {
  return apiFetch<{ id: string; isDisabled: boolean }>(
    `/admin/users/${userId}/disable`,
    { method: "POST", token }
  );
}

export function enableUser(token: string, userId: string) {
  return apiFetch<{ id: string; isDisabled: boolean }>(
    `/admin/users/${userId}/enable`,
    { method: "POST", token }
  );
}

export interface AuditLogEntry {
  id: string;
  action: string;
  targetType: string;
  targetId: string;
  metadata: Record<string, unknown> | null;
  actor: { id: string; email: string; fullName: string };
  createdAt: string;
}

export function listAuditLog(
  token: string,
  params: { targetType?: string; targetId?: string; limit?: number; offset?: number } = {}
) {
  const qs = new URLSearchParams();
  if (params.targetType) qs.set("targetType", params.targetType);
  if (params.targetId) qs.set("targetId", params.targetId);
  if (params.limit) qs.set("limit", String(params.limit));
  if (params.offset) qs.set("offset", String(params.offset));
  const suffix = qs.toString() ? `?${qs}` : "";
  return apiFetch<Paginated<AuditLogEntry>>(`/admin/audit-log${suffix}`, { token });
}
