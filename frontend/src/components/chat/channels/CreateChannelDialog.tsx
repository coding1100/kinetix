"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
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
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useUiStore } from "@/stores/ui-store";
import { useWorkspaceApi } from "@/hooks/use-workspace-api";
import { useHomeQuery } from "@/hooks/use-home-query";
import { createChannel, fetchWorkspaceMembers } from "@/lib/api/chat";
import { useAuthStore } from "@/stores/auth-store";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { CheckIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { ApiError } from "@/lib/api/client";
import {
  avatarColorClassForKey,
  avatarInitialFromName,
} from "@/lib/user-display";
import { MessageSquareIcon } from "lucide-react";
import { upsertChannelInSidebar } from "@/lib/chat/sidebar-channel";

export function CreateChannelDialog() {
  const router = useRouter();
  const { activeModal, closeModal } = useUiStore();
  const { accessToken, workspaceId, ready } = useWorkspaceApi();
  const open = activeModal === "new-channel";

  const [name, setName] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [addList, setAddList] = useState(false);
  const [creating, setCreating] = useState(false);
  const [inviteIds, setInviteIds] = useState<Set<string>>(new Set());
  const currentUserId = useAuthStore((s) => s.user?.id);

  const membersQuery = useHomeQuery(
    (token, ws) => fetchWorkspaceMembers(token, ws).then((r) => r.data),
    []
  );

  const inviteCandidates = useMemo(() => {
    return (membersQuery.data ?? []).filter((m) => m.id !== currentUserId);
  }, [membersQuery.data, currentUserId]);

  const toggleInvite = (id: string) => {
    setInviteIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const reset = () => {
    setName("");
    setIsPrivate(false);
    setAddList(false);
    setInviteIds(new Set());
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      closeModal();
      reset();
    }
  };

  const handleCreate = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error("Channel name is required");
      return;
    }
    if (!ready) {
      toast.error("Workspace is still loading. Try again in a moment.");
      return;
    }

    setCreating(true);
    try {
      const channel = await createChannel(accessToken, workspaceId, {
        name: trimmed,
        isPrivate,
        topic: addList ? "Linked list enabled" : undefined,
        memberIds:
          isPrivate && inviteIds.size > 0 ? [...inviteIds] : undefined,
      });
      upsertChannelInSidebar({ ...channel, starred: false }, workspaceId);
      toast.success(`#${trimmed} created`);
      closeModal();
      reset();
      router.push(`/chat/c/${channel.id}`);
    } catch (err) {
      toast.error(
        err instanceof ApiError
          ? err.message
          : "Failed to create channel"
      );
    } finally {
      setCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-lg">
        <div className="space-y-4 p-6 pb-4">
          <DialogHeader className="gap-1.5 text-left">
            <DialogTitle className="text-lg font-semibold">Create Channel</DialogTitle>
            <DialogDescription>
              Chat Channels are where conversations happen. Use a name that is easy
              to find and understand.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="channel-name">
              Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="channel-name"
              placeholder="e.g. Ideas"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="focus-visible:ring-[0.5px]"
            />
          </div>

          <div className="flex items-center justify-between gap-4 py-1">
            <div className="space-y-0.5">
              <p className="text-sm font-medium">Make Private</p>
              <p className="text-xs text-muted-foreground">
                Only you and invited members have access
              </p>
            </div>
            <Switch
              checked={isPrivate}
              onCheckedChange={(v) => {
                setIsPrivate(v);
                if (!v) setInviteIds(new Set());
              }}
            />
          </div>

          {isPrivate ? (
            <div className="space-y-2 rounded-lg border border-border p-3">
              <p className="text-sm font-medium">Invite members</p>
              <p className="text-xs text-muted-foreground">
                You are included automatically. Select others to add.
              </p>
              <ul className="max-h-36 space-y-0.5 overflow-y-auto">
                {inviteCandidates.map((m) => (
                  <li key={m.id}>
                    <button
                      type="button"
                      className={cn(
                        "flex w-full items-center gap-2 rounded-md px-1 py-1.5 text-left hover:bg-muted/50",
                        inviteIds.has(m.id) && "bg-primary/5"
                      )}
                      onClick={() => toggleInvite(m.id)}
                    >
                      <span
                        className={cn(
                          "flex size-4 shrink-0 items-center justify-center rounded border border-border",
                          inviteIds.has(m.id) &&
                            "border-primary bg-primary text-primary-foreground"
                        )}
                      >
                        {inviteIds.has(m.id) ? (
                          <CheckIcon className="size-3" strokeWidth={3} />
                        ) : null}
                      </span>
                      <Avatar className="size-7">
                        <AvatarFallback
                          className={cn(
                            "text-[10px] font-semibold",
                            avatarColorClassForKey(m.id, m.fullName)
                          )}
                        >
                          {avatarInitialFromName(m.fullName)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="min-w-0 flex-1 truncate text-sm">
                        {m.fullName}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="flex items-center justify-between gap-4 py-1 hidden">
            <div className="space-y-0.5">
              <p className="text-sm font-medium">Add a List</p>
              <p className="text-xs text-muted-foreground">
                Attach a List to manage tasks and work
              </p>
            </div>
            <Switch checked={addList} onCheckedChange={setAddList} />
          </div>
        </div>

        <DialogFooter className="flex-row items-center justify-between border-t bg-background px-4 py-3 sm:justify-between">
          <Button
            type="button"
            variant="outline"
            className="gap-2 invisible"
            onClick={() => toast("Slack import — Phase 2")}
          >
            <MessageSquareIcon className="size-4 text-[#e01e5a]" />
            Import
          </Button>
          <Button
            type="button"
            onClick={handleCreate}
            loading={creating}
            loadingText="Creating…"
          >
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
