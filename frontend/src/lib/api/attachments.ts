import { apiFetch } from "@/lib/api/client";
import type { AttachmentKind, ConversationType, MessageAttachment } from "@/lib/types/chat";

function wsPath(workspaceId: string, path: string) {
  return `/workspaces/${workspaceId}${path}`;
}

export function presignChatAttachment(
  token: string,
  workspaceId: string,
  body: {
    fileName: string;
    mimeType: string;
    sizeBytes: number;
    kind: AttachmentKind;
    context: { type: ConversationType; id: string };
  }
) {
  return apiFetch<{
    attachmentId: string;
    uploadUrl: string;
    storageKey: string;
    expiresIn: number;
  }>(wsPath(workspaceId, "/chat/attachments/presign"), {
    method: "POST",
    token,
    body: JSON.stringify(body),
  });
}

export function uploadChatAttachmentContent(
  token: string,
  workspaceId: string,
  attachmentId: string,
  file: Blob,
  fileName: string
) {
  const form = new FormData();
  form.append("file", file, fileName);
  return apiFetch<{ ok: boolean; attachmentId: string; status: string }>(
    wsPath(workspaceId, `/chat/attachments/${attachmentId}/upload`),
    { method: "POST", token, body: form }
  );
}

export function completeChatAttachment(
  token: string,
  workspaceId: string,
  attachmentId: string
) {
  return apiFetch<{ ok: boolean; attachmentId: string; status: string }>(
    wsPath(workspaceId, `/chat/attachments/${attachmentId}/complete`),
    { method: "POST", token }
  );
}

export function fetchChannelFiles(
  token: string,
  workspaceId: string,
  channelId: string
) {
  return apiFetch<{ data: MessageAttachment[] }>(
    wsPath(workspaceId, `/chat/channels/${channelId}/files`),
    { token }
  );
}
