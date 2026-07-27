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
import { useUiStore } from "@/stores/ui-store";
import { useWorkspaceApi } from "@/hooks/use-workspace-api";
import { fetchChannel, updateChannel } from "@/lib/api/chat";
import { ApiError } from "@/lib/api/client";
import { bumpSidebarRefresh, patchSidebarChannel } from "@/lib/chat/sidebar-channel";
import { useChatStore } from "@/stores/chat-store";
import { toast } from "sonner";
import { ChannelIconPicker } from "@/components/chat/channels/ChannelIconPicker";

export function ChangeChannelIconDialog() {
  const { activeModal, modalChannelId, closeModal } = useUiStore();
  const { accessToken, workspaceId, ready } = useWorkspaceApi();
  const channelFromCache = useChatStore((s) =>
    modalChannelId
      ? s.sidebarListsCache?.channels.find((c) => c.id === modalChannelId)
      : undefined
  );

  const open = activeModal === "change-channel-icon" && Boolean(modalChannelId);
  const [channelName, setChannelName] = useState("");
  const [iconColor, setIconColor] = useState<string | null>(null);
  const [initialColor, setInitialColor] = useState<string | null>(null);
  const [icon, setIcon] = useState<string | null>(null);
  const [initialIcon, setInitialIcon] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !modalChannelId) return;
    if (channelFromCache) {
      setChannelName(channelFromCache.name);
      setIconColor(channelFromCache.customIconColor ?? null);
      setInitialColor(channelFromCache.customIconColor ?? null);
      setIcon(channelFromCache.icon ?? null);
      setInitialIcon(channelFromCache.icon ?? null);
      return;
    }
    if (!ready) return;
    let cancelled = false;
    void fetchChannel(accessToken, workspaceId, modalChannelId).then((ch) => {
      if (cancelled) return;
      setChannelName(ch.name);
      setIconColor(ch.customIconColor ?? null);
      setInitialColor(ch.customIconColor ?? null);
      setIcon(ch.icon ?? null);
      setInitialIcon(ch.icon ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, [open, modalChannelId, channelFromCache, ready, accessToken, workspaceId]);

  const handleClose = () => {
    closeModal();
    setChannelName("");
    setIconColor(null);
    setInitialColor(null);
    setIcon(null);
    setInitialIcon(null);
  };

  const handleSave = async () => {
    if (!ready || !modalChannelId) return;
    if (iconColor === initialColor && icon === initialIcon) {
      handleClose();
      return;
    }
    setSaving(true);
    try {
      const updated = await updateChannel(accessToken, workspaceId, modalChannelId, {
        iconColor: iconColor ?? "",
        icon: icon ?? "",
      });
      patchSidebarChannel(modalChannelId, {
        customIconColor: updated.customIconColor,
        icon: updated.icon,
      });
      bumpSidebarRefresh();
      toast.success("Channel icon updated");
      handleClose();
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Failed to update channel icon"
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Change icon</DialogTitle>
        </DialogHeader>
        <ChannelIconPicker
          value={iconColor}
          onChange={setIconColor}
          icon={icon}
          onIconChange={setIcon}
          channelInitial={(channelName.trim() || "#").slice(0, 1).toUpperCase()}
        />
        <DialogFooter>
          <Button type="button" variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            type="button"
            loading={saving}
            loadingText="Saving…"
            onClick={() => void handleSave()}
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
