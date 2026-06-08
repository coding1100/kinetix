"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  FileIcon,
  FileTextIcon,
  ImageIcon,
  PaperclipIcon,
  SearchIcon,
  VideoIcon,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useUiStore } from "@/stores/ui-store";
import { getChannelById } from "@/lib/mocks/channel-details";
import { useChannelFiles } from "@/hooks/use-channel-files";
import type { AttachmentKind, MessageAttachment } from "@/lib/types/chat";

function FileKindIcon({ file }: { file: MessageAttachment }) {
  if (file.mimeType.startsWith("image/")) {
    return <ImageIcon className="size-4" />;
  }
  if (file.kind === "doc") return <FileTextIcon className="size-4" />;
  if (file.kind === "video" || file.kind === "clip") {
    return <VideoIcon className="size-4" />;
  }
  return <FileIcon className="size-4" />;
}

function kindLabel(kind: AttachmentKind) {
  if (kind === "clip") return "Screen clip";
  if (kind === "doc") return "Doc";
  return kind;
}

export function ChannelFilesDialog() {
  const { activeModal, closeModal, modalChannelId } = useUiStore();
  const [query, setQuery] = useState("");
  const open = activeModal === "channel-files";
  const channel = modalChannelId ? getChannelById(modalChannelId) : null;
  const { files, loading } = useChannelFiles(open ? modalChannelId : null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return files;
    return files.filter((f) => f.fileName.toLowerCase().includes(q));
  }, [files, query]);

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          setQuery("");
          closeModal();
        }
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            Files{channel ? ` · #${channel.name}` : ""}
          </DialogTitle>
        </DialogHeader>
        <div className="relative">
          <SearchIcon className="absolute top-2.5 left-2.5 size-4 text-muted-foreground" />
          <Input
            placeholder="Search files"
            className="pl-8"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <ul className="max-h-72 space-y-1 overflow-y-auto">
          {loading ? (
            <li className="py-8 text-center text-sm text-muted-foreground">
              Loading files…
            </li>
          ) : null}
          {!loading &&
            filtered.map((file) => (
              <li key={file.id}>
                <a
                  href={file.downloadUrl ?? undefined}
                  target="_blank"
                  rel="noreferrer"
                  className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-muted/50"
                >
                  <span className="flex size-9 items-center justify-center rounded-lg border border-border bg-muted/40 text-muted-foreground">
                    <FileKindIcon file={file} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">
                      {file.fileName}
                    </span>
                    <span className="text-xs capitalize text-muted-foreground">
                      {kindLabel(file.kind)}
                    </span>
                  </span>
                </a>
              </li>
            ))}
          {!loading && filtered.length === 0 ? (
            <li className="py-8 text-center text-sm text-muted-foreground">
              {files.length === 0
                ? "No files shared in this channel yet."
                : "No files match your search."}
            </li>
          ) : null}
        </ul>
        <Button variant="outline" className="w-full" onClick={closeModal}>
          Close
        </Button>
      </DialogContent>
    </Dialog>
  );
}
