"use client";

import { useEffect, useState } from "react";
import { formatRequestError } from "@/lib/api/client";
import {
  type AdminWorkspaceMember,
  listWorkspaceMembers,
  transferOwnership,
} from "@/lib/api/admin";

interface TransferOwnershipDialogProps {
  open: boolean;
  token: string | null;
  workspaceId: string | null;
  workspaceName?: string;
  onCancel: () => void;
  onTransferred: () => void;
}

export function TransferOwnershipDialog({
  open,
  token,
  workspaceId,
  workspaceName,
  onCancel,
  onTransferred,
}: TransferOwnershipDialogProps) {
  const [members, setMembers] = useState<AdminWorkspaceMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !token || !workspaceId) return;
    setMembers([]);
    setSelectedUserId(null);
    setEmail("");
    setError(null);
    setLoading(true);
    listWorkspaceMembers(token, workspaceId)
      .then((result) => setMembers(result.items.filter((m) => m.role !== "OWNER")))
      .catch((err) => setError(formatRequestError(err)))
      .finally(() => setLoading(false));
  }, [open, token, workspaceId]);

  if (!open) return null;

  const trimmedEmail = email.trim();
  const canSubmit = !busy && (selectedUserId !== null || trimmedEmail.length > 0);

  const handleSelectMember = (id: string) => {
    setSelectedUserId(id);
    setEmail("");
  };

  const handleEmailChange = (value: string) => {
    setEmail(value);
    if (value) setSelectedUserId(null);
  };

  const handleTransfer = async () => {
    if (!token || !workspaceId || !canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      await transferOwnership(
        token,
        workspaceId,
        selectedUserId ? { newOwnerUserId: selectedUserId } : { newOwnerEmail: trimmedEmail }
      );
      onTransferred();
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
        className="w-full max-w-md space-y-4 rounded-lg border border-[var(--border)] bg-[var(--card)] p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div>
          <h2 className="text-base font-semibold">Transfer ownership</h2>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
            {workspaceName ? `Pick a new owner for "${workspaceName}". ` : "Pick a new owner. "}
            The current owner becomes Admin. Nothing changes until you press Transfer.
          </p>
        </div>

        {error && (
          <p className="rounded border border-[var(--destructive)] bg-[var(--destructive)]/10 px-3 py-2 text-xs text-[var(--destructive)]">
            {error}
          </p>
        )}

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-[var(--muted-foreground)]">
            Add by email
          </label>
          <input
            value={email}
            onChange={(e) => handleEmailChange(e.target.value)}
            placeholder="person@example.com"
            className="w-full rounded border border-[var(--border)] bg-transparent px-3 py-2 text-sm"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-[var(--muted-foreground)]">
            Or pick an existing member
          </label>
          <div className="max-h-48 overflow-y-auto rounded border border-[var(--border)]">
            {loading ? (
              <p className="px-3 py-2 text-xs text-[var(--muted-foreground)]">
                Loading members…
              </p>
            ) : members.length === 0 ? (
              <p className="px-3 py-2 text-xs text-[var(--muted-foreground)]">
                No other members.
              </p>
            ) : (
              members.map((m) => (
                <label
                  key={m.id}
                  className={`flex cursor-pointer items-center gap-2 border-b border-[var(--border)] px-3 py-2 text-sm last:border-b-0 hover:bg-[var(--muted)] ${
                    selectedUserId === m.id ? "bg-[var(--muted)]" : ""
                  }`}
                >
                  <input
                    type="radio"
                    name="transfer-target"
                    checked={selectedUserId === m.id}
                    onChange={() => handleSelectMember(m.id)}
                  />
                  <span className="flex-1 truncate">
                    {m.fullName}{" "}
                    <span className="text-[var(--muted-foreground)]">({m.email})</span>
                  </span>
                  <span className="shrink-0 text-xs text-[var(--muted-foreground)]">
                    {m.role}
                  </span>
                </label>
              ))
            )}
          </div>
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
            onClick={handleTransfer}
            disabled={!canSubmit}
            className="rounded bg-[var(--primary)] px-3 py-1.5 text-sm font-medium text-[var(--primary-foreground)] disabled:opacity-50"
          >
            {busy ? "Transferring…" : "Transfer"}
          </button>
        </div>
      </div>
    </div>
  );
}
