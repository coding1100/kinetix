"use client";

import { useMemo, useState } from "react";
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
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { CheckIcon } from "lucide-react";
import { useWorkspaceApi } from "@/hooks/use-workspace-api";
import { useHomeQuery } from "@/hooks/use-home-query";
import {
  addChannelMembers,
  fetchWorkspaceMembers,
} from "@/lib/api/chat";
import { useAuthStore } from "@/stores/auth-store";
import { cn } from "@/lib/utils";
import {
  avatarColorClassForKey,
  avatarInitialFromName,
} from "@/lib/user-display";
import { toast } from "sonner";
import { mergeChannelMembersIntoCache } from "@/lib/chat/channel-members-cache";

type Props = {
  channelId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingMemberIds: string[];
  onAdded?: () => void;
};

export function AddChannelMembersDialog({
  channelId,
  open,
  onOpenChange,
  existingMemberIds,
  onAdded,
}: Props) {
  const { accessToken, workspaceId, ready } = useWorkspaceApi();
  const currentUserId = useAuthStore((s) => s.user?.id);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);

  const membersQuery = useHomeQuery(
    (token, ws) => fetchWorkspaceMembers(token, ws).then((r) => r.data),
    []
  );

  const existingSet = useMemo(
    () => new Set(existingMemberIds),
    [existingMemberIds]
  );

  const candidates = useMemo(() => {
    const members = (membersQuery.data ?? []).filter(
      (m) => !existingSet.has(m.id)
    );
    const q = query.trim().toLowerCase();
    if (!q) return members;
    return members.filter(
      (m) =>
        m.fullName.toLowerCase().includes(q) ||
        m.email.toLowerCase().includes(q)
    );
  }, [membersQuery.data, existingSet, query]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleClose = (next: boolean) => {
    if (!next) {
      setQuery("");
      setSelected(new Set());
    }
    onOpenChange(next);
  };

  const handleAdd = async () => {
    if (!ready || selected.size === 0) return;
    setSubmitting(true);
    try {
      const res = await addChannelMembers(
        accessToken,
        workspaceId,
        channelId,
        [...selected]
      );
      if (res.added === 0) {
        mergeChannelMembersIntoCache(workspaceId, channelId, res.data);
        onAdded?.();
        toast.info("Selected people are already in this channel");
        handleClose(false);
        return;
      }
      mergeChannelMembersIntoCache(workspaceId, channelId, res.data);
      toast.success(
        res.added === 1 ? "1 person added" : `${res.added} people added`
      );
      handleClose(false);
      onAdded?.();
    } catch {
      toast.error("Failed to add people");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add people</DialogTitle>
          <DialogDescription>
            Choose workspace members to add to this channel.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="add-members-search">Search</Label>
          <Input
            id="add-members-search"
            placeholder="Name or email"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <ul className="max-h-56 space-y-0.5 overflow-y-auto rounded-lg border border-border p-1">
          {membersQuery.loading && (
            <li className="px-2 py-4 text-sm text-muted-foreground">Loading…</li>
          )}
          {!membersQuery.loading && candidates.length === 0 && (
            <li className="px-2 py-4 text-sm text-muted-foreground">
              Everyone in the workspace is already in this channel.
            </li>
          )}
          {candidates.map((m) => (
            <li key={m.id}>
              <button
                type="button"
                className={cn(
                  "flex w-full items-center gap-3 rounded-md px-2 py-2 text-left hover:bg-muted/50",
                  selected.has(m.id) && "bg-primary/5",
                  m.id === currentUserId && "opacity-70"
                )}
                onClick={() => toggle(m.id)}
              >
                <span
                  className={cn(
                    "flex size-4 shrink-0 items-center justify-center rounded border border-border",
                    selected.has(m.id) && "border-primary bg-primary text-primary-foreground"
                  )}
                >
                  {selected.has(m.id) ? (
                    <CheckIcon className="size-3" strokeWidth={3} />
                  ) : null}
                </span>
                <Avatar className="size-8">
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
              </button>
            </li>
          ))}
        </ul>
        <DialogFooter>
          <Button variant="outline" onClick={() => handleClose(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleAdd}
            disabled={selected.size === 0}
            loading={submitting}
            loadingText={`Adding${selected.size > 0 ? ` (${selected.size})` : ""}…`}
          >
            Add {selected.size > 0 ? `(${selected.size})` : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
