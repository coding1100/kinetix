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
}

export function adminLogin(email: string, password: string) {
  return apiFetch<AdminLoginResponse>("/admin/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export function adminRefresh() {
  return apiFetch<AdminLoginResponse>("/admin/auth/refresh", {
    method: "POST",
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

export function createWorkspace(token: string, name: string) {
  return apiFetch<{ id: string; name: string; slug: string }>("/admin/workspaces", {
    method: "POST",
    token,
    body: JSON.stringify({ name }),
  });
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
  "ADMIN",
  "MEMBER",
  "LIMITED_MEMBER",
  "GUEST",
] as const;

// SUPER_ADMIN is intentionally absent from the selectable roles above but kept
// in the type so existing super-admin records still display correctly.
export type WorkspaceRole =
  | "OWNER"
  | "SUPER_ADMIN"
  | (typeof WORKSPACE_ROLES)[number];

export interface AdminWorkspaceMember {
  id: string; // user id
  membershipId: string;
  email: string;
  fullName: string;
  isDisabled: boolean;
  status: "ACTIVE" | "SUSPENDED";
  role: WorkspaceRole;
}

export function listWorkspaceMembers(token: string, workspaceId: string) {
  return apiFetch<{ items: AdminWorkspaceMember[] }>(
    `/admin/workspaces/${workspaceId}/members`,
    { token }
  );
}

export const INVITE_ROLES = [
  "OWNER",
  "MEMBER",
  "LIMITED_MEMBER",
  "GUEST",
  "ADMIN",
] as const;

export type InviteRole = "SUPER_ADMIN" | (typeof INVITE_ROLES)[number];

export interface AdminWorkspaceInvite {
  id: string;
  email: string;
  role: InviteRole;
  expiresAt: string;
  createdAt: string | null;
  status: "pending" | "expired";
  invitedBy: { id: string; fullName: string } | null;
  inviteUrl: string;
}

export function listWorkspaceInvites(token: string, workspaceId: string) {
  return apiFetch<{ items: AdminWorkspaceInvite[] }>(
    `/admin/workspaces/${workspaceId}/invites`,
    { token }
  );
}

export function createWorkspaceInvite(
  token: string,
  workspaceId: string,
  email: string,
  role: InviteRole
) {
  return apiFetch<AdminWorkspaceInvite & { emailSent: boolean; token: string }>(
    `/admin/workspaces/${workspaceId}/invites`,
    { method: "POST", token, body: JSON.stringify({ email, role }) }
  );
}

export function cancelWorkspaceInvite(token: string, workspaceId: string, inviteId: string) {
  return apiFetch<{ ok: boolean }>(
    `/admin/workspaces/${workspaceId}/invites/${inviteId}`,
    { method: "DELETE", token }
  );
}

export function resendWorkspaceInvite(token: string, workspaceId: string, inviteId: string) {
  return apiFetch<AdminWorkspaceInvite & { emailSent: boolean; token: string }>(
    `/admin/workspaces/${workspaceId}/invites/${inviteId}/resend`,
    { method: "POST", token }
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

export function suspendMember(token: string, workspaceId: string, userId: string) {
  return apiFetch<{ userId: string; status: string }>(
    `/admin/workspaces/${workspaceId}/members/${userId}/suspend`,
    { method: "POST", token }
  );
}

export function reactivateMember(token: string, workspaceId: string, userId: string) {
  return apiFetch<{ userId: string; status: string }>(
    `/admin/workspaces/${workspaceId}/members/${userId}/reactivate`,
    { method: "POST", token }
  );
}

export interface AdminUserWorkspace {
  id: string;
  name: string;
  slug: string;
  role: WorkspaceRole;
  status: "ACTIVE" | "SUSPENDED";
  isDeleted: boolean;
  membershipStatus: "ACTIVE" | "SUSPENDED";
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

export interface PlatformStaffMember {
  id: string;
  userId: string;
  email: string;
  fullName: string;
  role: string;
  grantedBy: { id: string; email: string; fullName: string } | null;
  createdAt: string;
}

export type PlatformRole = "SUPER_ADMIN" | "STAFF";

export function listPlatformStaff(token: string) {
  return apiFetch<{ items: PlatformStaffMember[] }>("/admin/staff", { token });
}

export function grantPlatformStaff(token: string, email: string, role: PlatformRole = "STAFF") {
  return apiFetch<{ id: string; userId: string; email: string; fullName: string; role: string }>(
    "/admin/staff",
    { method: "POST", token, body: JSON.stringify({ email, role }) }
  );
}

export function revokePlatformStaff(token: string, userId: string) {
  return apiFetch<{ ok: boolean }>(`/admin/staff/${userId}`, {
    method: "DELETE",
    token,
  });
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
