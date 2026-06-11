"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { WorkspaceSetupShell } from "@/components/workspace/WorkspaceSetupShell";
import { useNavigateWithLoading } from "@/hooks/use-navigate-with-loading";
import { getMe } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import { createWorkspace } from "@/lib/api/workspace";
import { resetSessionScopedState } from "@/lib/auth/reset-session-scoped-state";
import { useAuthStore } from "@/stores/auth-store";

export default function WorkspaceNamePage() {
  const navigateWithLoading = useNavigateWithLoading();
  const accessToken = useAuthStore((s) => s.accessToken);
  const user = useAuthStore((s) => s.user);
  const updateSession = useAuthStore((s) => s.updateSession);
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const canFinish = useMemo(() => name.trim().length > 1, [name]);

  const handleFinish = async () => {
    const trimmed = name.trim();
    if (!accessToken || !user || trimmed.length < 2 || submitting) return;

    setSubmitting(true);
    try {
      const workspace = await createWorkspace(accessToken, trimmed);
      const me = await getMe(accessToken);
      resetSessionScopedState();
      updateSession({
        accessToken,
        user: {
          id: me.id,
          email: me.email,
          fullName: me.fullName,
          avatarUrl: me.avatarUrl,
        },
        workspaces: me.workspaces,
        activeWorkspaceId: workspace.id,
      });
      toast.success(`Created ${workspace.name}`);
      navigateWithLoading("/home/inbox", "Setting up workspace…");
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Could not create workspace"
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <WorkspaceSetupShell
      title="Lastly, what would you like to name your Workspace?"
      step={6}
      totalSteps={6}
      backHref="/workspace/create/invite"
      nextHref="/home/inbox"
      nextLabel="Finish"
      nextDisabled={!canFinish || !accessToken || !user}
      nextLoading={submitting}
      onNextAction={handleFinish}
    >
      <div className="w-full space-y-3">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="h-12 w-full rounded-xl border border-border bg-background px-4 text-base outline-none"
          placeholder="Workspace name"
          disabled={submitting}
        />
        <p className="text-sm text-muted-foreground">
          Try the name of your company or organization.
        </p>
      </div>
    </WorkspaceSetupShell>
  );
}
