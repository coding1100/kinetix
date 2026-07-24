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
import { Switch } from "@/components/ui/switch";
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
import { selectActiveWorkspace, useAuthStore } from "@/stores/auth-store";

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
  navigateOnCreate = true,
  onSpaceCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: HierarchyDialogMode | null;
  /** Whether creating a List should navigate to it afterward - true from
   * the Spaces tab (you're already browsing spaces, jumping into the new
   * list is expected), false from the Home tab (creating structure there
   * shouldn't yank you away from Home). */
  navigateOnCreate?: boolean;
  /** Called with the new space's id right after creation, so the caller can
   * "open" it (navigate to it, expand it in a tree, etc.) in whatever way
   * makes sense for that page. */
  onSpaceCreated?: (spaceId: string) => void;
}) {
  const router = useRouter();
  const { accessToken, workspaceId, ready } = useWorkspaceApi();
  const bumpRefresh = useSpacesStore((s) => s.bumpRefresh);
  const workspace = useAuthStore(selectActiveWorkspace);
  const isWorkspaceAdmin =
    workspace?.role === "OWNER" ||
    workspace?.role === "SUPER_ADMIN" ||
    workspace?.role === "ADMIN";
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [isPrivate, setIsPrivate] = useState(false);

  const isEdit = mode?.type.startsWith("edit-") ?? false;
  // Only shown at creation time - once a Space/Folder/List exists, its
  // privacy is toggled from the Share modal instead (ShareModal.tsx),
  // alongside who it's shared with. Only workspace admins can toggle it
  // either way (spaces_service.py's _require_can_manage_access).
  const showPrivateToggle =
    isWorkspaceAdmin &&
    (mode?.type === "space" || mode?.type === "folder" || mode?.type === "list");

  useEffect(() => {
    if (!open || !mode) return;
    if (mode.type === "edit-space" || mode.type === "edit-folder" || mode.type === "edit-list") {
      setName(mode.initialName);
    } else {
      setName("");
      setIsPrivate(false);
    }
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
        const space = await createSpace(accessToken, workspaceId, {
          name: trimmed,
          isPrivate,
        });
        toast.success("Space created");
        onSpaceCreated?.(space.id);
      } else if (mode.type === "folder") {
        await createFolder(accessToken, workspaceId, mode.spaceId, {
          name: trimmed,
          isPrivate,
        });
        toast.success("Folder created");
      } else if (mode.type === "list") {
        const list = await createList(accessToken, workspaceId, mode.spaceId, {
          name: trimmed,
          folderId: mode.folderId,
          isPrivate,
        });
        toast.success("List created");
        if (navigateOnCreate) router.push(`/spaces/l/${list.id}`);
      } else if (mode.type === "edit-space") {
        await patchSpace(accessToken, workspaceId, mode.spaceId, {
          name: trimmed,
        });
        toast.success("Space updated");
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
          {showPrivateToggle ? (
            <div className="flex items-center justify-between gap-3">
              <div>
                <Label htmlFor="hierarchy-private">Make private</Label>
                <p className="text-xs text-muted-foreground">
                  Only people you explicitly add can access a private space.
                </p>
              </div>
              <Switch
                id="hierarchy-private"
                checked={isPrivate}
                onCheckedChange={setIsPrivate}
              />
            </div>
          ) : null}
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
