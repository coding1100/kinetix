"use client";

import type { MessageAttachment } from "@/lib/types/chat";
import { AttachmentPreviewRow } from "@/components/chat/attachments/AttachmentPreviewRow";
import { cn } from "@/lib/utils";

function isImageAttachment(att: MessageAttachment) {
  return Boolean(att.mimeType?.startsWith("image/") && att.downloadUrl);
}

export function MessageAttachmentList({
  attachments,
  className,
}: {
  attachments: MessageAttachment[];
  className?: string;
}) {
  if (!attachments.length) return null;

  const images = attachments.filter(isImageAttachment);
  const files = attachments.filter((att) => !isImageAttachment(att));

  return (
    <div className={cn("mt-2 space-y-2", className)}>
      {images.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {images.map((att) => (
            <a
              key={att.id}
              href={att.downloadUrl!}
              target="_blank"
              rel="noreferrer"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={att.downloadUrl!}
                alt={att.fileName}
                className="max-h-72 max-w-xs rounded-lg object-cover"
              />
            </a>
          ))}
        </div>
      ) : null}
      {files.map((att) => (
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
