"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useUiStore } from "@/stores/ui-store";
import { useHomeSidebarStore } from "@/stores/home-sidebar-store";
import { CreateChannelDialog } from "@/components/chat/channels/CreateChannelDialog";
import { ChannelShareDialog } from "@/components/chat/modals/ChannelShareDialog";
import { ChannelFilesDialog } from "@/components/chat/modals/ChannelFilesDialog";
import { SyncUpDialog } from "@/components/chat/modals/SyncUpDialog";
import { NewDmDialog } from "@/components/chat/modals/NewDmDialog";
import { RenameChannelDialog } from "@/components/chat/modals/RenameChannelDialog";
import { GlobalCreateTaskDialog } from "@/components/modals/GlobalCreateTaskDialog";

export function Modals() {
  const router = useRouter();
  const { activeModal, closeModal } = useUiStore();

  useEffect(() => {
    if (activeModal === "invite-people") {
      closeModal();
      router.push("/people?invite=1");
    }
  }, [activeModal, closeModal, router]);
  const { items, togglePin, addSection } = useHomeSidebarStore();

  return (
    <>
      <Dialog
        open={activeModal === "customize-home"}
        onOpenChange={(o) => !o && closeModal()}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Customize Home Sidebar</DialogTitle>
            <DialogDescription>
              Pin items to show them in the Home sidebar.
            </DialogDescription>
          </DialogHeader>
          <ul className="max-h-64 space-y-2 overflow-y-auto">
            {items.map((item) => (
              <li
                key={item.id}
                className="flex items-center justify-between rounded-lg border border-border px-3 py-2"
              >
                <span className="text-sm">{item.label}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-primary"
                  onClick={() => togglePin(item.id)}
                >
                  {item.pinned ? "Unpin" : "Pin"}
                </Button>
              </li>
            ))}
          </ul>
          <Button
            variant="link"
            className="px-0"
            onClick={() => {
              addSection("New section");
              toast.success("Section added");
            }}
          >
            + Add section
          </Button>
        </DialogContent>
      </Dialog>

      <GlobalCreateTaskDialog />
      <CreateChannelDialog />
      <ChannelShareDialog />
      <ChannelFilesDialog />
      <SyncUpDialog />
      <NewDmDialog />
      <RenameChannelDialog />

      <Dialog
        open={activeModal === "schedule-message"}
        onOpenChange={(o) => !o && closeModal()}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Schedule message</DialogTitle>
          </DialogHeader>
          <Input type="datetime-local" />
          <DialogFooter>
            <Button
              onClick={() => {
                toast.success("Scheduled (mock)");
                closeModal();
              }}
            >
              Schedule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </>
  );
}
