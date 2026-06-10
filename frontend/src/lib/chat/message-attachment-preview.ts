import type { MessageAttachment } from "@/lib/types/chat";
import type { PendingAttachment } from "@/hooks/use-composer-attachments";

export function messageAttachmentToPreview(
  attachment: MessageAttachment
): PendingAttachment {
  return {
    id: attachment.id,
    fileName: attachment.fileName,
    kind: attachment.kind,
    mimeType: attachment.mimeType,
    sizeBytes: attachment.sizeBytes,
    previewUrl: attachment.downloadUrl ?? undefined,
  };
}
