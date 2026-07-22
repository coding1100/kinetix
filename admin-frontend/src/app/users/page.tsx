"use client";

import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { AuditList } from "@/components/AuditList";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { PortalNav } from "@/components/PortalNav";
import { TransferOwnershipDialog } from "@/components/TransferOwnershipDialog";
import { useAdminSession } from "@/hooks/use-admin-session";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { formatRequestError, isAbortError } from "@/lib/api/client";
import {
  type AdminUserRow,
  type AdminUserWorkspace,
  type AuditLogEntry,
  type WorkspaceRole,
  WORKSPACE_ROLES,
  disableUser,
  enableUser,
  listAuditLog,
  listUserWorkspaces,
  listUsers,
  updateMemberRole,
} from "@/lib/api/admin";

const PAGE_SIZE = 25;
const DEBOUNCE_MS = 350;
const POLL_MS = 20000;

type StatusFilter = "" | "ACTIVE" | "DISABLED";

interface PendingRoleChange {
  userId: string;
  workspaceId: string;
  workspaceName: string;
  fromRole: WorkspaceRole;
  toRole: WorkspaceRole;
}

interface PendingDisable {
  userId: string;
  userName: string;
  workspaceCount: number;
}

export default function UsersPage() {
  const { ready, accessToken } = useAdminSession();
  const [items, setItems] = useState<AdminUserRow[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [q, setQ] = useState("");
  const debouncedQ = useDebouncedValue(q, DEBOUNCE_MS);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [auditFor, setAuditFor] = useState<string | null>(null);
  const [auditEntries, setAuditEntries] = useState<AuditLogEntry[]>([]);

  const [workspacesFor, setWorkspacesFor] = useState<string | null>(null);
  const [userWorkspaces, setUserWorkspaces] = useState<AdminUserWorkspace[]>([]);
  const [workspacesLoading, setWorkspacesLoading] = useState(false);
  const [busyRoleWorkspaceId, setBusyRoleWorkspaceId] = useState<string | null>(null);
  const [pendingRoleChange, setPendingRoleChange] = useState<PendingRoleChange | null>(null);
  const [pendingDisable, setPendingDisable] = useState<PendingDisable | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [transferFor, setTransferFor] = useState<{ id: string; name: string } | null>(null);

  const listAbortRef = useRef<AbortController | null>(null);

  const load = useCallback(
    async (search: string, status: StatusFilter, nextOffset: number) => {
      if (!accessToken) return;
      listAbortRef.current?.abort();
      const controller = new AbortController();
      listAbortRef.current = controller;

      setLoading(true);
      setError(null);
      try {
        const result = await listUsers(accessToken, {
          q: search || undefined,
          isDisabled: status ? status === "DISABLED" : undefined,
          limit: PAGE_SIZE,
          offset: nextOffset,
          signal: controller.signal,
        });
        setItems(result.items);
        setTotal(result.total);
        setOffset(nextOffset);
      } catch (err) {
        if (isAbortError(err)) return;
        setError(formatRequestError(err));
      } finally {
        if (listAbortRef.current === controller) setLoading(false);
      }
    },
    [accessToken]
  );

  useEffect(() => {
    if (ready && accessToken) void load(debouncedQ, statusFilter, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, accessToken, debouncedQ, statusFilter]);

  // Skip polling while a mutation is in flight or a confirm dialog is open,
  // so the table doesn't shift under the admin mid-action.
  const pollGuardRef = useRef(false);
  pollGuardRef.current =
    busyId !== null ||
    busyRoleWorkspaceId !== null ||
    confirmBusy ||
    pendingRoleChange !== null ||
    pendingDisable !== null ||
    transferFor !== null;

  useEffect(() => {
    if (!ready || !accessToken) return;
    const interval = setInterval(() => {
      if (pollGuardRef.current) return;
      void load(debouncedQ, statusFilter, offset);
    }, POLL_MS);
    return () => clearInterval(interval);
  }, [ready, accessToken, debouncedQ, statusFilter, offset, load]);

  const refreshAudit = useCallback(
    async (userId: string) => {
      if (auditFor !== userId || !accessToken) return;
      try {
        const result = await listAuditLog(accessToken, {
          targetType: "user",
          targetId: userId,
          limit: 25,
        });
        setAuditEntries(result.items);
      } catch {
        // best-effort refresh; the visible error state is owned by the action itself
      }
    },
    [auditFor, accessToken]
  );

  const runAction = async (id: string, action: () => Promise<unknown>) => {
    setBusyId(id);
    setError(null);
    try {
      await action();
      await load(debouncedQ, statusFilter, offset);
      await refreshAudit(id);
    } catch (err) {
      setError(formatRequestError(err));
    } finally {
      setBusyId(null);
    }
  };

  const handleTransferred = async () => {
    setTransferFor(null);
    if (workspacesFor) {
      await loadWorkspaces(workspacesFor);
      await refreshAudit(workspacesFor);
    }
  };

  const toggleAudit = async (userId: string) => {
    if (auditFor === userId) {
      setAuditFor(null);
      return;
    }
    setAuditFor(userId);
    if (!accessToken) return;
    try {
      const result = await listAuditLog(accessToken, {
        targetType: "user",
        targetId: userId,
        limit: 25,
      });
      setAuditEntries(result.items);
    } catch (err) {
      setError(formatRequestError(err));
    }
  };

  const loadWorkspaces = async (userId: string) => {
    if (!accessToken) return;
    setWorkspacesLoading(true);
    try {
      const result = await listUserWorkspaces(accessToken, userId);
      setUserWorkspaces(result.items);
    } catch (err) {
      setError(formatRequestError(err));
    } finally {
      setWorkspacesLoading(false);
    }
  };

  const toggleWorkspaces = (userId: string) => {
    if (workspacesFor === userId) {
      setWorkspacesFor(null);
      return;
    }
    setWorkspacesFor(userId);
    void loadWorkspaces(userId);
  };

  const requestRoleChange = (ws: AdminUserWorkspace, toRole: WorkspaceRole) => {
    if (!workspacesFor || toRole === ws.role) return;
    setPendingRoleChange({
      userId: workspacesFor,
      workspaceId: ws.id,
      workspaceName: ws.name,
      fromRole: ws.role,
      toRole,
    });
  };

  const confirmRoleChange = async () => {
    if (!pendingRoleChange || !accessToken) return;
    setConfirmBusy(true);
    setBusyRoleWorkspaceId(pendingRoleChange.workspaceId);
    try {
      await updateMemberRole(
        accessToken,
        pendingRoleChange.workspaceId,
        pendingRoleChange.userId,
        pendingRoleChange.toRole
      );
      await loadWorkspaces(pendingRoleChange.userId);
      await refreshAudit(pendingRoleChange.userId);
      setPendingRoleChange(null);
    } catch (err) {
      setError(formatRequestError(err));
    } finally {
      setConfirmBusy(false);
      setBusyRoleWorkspaceId(null);
    }
  };

  const confirmDisableUser = async () => {
    if (!pendingDisable || !accessToken) return;
    setConfirmBusy(true);
    try {
      await disableUser(accessToken, pendingDisable.userId);
      await load(debouncedQ, statusFilter, offset);
      await refreshAudit(pendingDisable.userId);
      setPendingDisable(null);
    } catch (err) {
      setError(formatRequestError(err));
    } finally {
      setConfirmBusy(false);
    }
  };

  if (!ready) return null;

  return (
    <div>
      <PortalNav />
      <main className="mx-auto max-w-5xl space-y-4 p-6">
        <div className="flex flex-wrap gap-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by name or email…"
            className="w-full max-w-sm rounded border border-[var(--border)] bg-transparent px-3 py-2 text-sm"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            className="rounded border border-[var(--border)] bg-transparent px-3 py-2 text-sm"
          >
            <option value="">All statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="DISABLED">Disabled</option>
          </select>
          {loading && (
            <span className="self-center text-xs text-[var(--muted-foreground)]">Searching…</span>
          )}
        </div>

        {error && (
          <p className="rounded border border-[var(--destructive)] bg-[var(--destructive)]/10 px-3 py-2 text-sm text-[var(--destructive)]">
            {error}
          </p>
        )}

        <div className="overflow-x-auto rounded border border-[var(--border)]">
          <table className="w-full text-sm">
            <thead className="border-b border-[var(--border)] bg-[var(--muted)] text-left">
              <tr>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Email</th>
                <th className="px-3 py-2">Workspaces</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((u) => (
                <Fragment key={u.id}>
                  <tr
                    onClick={() => toggleWorkspaces(u.id)}
                    className="cursor-pointer border-b border-[var(--border)] hover:bg-[var(--muted)]/30"
                  >
                    <td className="px-3 py-2">
                      <span className="mr-1.5 text-[var(--muted-foreground)]">
                        {workspacesFor === u.id ? "▾" : "▸"}
                      </span>
                      {u.fullName}
                    </td>
                    <td className="px-3 py-2">{u.email}</td>
                    <td className="px-3 py-2">{u.workspaceCount}</td>
                    <td className="px-3 py-2">
                      <span
                        className={
                          u.isDisabled
                            ? "text-[var(--destructive)]"
                            : "text-[var(--muted-foreground)]"
                        }
                      >
                        {u.isDisabled ? "DISABLED" : "ACTIVE"}
                      </span>
                    </td>
                    <td className="space-x-2 px-3 py-2" onClick={(e) => e.stopPropagation()}>
                      {u.isDisabled ? (
                        <button
                          disabled={busyId === u.id}
                          onClick={() => runAction(u.id, () => enableUser(accessToken!, u.id))}
                          className="rounded border border-[var(--border)] px-2 py-1 hover:bg-[var(--muted)]"
                        >
                          Enable
                        </button>
                      ) : (
                        <button
                          disabled={busyId === u.id}
                          onClick={() =>
                            setPendingDisable({
                              userId: u.id,
                              userName: `${u.fullName} (${u.email})`,
                              workspaceCount: u.workspaceCount,
                            })
                          }
                          className="rounded border border-[var(--destructive)] px-2 py-1 text-[var(--destructive)] hover:bg-[var(--destructive)]/10"
                        >
                          Disable
                        </button>
                      )}
                      <button
                        onClick={() => toggleAudit(u.id)}
                        className="rounded border border-[var(--border)] px-2 py-1 hover:bg-[var(--muted)]"
                      >
                        {auditFor === u.id ? "Hide log" : "Activity"}
                      </button>
                    </td>
                  </tr>

                  {workspacesFor === u.id && (
                    <tr className="border-b border-[var(--border)] bg-[var(--muted)]/40">
                      <td colSpan={5} className="px-3 py-2">
                        {workspacesLoading ? (
                          <p className="text-xs text-[var(--muted-foreground)]">
                            Loading workspaces…
                          </p>
                        ) : userWorkspaces.length === 0 ? (
                          <p className="text-xs text-[var(--muted-foreground)]">
                            Not a member of any workspace.
                          </p>
                        ) : (
                          <table className="w-full text-xs">
                            <thead className="text-left text-[var(--muted-foreground)]">
                              <tr>
                                <th className="py-1 pr-3">Workspace</th>
                                <th className="py-1 pr-3">Slug</th>
                                <th className="py-1 pr-3">Status</th>
                                <th className="py-1 pr-3">Role</th>
                                <th className="py-1 pr-3">Actions</th>
                              </tr>
                            </thead>
                            <tbody>
                              {userWorkspaces.map((ws) => (
                                <tr key={ws.id} className="border-t border-[var(--border)]">
                                  <td className="py-1.5 pr-3">{ws.name}</td>
                                  <td className="py-1.5 pr-3 text-[var(--muted-foreground)]">
                                    {ws.slug}
                                  </td>
                                  <td className="py-1.5 pr-3">
                                    <span
                                      className={
                                        ws.isDeleted || ws.status === "SUSPENDED"
                                          ? "text-[var(--destructive)]"
                                          : "text-[var(--muted-foreground)]"
                                      }
                                    >
                                      {ws.isDeleted ? "ARCHIVED" : ws.status}
                                    </span>
                                  </td>
                                  <td className="py-1.5 pr-3">
                                    {ws.role === "OWNER" ? (
                                      <span className="text-[var(--muted-foreground)]">OWNER</span>
                                    ) : (
                                      <select
                                        value={ws.role}
                                        disabled={busyRoleWorkspaceId === ws.id}
                                        onChange={(e) =>
                                          requestRoleChange(ws, e.target.value as WorkspaceRole)
                                        }
                                        className="rounded border border-[var(--border)] bg-transparent px-2 py-1"
                                      >
                                        {WORKSPACE_ROLES.map((role) => (
                                          <option key={role} value={role}>
                                            {role}
                                          </option>
                                        ))}
                                      </select>
                                    )}
                                  </td>
                                  <td className="py-1.5 pr-3">
                                    {ws.role === "OWNER" ? (
                                      <button
                                        disabled={busyRoleWorkspaceId === ws.id}
                                        onClick={() => setTransferFor({ id: ws.id, name: ws.name })}
                                        className="rounded border border-[var(--border)] px-2 py-1 hover:bg-[var(--muted)]"
                                      >
                                        Transfer ownership
                                      </button>
                                    ) : u.isDisabled ? (
                                      <button
                                        disabled={busyId === u.id}
                                        onClick={() =>
                                          runAction(u.id, () => enableUser(accessToken!, u.id))
                                        }
                                        className="rounded border border-[var(--border)] px-2 py-1 hover:bg-[var(--muted)]"
                                      >
                                        Enable
                                      </button>
                                    ) : (
                                      <button
                                        disabled={busyId === u.id}
                                        onClick={() =>
                                          setPendingDisable({
                                            userId: u.id,
                                            userName: `${u.fullName} (${u.email})`,
                                            workspaceCount: u.workspaceCount,
                                          })
                                        }
                                        className="rounded border border-[var(--destructive)] px-2 py-1 text-[var(--destructive)] hover:bg-[var(--destructive)]/10"
                                      >
                                        Disable
                                      </button>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </td>
                    </tr>
                  )}

                  {auditFor === u.id && (
                    <tr className="border-b border-[var(--border)] bg-[var(--muted)]/40">
                      <td colSpan={5} className="px-3 py-2">
                        <AuditList entries={auditEntries} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
              {items.length === 0 && !loading && (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-[var(--muted-foreground)]">
                    No users found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between text-sm text-[var(--muted-foreground)]">
          <span>
            {total === 0 ? 0 : offset + 1}–{Math.min(offset + PAGE_SIZE, total)} of {total}
          </span>
          <div className="space-x-2">
            <button
              disabled={offset === 0 || loading}
              onClick={() => load(debouncedQ, statusFilter, Math.max(0, offset - PAGE_SIZE))}
              className="rounded border border-[var(--border)] px-3 py-1 disabled:opacity-50"
            >
              Previous
            </button>
            <button
              disabled={offset + PAGE_SIZE >= total || loading}
              onClick={() => load(debouncedQ, statusFilter, offset + PAGE_SIZE)}
              className="rounded border border-[var(--border)] px-3 py-1 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      </main>

      <ConfirmDialog
        open={pendingRoleChange !== null}
        title="Change member role?"
        description={
          pendingRoleChange
            ? `Change this user's role in ${pendingRoleChange.workspaceName} from ${pendingRoleChange.fromRole} to ${pendingRoleChange.toRole}?`
            : undefined
        }
        confirmLabel="Change role"
        busy={confirmBusy}
        onConfirm={confirmRoleChange}
        onCancel={() => setPendingRoleChange(null)}
      />

      <ConfirmDialog
        open={pendingDisable !== null}
        title="Disable this user?"
        description={
          pendingDisable
            ? `Disabling ${pendingDisable.userName} blocks their login and revokes all active sessions immediately — removing their access from all ${pendingDisable.workspaceCount} workspace(s) they belong to. This can be undone with Enable.`
            : undefined
        }
        confirmLabel="Disable user"
        danger
        busy={confirmBusy}
        onConfirm={confirmDisableUser}
        onCancel={() => setPendingDisable(null)}
      />

      <TransferOwnershipDialog
        open={transferFor !== null}
        token={accessToken}
        workspaceId={transferFor?.id ?? null}
        workspaceName={transferFor?.name}
        onCancel={() => setTransferFor(null)}
        onTransferred={handleTransferred}
      />
    </div>
  );
}
