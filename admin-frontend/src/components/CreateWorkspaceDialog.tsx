"use client";

import { useEffect, useState } from "react";
import { formatRequestError } from "@/lib/api/client";
import {
  createWorkspace,
  createWorkspaceInvite,
  INVITE_ROLES,
  type InviteRole,
} from "@/lib/api/admin";

interface CreateWorkspaceDialogProps {
  open: boolean;
  token: string | null;
  onCancel: () => void;
  onCreated: () => void;
}

interface SentInvite {
  email: string;
  role: InviteRole;
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

  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [sentInvites, setSentInvites] = useState<SentInvite[]>([]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<InviteRole>("OWNER");
  const [inviteBusy, setInviteBusy] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setName("");
    setError(null);
    setWorkspaceId(null);
    setSentInvites([]);
    setInviteEmail("");
    setInviteRole("OWNER");
    setInviteError(null);
  }, [open]);

  if (!open) return null;

  const hasOwner = sentInvites.some((inv) => inv.role === "OWNER");
  const availableRoles = INVITE_ROLES.filter((role) => role !== "OWNER" || !hasOwner);

  const trimmedName = name.trim();
  const canSubmit = !busy && trimmedName.length > 0;

  const handleCreate = async () => {
    if (!token || !canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      const ws = await createWorkspace(token, trimmedName);
      setWorkspaceId(ws.id);
    } catch (err) {
      setError(formatRequestError(err));
    } finally {
      setBusy(false);
    }
  };

  const handleInvite = async () => {
    const email = inviteEmail.trim();
    if (!token || !workspaceId || !email) return;
    setInviteBusy(true);
    setInviteError(null);
    try {
      await createWorkspaceInvite(token, workspaceId, email, inviteRole);
      setSentInvites((prev) => [...prev, { email, role: inviteRole }]);
      setInviteEmail("");
      if (inviteRole === "OWNER") setInviteRole("MEMBER");
    } catch (err) {
      setInviteError(formatRequestError(err));
    } finally {
      setInviteBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={workspaceId ? undefined : onCancel}
    >
      <div
        className="w-full max-w-sm space-y-4 rounded-lg border border-[var(--border)] bg-[var(--card)] p-5"
        onClick={(e) => e.stopPropagation()}
      >
        {!workspaceId ? (
          <>
            <div>
              <h2 className="text-base font-semibold">Create workspace</h2>
              <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                You won&apos;t be added as a member — you&apos;ll invite someone as owner next.
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
          </>
        ) : (
          <>
            <div>
              <h2 className="text-base font-semibold">Invite people</h2>
              <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                &quot;{trimmedName}&quot; created. Invite someone as owner to get started.
              </p>
            </div>

            {inviteError && (
              <p className="rounded border border-[var(--destructive)] bg-[var(--destructive)]/10 px-3 py-2 text-xs text-[var(--destructive)]">
                {inviteError}
              </p>
            )}

            <div className="flex flex-wrap items-center gap-2">
              <input
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void handleInvite();
                }}
                placeholder="person@example.com"
                className="min-w-[180px] flex-1 rounded border border-[var(--border)] bg-transparent px-2 py-1.5 text-sm"
              />
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as InviteRole)}
                className="rounded border border-[var(--border)] bg-transparent px-2 py-1.5 text-sm"
              >
                {availableRoles.map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </select>
              <button
                disabled={inviteBusy || !inviteEmail.trim()}
                onClick={handleInvite}
                className="rounded bg-[var(--primary)] px-3 py-1.5 text-sm font-medium text-[var(--primary-foreground)] disabled:opacity-50"
              >
                {inviteBusy ? "Sending…" : "Invite"}
              </button>
            </div>

            {sentInvites.length > 0 && (
              <ul className="space-y-1 text-xs text-[var(--muted-foreground)]">
                {sentInvites.map((inv) => (
                  <li key={inv.email}>
                    {inv.email} — invited as {inv.role}
                  </li>
                ))}
              </ul>
            )}

            <div className="flex justify-end gap-2">
              <button
                onClick={onCreated}
                className="rounded bg-[var(--primary)] px-3 py-1.5 text-sm font-medium text-[var(--primary-foreground)]"
              >
                Done
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
