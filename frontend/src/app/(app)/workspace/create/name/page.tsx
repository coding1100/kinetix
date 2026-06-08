"use client";

import { useMemo, useState } from "react";
import { WorkspaceSetupShell } from "@/components/workspace/WorkspaceSetupShell";

export default function WorkspaceNamePage() {
  const [name, setName] = useState("Mindrind");
  const canFinish = useMemo(() => name.trim().length > 1, [name]);

  return (
    <WorkspaceSetupShell
      title="Lastly, what would you like to name your Workspace?"
      step={6}
      totalSteps={6}
      backHref="/workspace/create/invite"
      nextHref="/home/inbox"
      nextLabel="Finish"
      nextDisabled={!canFinish}
    >
      <div className="w-full space-y-3">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="h-12 w-full rounded-xl border border-border bg-background px-4 text-base outline-none"
          placeholder="Workspace name"
        />
        <p className="text-sm text-muted-foreground">
          Try the name of your company or organization.
        </p>
      </div>
    </WorkspaceSetupShell>
  );
}
