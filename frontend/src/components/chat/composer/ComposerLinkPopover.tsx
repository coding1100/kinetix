"use client";

import { useEffect, useRef, useState } from "react";
import { XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { FormatToolbarPosition } from "@/hooks/use-composer-format";

export function ComposerLinkPopover({
  position,
  onSubmit,
  onClose,
}: {
  position: FormatToolbarPosition;
  onSubmit: (url: string) => void;
  onClose: () => void;
}) {
  const [url, setUrl] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => window.clearTimeout(timer);
  }, []);

  const submit = () => {
    const trimmed = url.trim();
    if (!trimmed) return;
    onSubmit(trimmed);
    setUrl("");
  };

  return (
    <div
      className="pointer-events-none fixed z-[110] -translate-x-1/2 -translate-y-full"
      style={{ top: position.top, left: position.left }}
      role="dialog"
      aria-label="Add hyperlink"
    >
      <div
        className={cn(
          "pointer-events-auto flex w-[min(20rem,calc(100vw-2rem))] items-center gap-1",
          "rounded-lg border border-border bg-card px-2 py-1.5 shadow-md"
        )}
        onMouseDown={(e) => e.preventDefault()}
      >
        <input
          ref={inputRef}
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Paste a link then press enter"
          className="min-w-0 flex-1 border-0 bg-transparent px-1 text-sm text-foreground outline-none placeholder:text-muted-foreground"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              submit();
            }
            if (e.key === "Escape") {
              e.preventDefault();
              onClose();
            }
          }}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="size-6 shrink-0 text-muted-foreground hover:text-foreground"
          aria-label="Close"
          onClick={onClose}
        >
          <XIcon className="size-3.5" strokeWidth={2} />
        </Button>
      </div>
    </div>
  );
}
