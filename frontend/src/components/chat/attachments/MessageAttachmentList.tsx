"use client";

import type { MessageAttachment } from "@/lib/types/chat";
import { useState } from "react";
import { DownloadIcon, XIcon, ZoomInIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogTitle } from "@/components/ui/dialog";
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
  const [selected, setSelected] = useState<MessageAttachment | null>(null);
  if (!attachments.length) return null;

  const images = attachments.filter(isImageAttachment);
  const files = attachments.filter((att) => !isImageAttachment(att));

  return (
    <div className={cn("mt-2 space-y-2", className)}>
      {images.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {images.map((att) => (
            <button
              key={att.id}
              type="button"
              className="group relative overflow-hidden rounded-lg text-left"
              onClick={() => setSelected(att)}
              aria-label={`Preview ${att.fileName}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={att.downloadUrl!}
                alt={att.fileName}
                className="max-h-72 max-w-xs rounded-lg object-cover"
              />
              <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/20">
                <ZoomInIcon className="size-6 text-white opacity-0 drop-shadow transition-opacity group-hover:opacity-100" />
              </span>
            </button>
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
      <Dialog open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent showCloseButton={false} className="flex h-[min(96dvh,96dvh)] w-[min(96dvw,1600px)] max-w-[min(96dvw,1600px)] flex-col gap-0 overflow-hidden border-0 bg-black/95 p-0">
          <DialogTitle className="sr-only">{selected?.fileName ?? "Image preview"}</DialogTitle>
          <div className="flex items-center justify-between gap-2 bg-black/60 px-4 py-2">
            <span className="truncate text-sm font-medium text-white/90">{selected?.fileName}</span>
            <div className="flex items-center gap-1">
              {selected?.downloadUrl ? (
                <Button variant="ghost" size="icon-sm" className="size-8 text-white/80 hover:bg-white/10 hover:text-white" nativeButton={false} render={<a href={selected.downloadUrl} download={selected.fileName} />} aria-label={`Download ${selected.fileName}`}>
                  <DownloadIcon className="size-4" />
                </Button>
              ) : null}
              <DialogClose render={<Button variant="ghost" size="icon-sm" className="size-8 text-white/80 hover:bg-white/10 hover:text-white" />} aria-label="Close preview">
                <XIcon className="size-4" />
              </DialogClose>
            </div>
          </div>
          <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto p-3 sm:p-6">
            {selected?.downloadUrl ? <img src={selected.downloadUrl} alt={selected.fileName} className="max-h-full max-w-full object-contain" /> : null}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
