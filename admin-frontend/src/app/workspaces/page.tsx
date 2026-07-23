"use client";

import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { AuditList } from "@/components/AuditList";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { CreateWorkspaceDialog } from "@/components/CreateWorkspaceDialog";
import { PortalNav } from "@/components/PortalNav";
import { TransferOwnershipDialog } from "@/components/TransferOwnershipDialog";
import { useAdminSession } from "@/hooks/use-admin-session";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { formatRequestError, isAbortError } from "@/lib/api/client";
import {
  type AdminWorkspace,
  type AdminWorkspaceInvite,
  type AdminWorkspaceMember,
  type AuditLogEntry,
  type InviteRole,
  type WorkspaceRole,
  INVITE_ROLES,
  WORKSPACE_ROLES,
  cancelWorkspaceInvite,
  createWorkspaceInvite,
  deleteWorkspace,
  listAuditLog,
  listWorkspaceInvites,
  listWorkspaceMembers,
  listWorkspaces,
  reactivateMember,
  reactivateWorkspace,
  resendWorkspaceInvite,
  restoreWorkspace,
  suspendMember,
  suspendWorkspace,
  updateMemberRole,
} from "@/lib/api/admin";

const PAGE_SIZE = 25;
const DEBOUNCE_MS = 350;
const POLL_MS = 20000;

type StatusFilter = "" | "ACTIVE" | "SUSPENDED";

interface PendingRoleChange {
  workspaceId: string;
  userId: string;
  userName: string;
  fromRole: WorkspaceRole;
  toRole: WorkspaceRole;
}

interface PendingDisable {
  workspaceId: string;
  userId: string;
  userName: string;
}

