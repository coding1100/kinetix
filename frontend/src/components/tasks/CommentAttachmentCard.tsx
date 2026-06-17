"use client";

import { useState } from "react";
import {
  FileIcon,
  FileTextIcon,
  VideoIcon,
  DownloadIcon,
  XIcon,
  ZoomInIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { TaskAttachment } from "@/lib/types/task";

function formatBytes(bytes?: number) {
  if (bytes == null) return null;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fileIcon(mimeType: string) {
  if (mimeType.startsWith("video/")) return VideoIcon;
  if (mimeType === "application/pdf" || mimeType.includes("text")) return FileTextIcon;
  return FileIcon;
}

function ImageLightbox({
  open,
  onClose,
  src,
  fileName,
  downloadUrl,
}: {
  open: boolean;
  onClose: () => void;
  src: string;
  fileName: string;
  downloadUrl?: string | null;
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
        <DialogContent
          showCloseButton={false}
          className="flex h-[min(96dvh,96dvh)] w-[min(96dvw,1600px)] max-h-[96dvh] max-w-[min(96dvw,1600px)] flex-col gap-0 overflow-hidden border-0 bg-black/95 p-0 sm:max-w-[min(96dvw,1600px)]"
        >
        <DialogTitle className="sr-only">{fileName}</DialogTitle>
        <div className="flex items-center justify-between gap-2 px-4 py-2 bg-black/60">
          <span className="truncate text-sm font-medium text-white/90">{fileName}</span>
          <div className="flex shrink-0 items-center gap-1">
            {downloadUrl ? (
              <Button
                variant="ghost"
                size="icon-sm"
                className="size-8 text-white/70 hover:text-white hover:bg-white/10"
                nativeButton={false}
                render={
                  <a href={downloadUrl} download={fileName} target="_blank" rel="noreferrer" />
                }
                aria-label="Download"
              >
                <DownloadIcon className="size-4" />
              </Button>
            ) : null}
            <DialogClose
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="size-8 text-white/70 hover:text-white hover:bg-white/10"
                />
              }
              aria-label="Close preview"
            >
              <XIcon className="size-4" />
            </DialogClose>
          </div>
        </div>
        <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto p-3 sm:p-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt={fileName}
            className="max-h-[calc(96dvh-72px)] max-w-full rounded object-contain"
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function CommentAttachmentCard({
  attachment,
  className,
}: {
  attachment: TaskAttachment;
  className?: string;
}) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const isImage = attachment.mimeType?.startsWith("image/");
  const sizeLabel = formatBytes(attachment.sizeBytes);
  const Icon = fileIcon(attachment.mimeType ?? "");

  if (isImage && attachment.downloadUrl) {
    return (
      <>
        <div
          className={cn(
            "group relative w-full max-w-[280px] cursor-pointer overflow-hidden rounded-xl border border-border bg-muted/20 transition-shadow hover:shadow-md",
            className
          )}
          onClick={() => setLightboxOpen(true)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === "Enter" && setLightboxOpen(true)}
          aria-label={`Preview ${attachment.fileName}`}
        >
          {/* Image thumbnail */}
          <div className="relative overflow-hidden bg-muted" style={{ aspectRatio: "16/9" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={attachment.downloadUrl}
              alt={attachment.fileName}
              className="size-full object-cover transition-transform duration-200 group-hover:scale-105"
            />
            {/* Hover overlay */}
            <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/20">
              <ZoomInIcon className="size-6 text-white opacity-0 drop-shadow transition-opacity group-hover:opacity-100" />
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between gap-2 px-3 py-2">
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-foreground">
                {attachment.fileName}
              </p>
              {sizeLabel ? (
                <p className="text-xs text-muted-foreground">{sizeLabel}</p>
              ) : null}
            </div>
            <a
              href={attachment.downloadUrl}
              download={attachment.fileName}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="shrink-0 rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              aria-label={`Download ${attachment.fileName}`}
            >
              <DownloadIcon className="size-3.5" />
            </a>
          </div>
        </div>

        <ImageLightbox
          open={lightboxOpen}
          onClose={() => setLightboxOpen(false)}
          src={attachment.downloadUrl}
          fileName={attachment.fileName}
          downloadUrl={attachment.downloadUrl}
        />
      </>
    );
  }

  // Non-image file — compact row
  return (
    <div
      className={cn(
        "flex w-full max-w-[280px] items-center gap-3 rounded-xl border border-border bg-muted/15 px-3 py-2.5",
        className
      )}
    >
      <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted">
        <Icon className="size-4 text-muted-foreground" strokeWidth={1.5} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium text-foreground">{attachment.fileName}</p>
        {sizeLabel ? (
          <p className="text-xs text-muted-foreground">
            {attachment.mimeType?.includes("pdf") ? "PDF" : "File"} · {sizeLabel}
          </p>
        ) : null}
      </div>
      {attachment.downloadUrl ? (
        <a
          href={attachment.downloadUrl}
          download={attachment.fileName}
          target="_blank"
          rel="noreferrer"
          className="shrink-0 rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          aria-label={`Download ${attachment.fileName}`}
        >
          <DownloadIcon className="size-3.5" />
        </a>
      ) : null}
    </div>
  );
}
