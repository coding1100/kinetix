import { apiFetch } from "./client";

export interface ApiKeyItem {
  id: string;
  name: string;
  keyPrefix: string;
  workspaceId: string | null;
  createdAt: string | null;
  expiresAt: string | null;
  lastUsedAt: string | null;
}

export interface CreatedApiKey {
  id: string;
  name: string;
  token: string;
  keyPrefix: string;
  workspaceId: string | null;
  createdAt: string | null;
  expiresAt: string | null;
}

export async function listApiKeys(token?: string): Promise<ApiKeyItem[]> {
  const res = await apiFetch<{ keys: ApiKeyItem[] }>("/auth/api-keys", {
    method: "GET",
    token,
  });
  return res.keys || [];
}

export async function createApiKey(
  data: { name: string; workspaceId?: string | null; expiresDays?: number | null },
  token?: string
): Promise<CreatedApiKey> {
  return await apiFetch<CreatedApiKey>("/auth/api-keys", {
    method: "POST",
    token,
    body: JSON.stringify(data),
  });
}

export async function revokeApiKey(keyId: string, token?: string): Promise<void> {
  await apiFetch(`/auth/api-keys/${keyId}`, {
    method: "DELETE",
    token,
  });
}

export interface McpToolSummary {
  name: string;
  description: string;
  category: string;
}

export interface McpStatusResponse {
  status: string;
  service: string;
  protocolVersion: string;
  backendDirectory: string;
  transports: {
    stdio: {
      command: string;
      args: string[];
      envKey: string;
    };
    sse: {
      endpoint: string;
      method: string;
      authHeader: string;
    };
  };
  tools: McpToolSummary[];
  toolsCount: number;
}

export interface VerifyMcpResponse {
  valid: boolean;
  user?: {
    id: string;
    email: string;
    name: string;
  };
  workspace?: {
    id: string;
    name: string;
    role: string;
  };
  toolsCount?: number;
  message: string;
  error?: string;
}

export async function getMcpStatus(): Promise<McpStatusResponse> {
  return await apiFetch<McpStatusResponse>("/mcp/status", {
    method: "GET",
  });
}

export async function verifyMcpConnection(
  data: { token?: string; workspaceId?: string },
  token?: string
): Promise<VerifyMcpResponse> {
  return await apiFetch<VerifyMcpResponse>("/mcp/verify", {
    method: "POST",
    token,
    body: JSON.stringify(data),
  });
}

