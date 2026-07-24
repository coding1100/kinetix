"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeftIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/shared/PageHeader";
import { useWorkspaceApi } from "@/hooks/use-workspace-api";
import { getMe } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import { updateWorkspace } from "@/lib/api/workspace";
import { selectActiveWorkspace, useAuthStore } from "@/stores/auth-store";

export function WorkspaceSettingsView() {
  const { accessToken, workspaceId } = useWorkspaceApi();
  const workspace = useAuthStore(selectActiveWorkspace);
  const updateSession = useAuthStore((s) => s.updateSession);

  const [nameDraft, setNameDraft] = useState(workspace?.name ?? "");
  const [renaming, setRenaming] = useState(false);

  const canRename =
    workspace?.role === "OWNER" ||
    workspace?.role === "SUPER_ADMIN" ||
    workspace?.role === "ADMIN";

  useEffect(() => {
    setNameDraft(workspace?.name ?? "");
  }, [workspace?.name]);

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

  const handleRename = async () => {
    if (!workspace || !canRename) return;
    const trimmed = nameDraft.trim();
    if (!trimmed || trimmed === workspace.name) return;
    setRenaming(true);
    try {
      await updateWorkspace(accessToken, workspaceId, trimmed);
      await refreshSession(workspaceId);
      toast.success("Workspace renamed");
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Could not rename workspace"
      );
    } finally {
      setRenaming(false);
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
            {canRename ? (
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  value={nameDraft}
                  onChange={(e) => setNameDraft(e.target.value)}
                  disabled={renaming}
                  maxLength={120}
                />
                <Button
                  variant="outline"
                  disabled={
                    renaming ||
                    !nameDraft.trim() ||
                    nameDraft.trim() === workspace.name
                  }
                  loading={renaming}
                  onClick={() => void handleRename()}
                >
                  Save
                </Button>
              </div>
            ) : (
              <p className="text-base font-medium">{workspace.name}</p>
            )}
            <p className="text-xs capitalize text-muted-foreground">
              Your role: {workspace.role.toLowerCase().replace("_", " ")}
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
