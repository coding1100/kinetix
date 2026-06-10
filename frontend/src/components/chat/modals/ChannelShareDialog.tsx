"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useUiStore } from "@/stores/ui-store";
import { useChatStore } from "@/stores/chat-store";
import { getChannelById } from "@/lib/mocks/channel-details";
import { useChannelMembers } from "@/hooks/use-channel-members";
import type { Channel } from "@/lib/types/chat";
import { AddChannelMembersDialog } from "@/components/chat/modals/AddChannelMembersDialog";
import {
  avatarColorClassForKey,
  avatarInitialFromName,
} from "@/lib/user-display";
import { useWorkspaceApi } from "@/hooks/use-workspace-api";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth-store";

function accessPermission(role?: string | null) {
  if (role === "OWNER" || role === "ADMIN") return "admin";
  return "member";
}

export function ChannelShareDialog() {
  const { workspaceId } = useWorkspaceApi();
  const workspaceRole = useAuthStore((s) =>
    s.workspaces.find((w) => w.id === workspaceId)?.role
  );
  const canAddToAccess = workspaceRole === "OWNER";
  const { activeModal, closeModal, modalChannelId } = useUiStore();
  const channelFromStore = useChatStore((s) =>
    modalChannelId
      ? s.sidebarListsCache?.channels.find(
          (c: Channel) => c.id === modalChannelId
        )
      : undefined
  );
  const open = activeModal === "channel-share";
  const channelId = modalChannelId ?? "";
  const channel = channelFromStore ?? (channelId ? getChannelById(channelId) : null);
  const [addOpen, setAddOpen] = useState(false);
  const { members, loading, reload } = useChannelMembers(channelId, {
    enabled: open && !!channelId,
  });

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => !o && closeModal()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              Sharing & permissions
              {channel ? ` · #${channel.name}` : ""}
            </DialogTitle>
            <DialogDescription>
              People who can view and post in this channel.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-56 space-y-1 overflow-y-auto rounded-lg border border-border p-2">
            <p className="px-1 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
              People with access ({members.length})
            </p>
            {loading && (
              <p className="px-1 py-2 text-sm text-muted-foreground">Loading…</p>
            )}
            {members.map((u) => (
              <div
                key={u.id}
                className="flex items-center gap-2 rounded-md px-1 py-1.5"
              >
                <Avatar className="size-7">
                  <AvatarFallback
                    className={cn(
                      "text-[10px] font-semibold",
                      avatarColorClassForKey(u.id, u.fullName)
                    )}
                  >
                    {avatarInitialFromName(u.fullName)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{u.fullName}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {u.email}
                  </p>
                </div>
                <Badge variant="outline" className="h-5 px-1.5 text-[10px] capitalize">
                  {accessPermission(u.workspaceRole)}
                </Badge>
              </div>
            ))}
          </div>
          <DialogFooter className="gap-2 sm:justify-between">
            <Button variant="outline" onClick={closeModal}>
              Close
            </Button>
            {canAddToAccess ? (
              <Button onClick={() => setAddOpen(true)} disabled={!channelId}>
                Add people
              </Button>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {channelId ? (
        <AddChannelMembersDialog
          channelId={channelId}
          open={addOpen}
          onOpenChange={setAddOpen}
          existingMemberIds={members.map((m) => m.id)}
          onAdded={reload}
        />
      ) : null}
    </>
  );
}
