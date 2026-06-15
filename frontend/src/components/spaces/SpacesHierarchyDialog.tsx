"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  createSpace,
  createFolder,
  createList,
  patchSpace,
  patchFolder,
  patchList,
} from "@/lib/api/spaces";
import { useWorkspaceApi } from "@/hooks/use-workspace-api";
import { useSpacesStore } from "@/stores/spaces-store";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

export type HierarchyDialogMode =
  | { type: "space" }
  | { type: "folder"; spaceId: string }
  | { type: "list"; spaceId: string; folderId?: string }
  | { type: "edit-space"; spaceId: string; initialName: string }
  | { type: "edit-folder"; folderId: string; initialName: string }
  | { type: "edit-list"; listId: string; initialName: string };

export function SpacesHierarchyDialog({
  open,
  onOpenChange,
  mode,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: HierarchyDialogMode | null;
}) {
  const router = useRouter();
  const { accessToken, workspaceId, ready } = useWorkspaceApi();
  const bumpRefresh = useSpacesStore((s) => s.bumpRefresh);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  const isEdit = mode?.type.startsWith("edit-") ?? false;

  useEffect(() => {
    if (!open || !mode) return;
    if (mode.type === "edit-space") setName(mode.initialName);
    else if (mode.type === "edit-folder") setName(mode.initialName);
    else if (mode.type === "edit-list") setName(mode.initialName);
    else setName("");
  }, [open, mode]);

  const title =
    mode?.type === "space"
      ? "New space"
      : mode?.type === "folder"
        ? "New folder"
        : mode?.type === "list"
          ? "New list"
          : mode?.type === "edit-space"
            ? "Rename space"
            : mode?.type === "edit-folder"
              ? "Rename folder"
              : mode?.type === "edit-list"
                ? "Rename list"
                : "";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || !mode || !ready || !accessToken || !workspaceId) return;
    setSaving(true);
    try {
      if (mode.type === "space") {
        await createSpace(accessToken, workspaceId, { name: trimmed });
        toast.success("Space created");
      } else if (mode.type === "folder") {
        await createFolder(accessToken, workspaceId, mode.spaceId, {
          name: trimmed,
        });
        toast.success("Folder created");
      } else if (mode.type === "list") {
        const list = await createList(accessToken, workspaceId, mode.spaceId, {
          name: trimmed,
          folderId: mode.folderId,
        });
        toast.success("List created");
        router.push(`/spaces/l/${list.id}`);
      } else if (mode.type === "edit-space") {
        await patchSpace(accessToken, workspaceId, mode.spaceId, {
          name: trimmed,
        });
        toast.success("Space renamed");
      } else if (mode.type === "edit-folder") {
        await patchFolder(accessToken, workspaceId, mode.folderId, {
          name: trimmed,
        });
        toast.success("Folder renamed");
      } else if (mode.type === "edit-list") {
        await patchList(accessToken, workspaceId, mode.listId, {
          name: trimmed,
        });
        toast.success("List renamed");
      }
      bumpRefresh();
      setName("");
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) setName("");
        onOpenChange(v);
      }}
    >
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="hierarchy-name">Name</Label>
            <Input
              id="hierarchy-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Name"
              autoFocus
            />
          </div>
          <Button
            type="submit"
            className="w-full"
            disabled={!name.trim()}
            loading={saving}
            loadingText={isEdit ? "Saving…" : "Creating…"}
          >
            {isEdit ? "Save" : "Create"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
