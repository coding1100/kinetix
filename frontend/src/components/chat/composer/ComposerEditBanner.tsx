"use client";

import { PencilIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ComposerEditBanner({ onCancel }: { onCancel: () => void }) {
  return (
    <div className="flex items-center justify-between gap-2 border-b border-border bg-muted/30 px-3 py-1.5">
      <span className="flex min-w-0 items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <PencilIcon className="size-3.5 shrink-0" strokeWidth={2} />
        Editing message
      </span>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-6 shrink-0 px-2 text-xs text-muted-foreground"
        onClick={onCancel}
      >
        <XIcon className="mr-1 size-3" />
        Cancel
      </Button>
    </div>
  );
}
