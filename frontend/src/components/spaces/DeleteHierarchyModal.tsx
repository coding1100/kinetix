"use client";

import { AlertTriangleIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export type DeleteHierarchyTarget =
  | { kind: "space"; id: string; name: string; folderCount?: number; listCount?: number }
  | { kind: "folder"; id: string; name: string; listCount?: number }
  | { kind: "list"; id: string; name: string; isPersonal?: boolean };

interface DeleteHierarchyModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  target: DeleteHierarchyTarget | null;
  onConfirm: () => Promise<void> | void;
  loading?: boolean;
}

export function DeleteHierarchyModal({
  open,
  onOpenChange,
  target,
  onConfirm,
  loading = false,
}: DeleteHierarchyModalProps) {
  if (!target) return null;

  const itemKindLabel =
    target.kind === "space" ? "Space" : target.kind === "folder" ? "Folder" : "List";

  const title = `Delete ${itemKindLabel} "${target.name}"?`;

  let warningDetail = `Are you sure you want to delete this ${itemKindLabel.toLowerCase()}? This action cannot be undone.`;

  if (target.kind === "space") {
    const details = [];
    if (target.folderCount && target.folderCount > 0) {
      details.push(`${target.folderCount} folder${target.folderCount > 1 ? "s" : ""}`);
    }
    if (target.listCount && target.listCount > 0) {
      details.push(`${target.listCount} list${target.listCount > 1 ? "s" : ""}`);
    }

    if (details.length > 0) {
      warningDetail = `Deleting this space will permanently remove all ${details.join(" and ")} and their contained tasks.`;
    } else {
      warningDetail = "Deleting this space will permanently remove all contained lists and tasks.";
    }
  } else if (target.kind === "folder") {
    if (target.listCount && target.listCount > 0) {
      warningDetail = `Deleting this folder will permanently remove all ${target.listCount} list${target.listCount > 1 ? "s" : ""} and their contained tasks.`;
    } else {
      warningDetail = "Deleting this folder will permanently remove all nested lists and tasks.";
    }
  } else if (target.kind === "list") {
    warningDetail = "Deleting this list will permanently remove all tasks contained in it.";
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="gap-2">
          <div className="flex size-10 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <AlertTriangleIcon className="size-5" />
          </div>
          <DialogTitle className="text-left font-semibold">{title}</DialogTitle>
          <DialogDescription className="text-left text-sm text-muted-foreground leading-relaxed">
            {warningDetail}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={() => void onConfirm()}
            loading={loading}
            loadingText="Deleting…"
          >
            Delete {itemKindLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
