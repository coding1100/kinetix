"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
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
import { avatarInitialFromName } from "@/lib/user-display";
import { upsertDmInSidebar } from "@/lib/chat/sidebar-dm";

export function NewDmDialog() {
  const router = useRouter();
  const { activeModal, closeModal } = useUiStore();
  const { accessToken, workspaceId, ready } = useWorkspaceApi();
  const currentUserId = useAuthStore((s) => s.user?.id);
  const [query, setQuery] = useState("");
  const [starting, setStarting] = useState<string | null>(null);
  const open = activeModal === "new-dm";

  const membersQuery = useHomeQuery(
    (token, ws) => fetchWorkspaceMembers(token, ws).then((r) => r.data),
    []
  );

  const filtered = useMemo(() => {
    const members = (membersQuery.data ?? []).filter(
      (m) => m.id !== currentUserId
    );
    const q = query.trim().toLowerCase();
    if (!q) return members;
    return members.filter(
      (m) =>
        m.fullName.toLowerCase().includes(q) ||
        m.email.toLowerCase().includes(q)
    );
  }, [membersQuery.data, currentUserId, query]);

  const startDm = async (userId: string) => {
    if (!ready) return;
    setStarting(userId);
    try {
      const dm = await createDm(accessToken, workspaceId, [userId]);
      upsertDmInSidebar(dm, workspaceId);
      closeModal();
      setQuery("");
      router.push(`/chat/dm/${dm.id}`);
    } catch {
      toast.error("Failed to start conversation");
    } finally {
      setStarting(null);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          setQuery("");
          closeModal();
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New direct message</DialogTitle>
        </DialogHeader>
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
            <li className="px-2 py-4 text-sm text-muted-foreground">Loading…</li>
          )}
          {filtered.map((m) => (
            <li key={m.id}>
              <Button
                type="button"
                variant="ghost"
                loading={starting === m.id}
                className="h-auto w-full justify-start gap-3 rounded-lg px-2 py-2 text-left"
                onClick={() => startDm(m.id)}
              >
                <Avatar className="size-8">
                  <AvatarFallback className="text-xs">
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
              </Button>
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
