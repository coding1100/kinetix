"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { XIcon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useUiStore } from "@/stores/ui-store";
import { useWorkspaceApi } from "@/hooks/use-workspace-api";
import { useHomeQuery } from "@/hooks/use-home-query";
import { createDm, fetchWorkspaceMembers } from "@/lib/api/chat";
import { useAuthStore } from "@/stores/auth-store";
import { toast } from "sonner";
import {
  avatarColorClassForKey,
  avatarInitialFromName,
} from "@/lib/user-display";
import { upsertDmInSidebar } from "@/lib/chat/sidebar-dm";
import { cn } from "@/lib/utils";

export function NewDmDialog() {
  const router = useRouter();
  const { activeModal, closeModal } = useUiStore();
  const { accessToken, workspaceId, ready } = useWorkspaceApi();
  const currentUserId = useAuthStore((s) => s.user?.id);
  const [query, setQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [groupName, setGroupName] = useState("");
  const [creating, setCreating] = useState(false);
  const open = activeModal === "new-dm";

  const membersQuery = useHomeQuery(
    (token, ws) => fetchWorkspaceMembers(token, ws).then((r) => r.data),
    []
  );

  const members = useMemo(
    () => (membersQuery.data ?? []).filter((m) => m.id !== currentUserId),
    [membersQuery.data, currentUserId]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return members;
    return members.filter(
      (m) =>
        m.fullName.toLowerCase().includes(q) ||
        m.email.toLowerCase().includes(q)
    );
  }, [members, query]);

  const selectedMembers = useMemo(
    () => members.filter((m) => selectedIds.has(m.id)),
    [members, selectedIds]
  );

  const isGroup = selectedIds.size >= 2;

  const reset = () => {
    setQuery("");
    setSelectedIds(new Set());
    setGroupName("");
  };

  const toggleUser = (userId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        next.add(userId);
      }
      return next;
    });
  };

  const removeSelected = (userId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.delete(userId);
      return next;
    });
  };

  const startConversation = async () => {
    if (!ready || selectedIds.size === 0) return;
    setCreating(true);
    try {
      const userIds = Array.from(selectedIds);
      const name =
        isGroup && groupName.trim() ? groupName.trim() : undefined;
      const dm = await createDm(accessToken, workspaceId, userIds, name);
      upsertDmInSidebar(dm, workspaceId);
      closeModal();
      reset();
      router.push(`/chat/dm/${dm.id}`);
    } catch {
      toast.error("Failed to start conversation");
    } finally {
      setCreating(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          reset();
          closeModal();
        }
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New direct message</DialogTitle>
        </DialogHeader>

        {selectedMembers.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {selectedMembers.map((m) => (
              <span
                key={m.id}
                className="inline-flex max-w-full items-center gap-1 rounded-full border border-border bg-muted/40 py-0.5 pl-1 pr-1.5 text-xs"
              >
                <Avatar className="size-5">
                  <AvatarFallback
                    className={cn(
                      "text-[10px] font-semibold",
                      avatarColorClassForKey(m.id, m.fullName)
                    )}
                  >
                    {avatarInitialFromName(m.fullName)}
                  </AvatarFallback>
                </Avatar>
                <span className="max-w-[8rem] truncate font-medium">
                  {m.fullName}
                </span>
                <button
                  type="button"
                  className="rounded-full p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                  aria-label={`Remove ${m.fullName}`}
                  onClick={() => removeSelected(m.id)}
                >
                  <XIcon className="size-3" />
                </button>
              </span>
            ))}
          </div>
        ) : null}

        {isGroup ? (
          <div className="space-y-2">
            <Label htmlFor="dm-group-name">Group name (optional)</Label>
            <Input
              id="dm-group-name"
              placeholder="Group chat"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
            />
          </div>
        ) : null}

        <div className="space-y-2">
          <Label htmlFor="dm-search">Search people</Label>
          <Input
            id="dm-search"
            placeholder="Name or email"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        <ul className="max-h-64 space-y-0.5 overflow-y-auto">
          {membersQuery.loading && (
            <li className="px-2 py-4 text-sm text-muted-foreground">
              Loading…
            </li>
          )}
          {!membersQuery.loading && filtered.length === 0 ? (
            <li className="px-2 py-4 text-sm text-muted-foreground">
              No people found
            </li>
          ) : null}
          {filtered.map((m) => {
            const checked = selectedIds.has(m.id);
            return (
              <li key={m.id}>
                <label
                  className={cn(
                    "flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-muted/50",
                    checked && "bg-primary/5"
                  )}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleUser(m.id)}
                    className="size-4 shrink-0 accent-primary"
                    aria-label={`Select ${m.fullName}`}
                  />
                  <Avatar className="size-8 shrink-0">
                    <AvatarFallback
                      className={cn(
                        "text-xs font-semibold",
                        avatarColorClassForKey(m.id, m.fullName)
                      )}
                    >
                      {avatarInitialFromName(m.fullName)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">
                      {m.fullName}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {m.email}
                    </span>
                  </span>
                </label>
              </li>
            );
          })}
        </ul>

        <DialogFooter className="gap-2 sm:justify-between">
          <span className="text-xs text-muted-foreground">
            {selectedIds.size === 0
              ? "Select one or more people"
              : `${selectedIds.size} selected`}
          </span>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={creating}
              onClick={() => {
                reset();
                closeModal();
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={selectedIds.size === 0}
              loading={creating}
              onClick={() => void startConversation()}
            >
              {isGroup ? "Create group" : "Start chat"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
