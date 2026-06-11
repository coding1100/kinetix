"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeftIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageHeader } from "@/components/shared/PageHeader";
import { useWorkspaceApi } from "@/hooks/use-workspace-api";
import { getMe } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import {
  deleteWorkspace,
  fetchWorkspacePeople,
  transferWorkspaceOwnership,
  type WorkspaceMemberRow,
} from "@/lib/api/workspace";
import { resetSessionScopedState } from "@/lib/auth/reset-session-scoped-state";
import { selectActiveWorkspace, useAuthStore } from "@/stores/auth-store";

export function WorkspaceSettingsView() {
  const router = useRouter();
  const { accessToken, workspaceId, ready } = useWorkspaceApi();
  const workspace = useAuthStore(selectActiveWorkspace);
  const user = useAuthStore((s) => s.user);
  const updateSession = useAuthStore((s) => s.updateSession);

  const [members, setMembers] = useState<WorkspaceMemberRow[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(true);
  const [confirmName, setConfirmName] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [transferTargetId, setTransferTargetId] = useState("");
  const [transferring, setTransferring] = useState(false);

  const isOwner = workspace?.role === "OWNER";

  const transferCandidates = useMemo(
    () =>
      members.filter(
        (m) => m.id !== user?.id && m.role !== "GUEST" && m.status === "ACTIVE"
      ),
    [members, user?.id]
  );

  const loadMembers = useCallback(async () => {
    if (!ready) return;
    setLoadingMembers(true);
    try {
      const res = await fetchWorkspacePeople(accessToken, workspaceId);
      setMembers(res.data);
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Could not load members"
      );
    } finally {
      setLoadingMembers(false);
    }
  }, [accessToken, ready, workspaceId]);

  useEffect(() => {
    void loadMembers();
  }, [loadMembers]);

  const refreshSession = async (nextActiveWorkspaceId?: string) => {
    const me = await getMe(accessToken);
    updateSession({
      accessToken,
      user: {
        id: me.id,
        email: me.email,
        fullName: me.fullName,
        avatarUrl: me.avatarUrl,
      },
      workspaces: me.workspaces,
      activeWorkspaceId: nextActiveWorkspaceId,
    });
  };

  const handleDelete = async () => {
    if (!workspace || !isOwner) return;
    const trimmed = confirmName.trim();
    if (trimmed !== workspace.name.trim()) {
      toast.error("Type the workspace name exactly to confirm deletion");
      return;
    }
    setDeleting(true);
    try {
      await deleteWorkspace(accessToken, workspaceId, trimmed);
      resetSessionScopedState();
      const me = await getMe(accessToken);
      const remaining = me.workspaces;
      const nextId = remaining[0]?.id;
      updateSession({
        accessToken,
        user: {
          id: me.id,
          email: me.email,
          fullName: me.fullName,
          avatarUrl: me.avatarUrl,
        },
        workspaces: remaining,
        activeWorkspaceId: nextId,
      });
      toast.success(`Deleted ${workspace.name}`);
      if (nextId) {
        router.push("/home/inbox");
      } else {
        router.push("/workspace/create/use-case");
      }
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Could not delete workspace"
      );
    } finally {
      setDeleting(false);
    }
  };

  const handleTransfer = async () => {
    if (!workspace || !isOwner || !transferTargetId) return;
    setTransferring(true);
    try {
      await transferWorkspaceOwnership(
        accessToken,
        workspaceId,
        transferTargetId
      );
      resetSessionScopedState();
      await refreshSession(workspaceId);
      const target = members.find((m) => m.id === transferTargetId);
      toast.success(
        target
          ? `Ownership transferred to ${target.fullName}`
          : "Ownership transferred"
      );
      setTransferTargetId("");
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Could not transfer ownership"
      );
    } finally {
      setTransferring(false);
    }
  };

  if (!workspace) {
    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-background">
        <PageHeader title="Workspace settings" />
        <div className="p-6 text-sm text-muted-foreground">
          No active workspace selected.
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-background">
      <PageHeader title="Workspace settings">
        <Button
          variant="ghost"
          size="sm"
          nativeButton={false}
          render={<Link href="/home/inbox" />}
        >
          <ChevronLeftIcon className="size-4" />
          Back
        </Button>
      </PageHeader>
      <div className="min-h-0 flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-lg space-y-6">
          <section className="space-y-2 rounded-xl border border-border bg-card p-4">
            <h2 className="text-sm font-semibold">General</h2>
            <p className="text-sm text-muted-foreground">Workspace name</p>
            <p className="text-base font-medium">{workspace.name}</p>
            <p className="text-xs capitalize text-muted-foreground">
              Your role: {workspace.role.toLowerCase().replace("_", " ")}
            </p>
          </section>

          {isOwner ? (
            <section className="space-y-4 rounded-xl border border-destructive/30 bg-card p-4">
              <div>
                <h2 className="text-sm font-semibold text-destructive">
                  Danger zone
                </h2>
                <p className="text-sm text-muted-foreground">
                  Irreversible actions for this workspace.
                </p>
              </div>

              <div className="space-y-3 rounded-lg border border-border p-4">
                <div>
                  <h3 className="text-sm font-medium">Transfer ownership</h3>
                  <p className="text-sm text-muted-foreground">
                    Make another member the owner. You will become an admin.
                  </p>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Select
                    value={transferTargetId}
                    onValueChange={(v) => v && setTransferTargetId(v)}
                    disabled={loadingMembers || transferring}
                  >
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Select new owner" />
                    </SelectTrigger>
                    <SelectContent>
                      {transferCandidates.map((member) => (
                        <SelectItem key={member.id} value={member.id}>
                          {member.fullName} ({member.email})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    variant="outline"
                    disabled={!transferTargetId || transferring}
                    loading={transferring}
                    onClick={() => void handleTransfer()}
                  >
                    Transfer
                  </Button>
                </div>
              </div>

              <div className="space-y-3 rounded-lg border border-destructive/40 p-4">
                <div>
                  <h3 className="text-sm font-medium text-destructive">
                    Delete workspace
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Permanently delete all workspace data. This cannot be undone.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm-workspace-name">
                    Type <span className="font-semibold">{workspace.name}</span>{" "}
                    to confirm
                  </Label>
                  <Input
                    id="confirm-workspace-name"
                    value={confirmName}
                    onChange={(e) => setConfirmName(e.target.value)}
                    placeholder={workspace.name}
                    disabled={deleting}
                    autoComplete="off"
                  />
                </div>
                <Button
                  variant="destructive"
                  disabled={
                    deleting || confirmName.trim() !== workspace.name.trim()
                  }
                  loading={deleting}
                  onClick={() => void handleDelete()}
                >
                  Delete workspace
                </Button>
              </div>
            </section>
          ) : (
            <section className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
              Only the workspace owner can transfer ownership or delete this
              workspace.
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
