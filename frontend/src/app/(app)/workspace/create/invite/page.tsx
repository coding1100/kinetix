"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { PlusCircleIcon, LightbulbIcon } from "lucide-react";
import { WorkspaceSetupShell } from "@/components/workspace/WorkspaceSetupShell";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export default function WorkspaceInvitePage() {
  const [emailInput, setEmailInput] = useState("");
  const [emails, setEmails] = useState<string[]>([]);
  const [showSkipConfirm, setShowSkipConfirm] = useState(false);

  const canProceed = useMemo(() => emails.length > 0, [emails]);

  const addEmail = () => {
    const value = emailInput.trim();
    if (!value || emails.includes(value)) return;
    setEmails((prev) => [...prev, value]);
    setEmailInput("");
  };

  return (
    <>
      <WorkspaceSetupShell
        title="Invite people to your Workspace:"
        step={3}
        totalSteps={6}
        backHref="/workspace/create/manage"
        nextHref="/workspace/create/features"
        nextLabel={canProceed ? "Invite" : "Next"}
        nextDisabled={!canProceed}
        showSkip={true}
        onSkipAction={() => setShowSkipConfirm(true)}
      >
        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-background px-4 py-3">
            <div className="flex flex-wrap items-center gap-2">
              {emails.map((email) => (
                <span
                  key={email}
                  className="inline-flex items-center rounded-full border border-border bg-muted px-3 py-1 text-sm"
                >
                  {email}
                </span>
              ))}
              <input
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addEmail();
                  }
                }}
                placeholder="test@gmail.com"
                className="min-w-[300px] flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground"
              />
            </div>
          </div>

          <button
            type="button"
            onClick={addEmail}
            className="inline-flex w-full items-center gap-2 rounded-xl border border-border px-4 py-3 text-sm text-muted-foreground hover:bg-muted"
          >
            <PlusCircleIcon className="size-6 text-foreground" />
            Add {emailInput.trim() || "email"}
          </button>

          <div className="inline-flex items-center gap-2 rounded-lg bg-emerald-100/50 px-3 py-2 text-sm text-muted-foreground">
            <LightbulbIcon className="size-5 text-emerald-700" />
            Don&apos;t do it alone - Invite your team to get started 200% faster.
          </div>

          <p className="text-sm font-medium text-muted-foreground">Press ENTER to add</p>
        </div>
      </WorkspaceSetupShell>

      <Dialog open={showSkipConfirm} onOpenChange={setShowSkipConfirm}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Skip without inviting</DialogTitle>
            <p className="text-sm text-muted-foreground">
              People that invite others to collaborate in Kinetix are 4x more successful.
            </p>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSkipConfirm(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              nativeButton={false}
              render={<Link href="/workspace/create/features" />}
            >
              Skip step
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