export default function WorkspacesPage() {
  const { ready, accessToken } = useAdminSession();
  const [items, setItems] = useState<AdminWorkspace[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [q, setQ] = useState("");
  const debouncedQ = useDebouncedValue(q, DEBOUNCE_MS);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("");
  const [showArchived, setShowArchived] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [auditFor, setAuditFor] = useState<string | null>(null);
  const [auditEntries, setAuditEntries] = useState<AuditLogEntry[]>([]);

  const [membersFor, setMembersFor] = useState<string | null>(null);
  const [members, setMembers] = useState<AdminWorkspaceMember[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [busyMemberId, setBusyMemberId] = useState<string | null>(null);
  const [pendingRoleChange, setPendingRoleChange] = useState<PendingRoleChange | null>(null);
  const [pendingDisable, setPendingDisable] = useState<PendingDisable | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [transferFor, setTransferFor] = useState<{ id: string; name: string } | null>(null);
  const [pendingArchive, setPendingArchive] = useState<{ id: string; name: string } | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const [invites, setInvites] = useState<AdminWorkspaceInvite[]>([]);
  const [invitesLoading, setInvitesLoading] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<InviteRole>("MEMBER");
  const [inviteBusy, setInviteBusy] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteActionId, setInviteActionId] = useState<string | null>(null);

  const listAbortRef = useRef<AbortController | null>(null);

  const load = useCallback(
    async (search: string, status: StatusFilter, archived: boolean, nextOffset: number) => {
      if (!accessToken) return;
      listAbortRef.current?.abort();
      const controller = new AbortController();
      listAbortRef.current = controller;

      setLoading(true);
      setError(null);
      try {
        const result = await listWorkspaces(accessToken, {
          q: search || undefined,
          status: archived ? undefined : status || undefined,
          includeDeleted: archived,
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
    if (ready && accessToken) void load(debouncedQ, statusFilter, showArchived, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, accessToken, debouncedQ, statusFilter, showArchived]);

  // Skip polling while a mutation is in flight or a confirm dialog is open,
  // so the table doesn't shift under the admin mid-action.
  const pollGuardRef = useRef(false);
  pollGuardRef.current =
    busyId !== null ||
    busyMemberId !== null ||
    confirmBusy ||
    pendingRoleChange !== null ||
    pendingDisable !== null ||
    transferFor !== null ||
    pendingArchive !== null ||
    createOpen ||
    inviteBusy ||
    inviteActionId !== null;

  useEffect(() => {
    if (!ready || !accessToken) return;
    const interval = setInterval(() => {
      if (pollGuardRef.current) return;
      void load(debouncedQ, statusFilter, showArchived, offset);
      // Membership changes (e.g. an invite getting accepted) happen
      // independently of the workspace list itself, so the expanded
      // row's members/invites need their own refresh on the same tick.
      if (membersFor) {
        void loadMembers(membersFor);
        void loadInvites(membersFor);
      }
    }, POLL_MS);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, accessToken, debouncedQ, statusFilter, showArchived, offset, load, membersFor]);

  const refreshAudit = useCallback(
    async (workspaceId: string) => {
      if (auditFor !== workspaceId || !accessToken) return;
      try {
        const result = await listAuditLog(accessToken, {
          targetType: "workspace",
          targetId: workspaceId,
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
      await load(debouncedQ, statusFilter, showArchived, offset);
      await refreshAudit(id);
    } catch (err) {
      setError(formatRequestError(err));
    } finally {
      setBusyId(null);
    }
  };

  const handleTransferred = async () => {
    const workspaceId = transferFor?.id;
    setTransferFor(null);
    if (!workspaceId) return;
    await load(debouncedQ, statusFilter, showArchived, offset);
    if (membersFor === workspaceId) await loadMembers(workspaceId);
    await refreshAudit(workspaceId);
  };

  const toggleAudit = async (workspaceId: string) => {
    if (auditFor === workspaceId) {
      setAuditFor(null);
      return;
    }
    setAuditFor(workspaceId);
    if (!accessToken) return;
    try {
      const result = await listAuditLog(accessToken, {
        targetType: "workspace",
        targetId: workspaceId,
        limit: 25,
      });
      setAuditEntries(result.items);
    } catch (err) {
      setError(formatRequestError(err));
    }
  };

  const loadMembers = async (workspaceId: string) => {
    if (!accessToken) return;
    setMembersLoading(true);
    try {
      const result = await listWorkspaceMembers(accessToken, workspaceId);
      setMembers(result.items);
    } catch (err) {
      setError(formatRequestError(err));
    } finally {
      setMembersLoading(false);
    }
  };

  const loadInvites = async (workspaceId: string) => {
    if (!accessToken) return;
    setInvitesLoading(true);
    try {
      const result = await listWorkspaceInvites(accessToken, workspaceId);
      setInvites(result.items);
    } catch (err) {
      setInviteError(formatRequestError(err));
    } finally {
      setInvitesLoading(false);
    }
  };

  const hasOwner = (workspaceId: string) => {
    if (membersFor !== workspaceId) return true;
    return (
      members.some((m) => m.role === "OWNER") ||
      invites.some((inv) => inv.role === "OWNER")
    );
  };

  const toggleMembers = (workspaceId: string) => {
    if (membersFor === workspaceId) {
      setMembersFor(null);
      return;
    }
    setMembersFor(workspaceId);
    setInviteEmail("");
    setInviteRole("MEMBER");
    setInviteError(null);
    void loadMembers(workspaceId);
    void loadInvites(workspaceId);
  };

  const handleSendInvite = async (workspaceId: string) => {
    const email = inviteEmail.trim();
    if (!email || !accessToken) return;
    setInviteBusy(true);
    setInviteError(null);
    try {
      await createWorkspaceInvite(accessToken, workspaceId, email, inviteRole);
      setInviteEmail("");
      await loadInvites(workspaceId);
    } catch (err) {
      setInviteError(formatRequestError(err));
    } finally {
      setInviteBusy(false);
    }
  };

  const handleResendInvite = async (workspaceId: string, inviteId: string) => {
    if (!accessToken) return;
    setInviteActionId(`resend:${inviteId}`);
    try {
      await resendWorkspaceInvite(accessToken, workspaceId, inviteId);
      await loadInvites(workspaceId);
      toast.success("Invite resent");
    } catch (err) {
      const message = formatRequestError(err);
      setInviteError(message);
      toast.error(message);
    } finally {
      setInviteActionId(null);
    }
  };

  const handleCancelInvite = async (workspaceId: string, inviteId: string) => {
    if (!accessToken) return;
    setInviteActionId(`cancel:${inviteId}`);
    try {
      await cancelWorkspaceInvite(accessToken, workspaceId, inviteId);
      await loadInvites(workspaceId);
    } catch (err) {
      setInviteError(formatRequestError(err));
    } finally {
      setInviteActionId(null);
    }
  };

  const handleCopyInviteLink = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Invite link copied");
    } catch {
      toast.error("Couldn't copy link — clipboard access is blocked");
    }
  };

  const handleCreatedWorkspace = async () => {
    setCreateOpen(false);
    await load(debouncedQ, statusFilter, showArchived, 0);
  };

  const requestRoleChange = (member: AdminWorkspaceMember, toRole: WorkspaceRole) => {
    if (!membersFor || toRole === member.role) return;
    setPendingRoleChange({
      workspaceId: membersFor,
      userId: member.id,
      userName: member.fullName,
      fromRole: member.role,
      toRole,
    });
  };

  const confirmRoleChange = async () => {
    if (!pendingRoleChange || !accessToken) return;
    setConfirmBusy(true);
    setBusyMemberId(pendingRoleChange.userId);
    try {
      await updateMemberRole(
        accessToken,
        pendingRoleChange.workspaceId,
        pendingRoleChange.userId,
        pendingRoleChange.toRole
      );
      await loadMembers(pendingRoleChange.workspaceId);
      await refreshAudit(pendingRoleChange.workspaceId);
      setPendingRoleChange(null);
    } catch (err) {
      setError(formatRequestError(err));
    } finally {
      setConfirmBusy(false);
      setBusyMemberId(null);
    }
  };

  const confirmDisableMember = async () => {
    if (!pendingDisable || !accessToken) return;
    setConfirmBusy(true);
    try {
      await suspendMember(accessToken, pendingDisable.workspaceId, pendingDisable.userId);
      await loadMembers(pendingDisable.workspaceId);
      await refreshAudit(pendingDisable.workspaceId);
      setPendingDisable(null);
    } catch (err) {
      setError(formatRequestError(err));
    } finally {
      setConfirmBusy(false);
    }
  };

  const handleEnableMember = async (member: AdminWorkspaceMember) => {
    if (!accessToken || !membersFor) return;
    setBusyMemberId(member.id);
    try {
      await reactivateMember(accessToken, membersFor, member.id);
      await loadMembers(membersFor);
      await refreshAudit(membersFor);
    } catch (err) {
      setError(formatRequestError(err));
    } finally {
      setBusyMemberId(null);
    }
  };

  const handleRestore = (workspaceId: string) => {
    runAction(workspaceId, () => restoreWorkspace(accessToken!, workspaceId));
  };

  const confirmArchive = async () => {
    if (!pendingArchive || !accessToken) return;
    setConfirmBusy(true);
    try {
      await deleteWorkspace(accessToken, pendingArchive.id);
      await load(debouncedQ, statusFilter, showArchived, offset);
      await refreshAudit(pendingArchive.id);
      setPendingArchive(null);
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
            placeholder="Search by name or slug…"
            className="w-full max-w-sm rounded border border-[var(--border)] bg-transparent px-3 py-2 text-sm"
          />
          <select
            value={statusFilter}
            disabled={showArchived}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            className="rounded border border-[var(--border)] bg-transparent px-3 py-2 text-sm disabled:opacity-50"
          >
            <option value="">All statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="SUSPENDED">Suspended</option>
          </select>
          <label className="flex items-center gap-1.5 self-center text-sm">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
            />
            Show archived
          </label>
          {loading && (
            <span className="self-center text-xs text-[var(--muted-foreground)]">Searching…</span>
          )}
          <button
            onClick={() => setCreateOpen(true)}
            className="ml-auto rounded bg-[var(--primary)] px-3 py-2 text-sm font-medium text-[var(--primary-foreground)]"
          >
            Create workspace
          </button>
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
                <th className="px-3 py-2">Owner</th>
                <th className="px-3 py-2">Members</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((ws) => (
                <Fragment key={ws.id}>
                  <tr
                    onClick={() => !ws.isDeleted && toggleMembers(ws.id)}
                    className={`border-b border-[var(--border)] hover:bg-[var(--muted)]/30 ${
                      ws.isDeleted ? "" : "cursor-pointer"
                    }`}
                  >
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1.5 font-medium">
                        {!ws.isDeleted && (
                          <span className="text-[var(--muted-foreground)]">
                            {membersFor === ws.id ? "▾" : "▸"}
                          </span>
                        )}
                        {ws.name}
                      </div>
                      <div className="pl-4 text-xs text-[var(--muted-foreground)]">{ws.slug}</div>
                    </td>
                    <td className="px-3 py-2">
                      {ws.owner ? `${ws.owner.fullName} (${ws.owner.email})` : "—"}
                    </td>
                    <td className="px-3 py-2">{ws.memberCount}</td>
                    <td className="px-3 py-2">
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
                    <td className="space-x-2 px-3 py-2" onClick={(e) => e.stopPropagation()}>
                      {ws.isDeleted ? (
                        <button
                          disabled={busyId === ws.id}
                          onClick={() => handleRestore(ws.id)}
                          className="rounded border border-[var(--border)] px-2 py-1 hover:bg-[var(--muted)]"
                        >
                          Restore
                        </button>
                      ) : (
                        <>
                          {ws.status === "ACTIVE" ? (
                            <button
                              disabled={busyId === ws.id}
                              onClick={() =>
                                runAction(ws.id, () => suspendWorkspace(accessToken!, ws.id))
                              }
                              className="rounded border border-[var(--border)] px-2 py-1 hover:bg-[var(--muted)]"
                            >
                              Suspend
                            </button>
                          ) : (
                            <button
                              disabled={busyId === ws.id}
                              onClick={() =>
                                runAction(ws.id, () => reactivateWorkspace(accessToken!, ws.id))
                              }
                              className="rounded border border-[var(--border)] px-2 py-1 hover:bg-[var(--muted)]"
                            >
                              Reactivate
                            </button>
                          )}
                          <button
                            disabled={busyId === ws.id}
                            onClick={() => setTransferFor({ id: ws.id, name: ws.name })}
                            className="rounded border border-[var(--border)] px-2 py-1 hover:bg-[var(--muted)]"
                          >
                            Transfer
                          </button>
                          <button
                            disabled={busyId === ws.id}
                            onClick={() => setPendingArchive({ id: ws.id, name: ws.name })}
                            className="rounded border border-[var(--destructive)] px-2 py-1 text-[var(--destructive)] hover:bg-[var(--destructive)]/10"
                          >
                            Archive
                          </button>
                        </>
                      )}
                      <button
                        onClick={() => toggleAudit(ws.id)}
                        className="rounded border border-[var(--border)] px-2 py-1 hover:bg-[var(--muted)]"
                      >
                        {auditFor === ws.id ? "Hide log" : "Activity"}
                      </button>
                    </td>
                  </tr>

                  {membersFor === ws.id && (
                    <tr className="border-b border-[var(--border)] bg-[var(--muted)]/40">
                      <td colSpan={5} className="px-3 py-2">
                        {membersLoading ? (
                          <p className="text-xs text-[var(--muted-foreground)]">Loading members…</p>
                        ) : members.length === 0 ? (
                          <p className="text-xs text-[var(--muted-foreground)]">No members.</p>
                        ) : (
                          <table className="w-full text-xs">
                            <thead className="text-left text-[var(--muted-foreground)]">
                              <tr>
                                <th className="py-1 pr-3">Name</th>
                                <th className="py-1 pr-3">Email</th>
                                <th className="py-1 pr-3">Status</th>
                                <th className="py-1 pr-3">Role</th>
                                <th className="py-1 pr-3">Actions</th>
                              </tr>
                            </thead>
                            <tbody>
                              {members.map((m) => (
                                <tr key={m.id} className="border-t border-[var(--border)]">
                                  <td className="py-1.5 pr-3">{m.fullName}</td>
                                  <td className="py-1.5 pr-3">{m.email}</td>
                                  <td className="py-1.5 pr-3">
                                    <span
                                      className={
                                        m.status === "SUSPENDED"
                                          ? "text-[var(--destructive)]"
                                          : "text-[var(--muted-foreground)]"
                                      }
                                    >
                                      {m.status}
                                    </span>
                                    {m.isDisabled && (
                                      <span className="ml-1 text-[var(--muted-foreground)]">
                                        (account disabled)
                                      </span>
                                    )}
                                  </td>
                                  <td className="py-1.5 pr-3">
                                    {m.role === "OWNER" ? (
                                      <span className="text-[var(--muted-foreground)]">OWNER</span>
                                    ) : (
                                      <select
                                        value={m.role}
                                        disabled={busyMemberId === m.id}
                                        onChange={(e) =>
                                          requestRoleChange(m, e.target.value as WorkspaceRole)
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
                                    {m.role === "OWNER" ? (
                                      <button
                                        onClick={() => setTransferFor({ id: ws.id, name: ws.name })}
                                        className="rounded border border-[var(--border)] px-2 py-1 hover:bg-[var(--muted)]"
                                      >
                                        Transfer ownership
                                      </button>
                                    ) : m.status === "SUSPENDED" ? (
                                      <button
                                        disabled={busyMemberId === m.id}
                                        onClick={() => handleEnableMember(m)}
                                        className="rounded border border-[var(--border)] px-2 py-1 hover:bg-[var(--muted)]"
                                      >
                                        Enable
                                      </button>
                                    ) : (
                                      <button
                                        disabled={busyMemberId === m.id}
                                        onClick={() =>
                                          setPendingDisable({
                                            workspaceId: ws.id,
                                            userId: m.id,
                                            userName: m.fullName,
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

                        <div className="mt-4 border-t border-[var(--border)] pt-3">
                          <p className="mb-2 text-xs font-semibold">Invite people</p>
                          {inviteError && (
                            <p className="mb-2 rounded border border-[var(--destructive)] bg-[var(--destructive)]/10 px-2 py-1.5 text-xs text-[var(--destructive)]">
                              {inviteError}
                            </p>
                          )}
                          <div className="flex flex-wrap items-center gap-2">
                            <input
                              value={inviteEmail}
                              onChange={(e) => setInviteEmail(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") void handleSendInvite(ws.id);
                              }}
                              placeholder="person@example.com"
                              className="min-w-[220px] flex-1 rounded border border-[var(--border)] bg-transparent px-2 py-1.5 text-xs"
                            />
                            <select
                              value={inviteRole}
                              onChange={(e) => setInviteRole(e.target.value as InviteRole)}
                              className="rounded border border-[var(--border)] bg-transparent px-2 py-1.5 text-xs"
                            >
                              {INVITE_ROLES.filter(
                                (role) => role !== "OWNER" || !hasOwner(ws.id)
                              ).map((role) => (
                                <option key={role} value={role}>
                                  {role}
                                </option>
                              ))}
                            </select>
                            <button
                              disabled={inviteBusy || !inviteEmail.trim()}
                              onClick={() => handleSendInvite(ws.id)}
                              className="rounded bg-[var(--primary)] px-3 py-1.5 text-xs font-medium text-[var(--primary-foreground)] disabled:opacity-50"
                            >
                              {inviteBusy ? "Sending…" : "Invite"}
                            </button>
                          </div>

                          {invitesLoading ? (
                            <p className="mt-2 text-xs text-[var(--muted-foreground)]">
                              Loading invites…
                            </p>
                          ) : invites.length > 0 ? (
                            <table className="mt-3 w-full text-xs">
                              <thead className="text-left text-[var(--muted-foreground)]">
                                <tr>
                                  <th className="py-1 pr-3">Email</th>
                                  <th className="py-1 pr-3">Role</th>
                                  <th className="py-1 pr-3">Status</th>
                                  <th className="py-1 pr-3">Expires</th>
                                  <th className="py-1 pr-3">Actions</th>
                                </tr>
                              </thead>
                              <tbody>
                                {invites.map((inv) => (
                                  <tr key={inv.id} className="border-t border-[var(--border)]">
                                    <td className="py-1.5 pr-3">{inv.email}</td>
                                    <td className="py-1.5 pr-3">{inv.role}</td>
                                    <td className="py-1.5 pr-3">
                                      <span
                                        className={
                                          inv.status === "expired"
                                            ? "text-[var(--destructive)]"
                                            : "text-[var(--muted-foreground)]"
                                        }
                                      >
                                        {inv.status}
                                      </span>
                                    </td>
                                    <td className="py-1.5 pr-3">
                                      {new Date(inv.expiresAt).toLocaleDateString()}
                                    </td>
                                    <td className="space-x-1.5 py-1.5 pr-3">
                                      <button
                                        onClick={() => handleCopyInviteLink(inv.inviteUrl)}
                                        className="rounded border border-[var(--border)] px-2 py-1 hover:bg-[var(--muted)]"
                                      >
                                        Copy link
                                      </button>
                                      <button
                                        disabled={inviteActionId === `resend:${inv.id}`}
                                        onClick={() => handleResendInvite(ws.id, inv.id)}
                                        className="rounded border border-[var(--border)] px-2 py-1 hover:bg-[var(--muted)]"
                                      >
                                        Resend
                                      </button>
                                      <button
                                        disabled={inviteActionId === `cancel:${inv.id}`}
                                        onClick={() => handleCancelInvite(ws.id, inv.id)}
                                        className="rounded border border-[var(--destructive)] px-2 py-1 text-[var(--destructive)] hover:bg-[var(--destructive)]/10"
                                      >
                                        Cancel
                                      </button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          ) : (
                            <p className="mt-2 text-xs text-[var(--muted-foreground)]">
                              No pending invites.
                            </p>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}

                  {auditFor === ws.id && (
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
                    No workspaces found.
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
              onClick={() =>
                load(debouncedQ, statusFilter, showArchived, Math.max(0, offset - PAGE_SIZE))
              }
              className="rounded border border-[var(--border)] px-3 py-1 disabled:opacity-50"
            >
              Previous
            </button>
            <button
              disabled={offset + PAGE_SIZE >= total || loading}
              onClick={() => load(debouncedQ, statusFilter, showArchived, offset + PAGE_SIZE)}
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
            ? `Change ${pendingRoleChange.userName}'s role from ${pendingRoleChange.fromRole} to ${pendingRoleChange.toRole}?`
            : undefined
        }
        confirmLabel="Change role"
        busy={confirmBusy}
        onConfirm={confirmRoleChange}
        onCancel={() => setPendingRoleChange(null)}
      />

      <ConfirmDialog
        open={pendingDisable !== null}
        title="Disable this member?"
        description={
          pendingDisable
            ? `Disabling ${pendingDisable.userName} blocks their access to this workspace only — their account and every other workspace they belong to are unaffected. This can be undone with Enable.`
            : undefined
        }
        confirmLabel="Disable"
        danger
        busy={confirmBusy}
        onConfirm={confirmDisableMember}
        onCancel={() => setPendingDisable(null)}
      />

      <CreateWorkspaceDialog
        open={createOpen}
        token={accessToken}
        onCancel={() => setCreateOpen(false)}
        onCreated={handleCreatedWorkspace}
      />

      <TransferOwnershipDialog
        open={transferFor !== null}
        token={accessToken}
        workspaceId={transferFor?.id ?? null}
        workspaceName={transferFor?.name}
        onCancel={() => setTransferFor(null)}
        onTransferred={handleTransferred}
      />

      <ConfirmDialog
        open={pendingArchive !== null}
        title="Archive this workspace?"
        description={
          pendingArchive
            ? `Archive "${pendingArchive.name}"? Members lose access immediately. This can be undone with Restore.`
            : undefined
        }
        confirmLabel="Archive"
        danger
        busy={confirmBusy}
        onConfirm={confirmArchive}
        onCancel={() => setPendingArchive(null)}
      />
    </div>
  );
}
