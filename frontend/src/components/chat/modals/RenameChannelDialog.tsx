"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useUiStore } from "@/stores/ui-store";
import { useWorkspaceApi } from "@/hooks/use-workspace-api";
import { fetchChannel, updateChannel } from "@/lib/api/chat";
import { ApiError } from "@/lib/api/client";
import {
  bumpSidebarRefresh,
  normalizeChannelNameInput,
  patchSidebarChannel,
} from "@/lib/chat/sidebar-channel";
import { useChatStore } from "@/stores/chat-store";
import { toast } from "sonner";

export function RenameChannelDialog({
  onRenamed,
}: {
  onRenamed?: (channelId: string, name: string) => void;
}) {
  const { activeModal, modalChannelId, closeModal } = useUiStore();
  const { accessToken, workspaceId, ready } = useWorkspaceApi();
  const channelFromCache = useChatStore((s) =>
    modalChannelId
      ? s.sidebarListsCache?.channels.find((c) => c.id === modalChannelId)
      : undefined
  );

  const open = activeModal === "rename-channel" && Boolean(modalChannelId);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !modalChannelId) return;
    if (channelFromCache?.name) {
      setName(channelFromCache.name);
      return;
    }
    if (!ready) return;
    let cancelled = false;
    void fetchChannel(accessToken, workspaceId, modalChannelId)
      .then((ch) => {
        if (!cancelled) setName(ch.name);
      })
      .catch(() => {
        if (!cancelled) setName("");
      });
    return () => {
      cancelled = true;
    };
  }, [open, modalChannelId, channelFromCache?.name, ready, accessToken, workspaceId]);

  const handleClose = () => {
    closeModal();
    setName("");
  };

  const handleSave = async () => {
    if (!ready || !modalChannelId) return;
    const trimmed = normalizeChannelNameInput(name);
    if (!trimmed) {
      toast.error("Channel name is required");
      return;
    }
    if (trimmed === channelFromCache?.name) {
      handleClose();
      return;
    }

    setSaving(true);
    try {
      const updated = await updateChannel(
        accessToken,
        workspaceId,
        modalChannelId,
        { name: trimmed }
      );
      patchSidebarChannel(modalChannelId, { name: updated.name });
      bumpSidebarRefresh();
      onRenamed?.(modalChannelId, updated.name);
      toast.success(`Channel renamed to #${updated.name}`);
      handleClose();
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Failed to rename channel"
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Rename channel</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="rename-channel-name">Channel name</Label>
          <div className="relative">
            <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted-foreground">
              #
            </span>
            <Input
              id="rename-channel-name"
              className="pl-7"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="product"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") void handleSave();
              }}
            />
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            type="button"
            loading={saving}
            loadingText="Saving…"
            disabled={!normalizeChannelNameInput(name)}
            onClick={() => void handleSave()}
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
