"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useUiStore } from "@/stores/ui-store";
import { getChannelById } from "@/lib/mocks/channel-details";
import { toast } from "sonner";

export function SyncUpDialog() {
  const { activeModal, closeModal, modalChannelId } = useUiStore();
  const open = activeModal === "syncup";
  const channel = modalChannelId ? getChannelById(modalChannelId) : null;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && closeModal()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>
            SyncUp{channel ? ` · #${channel.name}` : ""}
          </DialogTitle>
          <DialogDescription>
            Start a quick voice or video huddle with channel members. Mock UI
            only.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 rounded-lg border border-border p-3">
          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="syncup-video" className="text-sm">
              Start with video
            </Label>
            <Switch id="syncup-video" defaultChecked />
          </div>
          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="syncup-record" className="text-sm">
              Record session
            </Label>
            <Switch id="syncup-record" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={closeModal}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              toast.success("SyncUp started (mock)");
              closeModal();
            }}
          >
            Start SyncUp
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
