"use client";

import { BoxesIcon, FolderPlusIcon, ListPlusIcon, PlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

interface EmptySpacesStateProps {
  onCreateSpace?: () => void;
  onCreateFolder?: () => void;
  onCreateList?: () => void;
  title?: string;
  description?: string;
}

export function EmptySpacesState({
  onCreateSpace,
  onCreateFolder,
  onCreateList,
  title = "No lists in this space",
  description = "Organize your team's work by creating spaces, folders, and lists.",
}: EmptySpacesStateProps) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center p-8 text-center animate-in fade-in-50 duration-200">
      <div className="flex size-16 items-center justify-center rounded-2xl border border-border bg-muted/30 shadow-xs">
        <BoxesIcon className="size-8 text-muted-foreground" />
      </div>
      <h3 className="mt-4 text-lg font-semibold tracking-tight">{title}</h3>
      <p className="mt-1.5 max-w-sm text-sm text-muted-foreground leading-relaxed">
        {description}
      </p>

      <div className="mt-6 flex flex-wrap items-center justify-center gap-2.5">
        {onCreateList ? (
          <Button onClick={onCreateList} size="sm" className="gap-1.5 shadow-xs">
            <ListPlusIcon className="size-4" />
            Create List
          </Button>
        ) : null}

        {onCreateFolder ? (
          <Button
            onClick={onCreateFolder}
            variant="outline"
            size="sm"
            className="gap-1.5 shadow-xs"
          >
            <FolderPlusIcon className="size-4" />
            Create Folder
          </Button>
        ) : null}

        {onCreateSpace ? (
          <Button
            onClick={onCreateSpace}
            variant="outline"
            size="sm"
            className="gap-1.5 shadow-xs"
          >
            <PlusIcon className="size-4" />
            Create Space
          </Button>
        ) : null}
      </div>
    </div>
  );
}
