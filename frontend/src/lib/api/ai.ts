import { apiFetch } from "./client";

function wsPath(workspaceId: string, path: string) {
  return `/workspaces/${workspaceId}${path}`;
}

export type CatchUpResponse = {
  title: string;
  messageCount: number;
  summary: string;
  keyDecisions: string[];
  actionItems: string[];
  mentions: string[];
};

export type Citation = {
  id: string;
  title: string;
  category: string;
  snippet: string;
};

export type ActionChip = {
  label: string;
  action: string;
  target?: string;
};

export type KnowledgeQueryResponse = {
  query: string;
  answer: string;
  citations: Citation[];
  actionChips: ActionChip[];
};

export type CompanyDocumentDto = {
  id: string;
  title: string;
  category: string;
  fileType: string;
  createdAt: string;
};

export function fetchCatchUp(
  token: string,
  workspaceId: string,
  body: { conversationType: "channel" | "dm"; conversationId: string; limit?: number }
) {
  return apiFetch<CatchUpResponse>(wsPath(workspaceId, "/ai/catch-up"), {
    method: "POST",
    token,
    body: JSON.stringify(body),
  });
}

export function queryKnowledgeBase(
  token: string,
  workspaceId: string,
  body: { query: string; topK?: number }
) {
  return apiFetch<KnowledgeQueryResponse>(wsPath(workspaceId, "/ai/knowledge-query"), {
    method: "POST",
    token,
    body: JSON.stringify(body),
  });
}

export function createCompanyDocument(
  token: string,
  workspaceId: string,
  body: { title: string; category?: string; content: string; fileType?: string }
) {
  return apiFetch<CompanyDocumentDto>(
    wsPath(workspaceId, "/admin/knowledge-base/documents"),
    {
      method: "POST",
      token,
      body: JSON.stringify(body),
    }
  );
}

export function listCompanyDocuments(token: string, workspaceId: string) {
  return apiFetch<{ data: CompanyDocumentDto[] }>(
    wsPath(workspaceId, "/admin/knowledge-base/documents"),
    { token }
  );
}

export function deleteCompanyDocument(
  token: string,
  workspaceId: string,
  documentId: string
) {
  return apiFetch<{ ok: boolean }>(
    wsPath(workspaceId, `/admin/knowledge-base/documents/${documentId}`),
    {
      method: "DELETE",
      token,
    }
  );
}
