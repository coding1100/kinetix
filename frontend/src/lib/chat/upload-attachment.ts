import {
  presignChatAttachment,
  uploadChatAttachmentContent,
} from "@/lib/api/attachments";
import type { AttachmentKind, ConversationType } from "@/lib/types/chat";

export async function uploadChatAttachment(
  token: string,
  workspaceId: string,
  context: { type: ConversationType; id: string },
  file: Blob,
  fileName: string,
  mimeType: string,
  kind: AttachmentKind
): Promise<string> {
  const presign = await presignChatAttachment(token, workspaceId, {
    fileName,
    mimeType,
    sizeBytes: file.size,
    kind,
    context,
  });

  // Upload via API proxy to avoid S3 CORS issues in the browser.
  await uploadChatAttachmentContent(
    token,
    workspaceId,
    presign.attachmentId,
    file,
    fileName
  );

  return presign.attachmentId;
}
