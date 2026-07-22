"use client";

import { useEffect, useState } from "react";
import { formatRequestError } from "@/lib/api/client";
import { createWorkspace } from "@/lib/api/admin";

interface CreateWorkspaceDialogProps {
  open: boolean;
  token: string | null;
  onCancel: () => void;
  onCreated: () => void;
}

export function CreateWorkspaceDialog({
  open,
  token,
  onCancel,
  onCreated,
}: CreateWorkspaceDialogProps) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setName("");
    setError(null);
  }, [open]);

  if (!open) return null;

  const trimmedName = name.trim();
  const canSubmit = !busy && trimmedName.length > 0;

  const handleCreate = async () => {
    if (!token || !canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      await createWorkspace(token, trimmedName);
      onCreated();
    } catch (err) {
      setError(formatRequestError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-sm space-y-4 rounded-lg border border-[var(--border)] bg-[var(--card)] p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div>
          <h2 className="text-base font-semibold">Create workspace</h2>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
            You&apos;ll be registered as the owner of this workspace.
          </p>
        </div>

        {error && (
          <p className="rounded border border-[var(--destructive)] bg-[var(--destructive)]/10 px-3 py-2 text-xs text-[var(--destructive)]">
            {error}
          </p>
        )}

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-[var(--muted-foreground)]">
            Workspace name
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void handleCreate();
            }}
            placeholder="Acme Inc"
            autoFocus
            className="w-full rounded border border-[var(--border)] bg-transparent px-3 py-2 text-sm"
          />
        </div>

        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            disabled={busy}
            className="rounded border border-[var(--border)] px-3 py-1.5 text-sm hover:bg-[var(--muted)] disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={!canSubmit}
            className="rounded bg-[var(--primary)] px-3 py-1.5 text-sm font-medium text-[var(--primary-foreground)] disabled:opacity-50"
          >
            {busy ? "Creating…" : "Create"}
          </button>
        </div>
      </div>
    </div>
  );
}
