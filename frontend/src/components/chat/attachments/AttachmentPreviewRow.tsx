"use client";

import {
  FileIcon,
  FileTextIcon,
  VideoIcon,
  MicIcon,
  XIcon,
  DownloadIcon,
} from "lucide-react";
import type { AttachmentKind } from "@/lib/types/chat";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

function formatBytes(bytes?: number) {
  if (bytes == null) return null;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function kindLabel(kind: AttachmentKind) {
  if (kind === "clip") return "Screen clip";
  if (kind === "doc") return "Document";
  if (kind === "video") return "Video";
  if (kind === "audio") return "Audio";
  return "File";
}

function kindIcon(kind: AttachmentKind) {
  if (kind === "doc") return FileTextIcon;
  if (kind === "video" || kind === "clip") return VideoIcon;
  if (kind === "audio") return MicIcon;
  return FileIcon;
}

export function AttachmentPreviewRow({
  fileName,
  mimeType,
  sizeBytes,
  kind,
  previewUrl,
  downloadUrl,
  uploading,
  onRemove,
  className,
}: {
  fileName: string;
  mimeType?: string;
  sizeBytes?: number;
  kind: AttachmentKind;
  previewUrl?: string | null;
  downloadUrl?: string | null;
  uploading?: boolean;
  onRemove?: () => void;
  className?: string;
}) {
  const Icon = kindIcon(kind);
  const imageSrc = previewUrl ?? downloadUrl;
  const isImage = Boolean(mimeType?.startsWith("image/") && imageSrc);
  const sizeLabel = formatBytes(sizeBytes);
  const description = [kindLabel(kind), sizeLabel].filter(Boolean).join(" · ");

  const thumb = (
    <div className="flex size-[70px] shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-muted/40">
      {uploading ? (
        <Spinner size="sm" label="Uploading" className="text-primary" />
      ) : isImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageSrc!}
          alt={fileName}
          className="size-full object-cover"
        />
      ) : (
        <Icon className="size-6 text-muted-foreground" strokeWidth={1.5} />
      )}
    </div>
  );

  return (
    <div
      className={cn(
        "flex w-full max-w-md items-stretch gap-3 rounded-lg border border-border bg-muted/15 p-2",
        uploading && "border-dashed border-primary/40 bg-primary/5",
        className
      )}
    >
      {downloadUrl && !uploading ? (
        <a
          href={downloadUrl}
          target="_blank"
          rel="noreferrer"
          className="shrink-0"
        >
          {thumb}
        </a>
      ) : (
        thumb
      )}

      <div className="flex min-w-0 flex-1 flex-col justify-center gap-0.5 py-0.5">
        <p className="line-clamp-2 text-sm font-medium leading-snug text-foreground">
          {fileName}
        </p>
        <p className="text-xs text-muted-foreground">
          {uploading ? "Uploading…" : description}
        </p>
      </div>

      <div className="flex shrink-0 flex-col items-end justify-between gap-1">
        {onRemove ? (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="size-7"
            aria-label={`Remove ${fileName}`}
            onClick={onRemove}
            disabled={uploading}
          >
            <XIcon className="size-4" />
          </Button>
        ) : downloadUrl ? (
          <Button
            variant="ghost"
            size="icon-sm"
            className="size-7"
            nativeButton={false}
            render={
              <a
                href={downloadUrl}
                target="_blank"
                rel="noreferrer"
                download={fileName}
              />
            }
            aria-label={`Download ${fileName}`}
          >
            <DownloadIcon className="size-4" />
          </Button>
        ) : null}
      </div>
    </div>
  );
}
