"use client";

import type { MessageAttachment } from "@/lib/types/chat";
import { AttachmentPreviewRow } from "@/components/chat/attachments/AttachmentPreviewRow";
import { cn } from "@/lib/utils";

export function MessageAttachmentList({
  attachments,
  className,
}: {
  attachments: MessageAttachment[];
  className?: string;
}) {
  if (!attachments.length) return null;

  return (
    <div className={cn("mt-2 space-y-2", className)}>
      {attachments.map((att) => (
        <AttachmentPreviewRow
          key={att.id}
          fileName={att.fileName}
          mimeType={att.mimeType}
          sizeBytes={att.sizeBytes}
          kind={att.kind}
          downloadUrl={att.downloadUrl}
        />
      ))}
    </div>
  );
}
