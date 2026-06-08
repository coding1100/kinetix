import { apiFetch } from "./client";

export interface InvitePreview {
  email: string;
  role: string;
  workspace: { id: string; name: string; slug: string };
}

export interface CreateInviteResponse {
  id: string;
  email: string;
  role: string;
  token: string;
  inviteUrl: string;
}

export interface AcceptInviteSignupResponse {
  user: { id: string; email: string; fullName: string };
  accessToken: string;
  workspace: { id: string; name: string; slug: string };
  role: string;
  flow: "invitee";
}

export function createInvite(
  token: string,
  workspaceId: string,
  email: string,
  role: string
) {
  return apiFetch<CreateInviteResponse>(
    `/workspaces/${workspaceId}/invites`,
    {
      method: "POST",
      token,
      body: JSON.stringify({ email, role }),
    }
  );
}

export function getInvitePreview(inviteToken: string) {
  return apiFetch<InvitePreview>(`/invites/${inviteToken}`);
}

export function acceptInviteSignup(
  inviteToken: string,
  fullName: string,
  password: string
) {
  return apiFetch<AcceptInviteSignupResponse>(
    `/invites/${inviteToken}/accept-signup`,
    {
      method: "POST",
      body: JSON.stringify({ fullName, password }),
    }
  );
}

export function acceptInvite(token: string, inviteToken: string) {
  return apiFetch<{
    workspace: { id: string; name: string; slug: string };
    role: string;
    flow: string;
  }>(`/invites/${inviteToken}/accept`, { method: "POST", token });
}
