import { apiFetch } from "./client";

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  avatarUrl: string | null;
}

export interface WorkspaceSummary {
  id: string;
  name: string;
  slug: string;
  role: string;
}

export interface LoginResponse {
  user: AuthUser;
  accessToken: string;
  refreshToken?: string;
}

export interface SignupResponse extends LoginResponse {
  flow: "owner";
}

export interface MeResponse extends AuthUser {
  createdAt: string;
  hasPassword: boolean;
  workspaces: WorkspaceSummary[];
}

export function login(email: string, password: string) {
  return apiFetch<LoginResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export function signup(input: {
  email: string;
  password: string;
  fullName: string;
  workspaceName?: string;
}) {
  return apiFetch<SignupResponse>("/auth/signup", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function forgotPassword(email: string) {
  return apiFetch<{ message: string; resetToken?: string }>(
    "/auth/forgot-password",
    {
      method: "POST",
      body: JSON.stringify({ email }),
    }
  );
}

export function resetPassword(token: string, password: string) {
  return apiFetch<{ message: string }>("/auth/reset-password", {
    method: "POST",
    body: JSON.stringify({ token, password }),
  });
}

export function getMe(token: string) {
  return apiFetch<MeResponse>("/auth/me", { token });
}

export function updateProfile(
  token: string,
  body: { fullName?: string; avatarUrl?: string | null }
) {
  return apiFetch<MeResponse>("/auth/me", {
    method: "PATCH",
    token,
    body: JSON.stringify(body),
  });
}

export function changePassword(
  token: string,
  body: { currentPassword: string; newPassword: string }
) {
  return apiFetch<{ message: string }>("/auth/me/change-password", {
    method: "POST",
    token,
    body: JSON.stringify(body),
  });
}

export function logout() {
  return apiFetch<{ message: string }>("/auth/logout", { method: "POST" });
}

export interface RefreshResponse {
  user: AuthUser;
  accessToken: string;
  refreshToken?: string;
}

export function refreshSession(refreshToken?: string | null) {
  return apiFetch<RefreshResponse>("/auth/refresh", {
    method: "POST",
    body: refreshToken ? JSON.stringify({ refreshToken }) : undefined,
  });
}

export function exchangeOAuthCode(code: string) {
  return apiFetch<LoginResponse>("/auth/oauth/exchange", {
    method: "POST",
    body: JSON.stringify({ code }),
  });
}
