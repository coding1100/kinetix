"use client";

import type { PendingAttachment } from "@/hooks/use-composer-attachments";
import type { AttachmentKind } from "@/lib/types/chat";
import { AttachmentPreviewRow } from "@/components/chat/attachments/AttachmentPreviewRow";
import { cn } from "@/lib/utils";

export function ComposerAttachmentChips({
  items,
  uploadingItem,
  onRemove,
  className,
}: {
  items: PendingAttachment[];
  uploadingItem?: {
    fileName: string;
    kind: AttachmentKind;
    mimeType?: string;
    sizeBytes?: number;
    previewUrl?: string;
  } | null;
  onRemove: (id: string) => void;
  className?: string;
}) {
  if (items.length === 0 && !uploadingItem) return null;

  return (
    <div className={cn("space-y-2 px-3 pt-2", className)}>
      {uploadingItem ? (
        <AttachmentPreviewRow
          fileName={uploadingItem.fileName}
          mimeType={uploadingItem.mimeType}
          sizeBytes={uploadingItem.sizeBytes}
          kind={uploadingItem.kind}
          previewUrl={uploadingItem.previewUrl}
          uploading
        />
      ) : null}
      {items.map((item) => (
        <AttachmentPreviewRow
          key={item.id}
          fileName={item.fileName}
          mimeType={item.mimeType}
          sizeBytes={item.sizeBytes}
          kind={item.kind}
          previewUrl={item.previewUrl}
          onRemove={() => onRemove(item.id)}
        />
      ))}
    </div>
  );
}
