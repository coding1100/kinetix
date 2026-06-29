"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  CopyIcon,
  MoreHorizontalIcon,
  RefreshCwIcon,
  SearchIcon,
  UserPlusIcon,
  XIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { UserAvatarWithPresence } from "@/components/shared/AvatarWithPresence";
import { usePresenceStore, useUserPresence } from "@/stores/presence-store";
import { presenceLabel } from "@/stores/profile-store";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useWorkspaceApi } from "@/hooks/use-workspace-api";
import { useAuthStore, selectActiveWorkspace } from "@/stores/auth-store";
import { useTeamsStore } from "@/stores/teams-store";
import {
  cancelWorkspaceInvite,
  fetchWorkspaceInvites,
  fetchWorkspacePeople,
  removeWorkspaceMember,
  resendWorkspaceInvite,
  updateWorkspaceMemberRole,
  type WorkspaceInviteRow,
  type WorkspaceMemberRow,
} from "@/lib/api/workspace";
import {
  INVITE_ROLE_MAP,
  ROLE_LABELS,
  WorkspaceInviteForm,
} from "@/components/workspace/WorkspaceInviteForm";
import { ApiError } from "@/lib/api/client";
import {
  avatarColorClassForKey,
  avatarInitialFromName,
} from "@/lib/user-display";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { fetchTeams } from "@/lib/api/teams";
import {
  MemberTeamBadges,
  TeamFilterLabel,
} from "@/components/teams/MemberTeamBadges";

function canManagePeople(role: string) {
  return role === "OWNER" || role === "SUPER_ADMIN" || role === "ADMIN";
}

function canInvitePeople(role: string) {
  return (
    role === "OWNER" ||
    role === "SUPER_ADMIN" ||
    role === "ADMIN" ||
    role === "MEMBER"
  );
}

function canEditMemberRole(
  actorRole: string,
  manage: boolean,
  member: WorkspaceMemberRow,
  currentUserId: string | undefined
) {
  if (!manage || member.id === currentUserId || member.role === "OWNER") {
    return false;
  }
  if (member.role === "SUPER_ADMIN" && actorRole !== "OWNER") {
    return false;
  }
  return true;
}

function formatJoined(iso: string | null) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return "—";
  }
}

function memberRoleSelectValue(role: string) {
  const map: Record<string, string> = {
    MEMBER: "member",
    OWNER: "owner",
    SUPER_ADMIN: "super-admin",
    ADMIN: "admin",
    GUEST: "guest",
    LIMITED_MEMBER: "limited-member",
  };
  return map[role] ?? "member";
}

function MemberPresenceStatus({ member }: { member: WorkspaceMemberRow }) {
  const presence = useUserPresence(member.id, member.presence ?? "offline");

  return (
    <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
      <span className="capitalize">{presenceLabel(presence)}</span>
    </div>
  );
}

function MemberPresenceAvatar({
  member,
}: {
  member: WorkspaceMemberRow;
}) {
  const presence = useUserPresence(member.id, member.presence ?? "offline");

  return (
    <UserAvatarWithPresence
      name={member.fullName}
      avatarUrl={member.avatarUrl}
      presence={presence}
      avatarClassName="size-8"
      dotSize="sm"
      fallbackClassName={avatarColorClassForKey(member.id, member.fullName)}
      fallback={avatarInitialFromName(member.fullName)}
    />
  );
}

export function PeopleView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const showInvitePanel = searchParams.get("invite") === "1";

  const { accessToken, workspaceId, ready } = useWorkspaceApi();
  const workspace = useAuthStore(selectActiveWorkspace);
  const currentUserId = useAuthStore((s) => s.user?.id);
  const actorRole = workspace?.role ?? "MEMBER";
  const teamsRefreshKey = useTeamsStore((s) => s.refreshKey);

  const [reloadKey, setReloadKey] = useState(0);
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<"all" | "members" | "pending">("all");
  const [inviteOpen, setInviteOpen] = useState(showInvitePanel);
  const [members, setMembers] = useState<WorkspaceMemberRow[]>([]);
  const [invites, setInvites] = useState<WorkspaceInviteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteActionId, setInviteActionId] = useState<string | null>(null);
  const [removingMemberId, setRemovingMemberId] = useState<string | null>(null);
  const [memberToRemove, setMemberToRemove] =
    useState<WorkspaceMemberRow | null>(null);
  const [teamFilter, setTeamFilter] = useState<string>("all");
  const [teams, setTeams] = useState<
    { id: string; name: string; color: string; icon: string }[]
  >([]);
  const seedPresence = usePresenceStore((s) => s.seedPresence);

  const manage = canManagePeople(actorRole);
  const canInvite = canInvitePeople(actorRole);
  const canInviteAdmin = actorRole === "OWNER" || actorRole === "SUPER_ADMIN";

  const reload = useCallback(() => setReloadKey((k) => k + 1), []);

  const load = useCallback(async () => {
    if (!ready) return;
    setLoading(true);
    try {
      const peopleRes = await fetchWorkspacePeople(accessToken, workspaceId);
      setMembers(peopleRes.data);
      const teamsRes = await fetchTeams(accessToken, workspaceId);
      setTeams(
        teamsRes.data.map((t) => ({
          id: t.id,
          name: t.name,
          color: t.color,
          icon: t.icon,
        }))
      );
      if (canInvite || manage) {
        const invitesRes = await fetchWorkspaceInvites(accessToken, workspaceId);
        setInvites(invitesRes.data);
      } else {
        setInvites([]);
      }
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Failed to load people"
      );
    } finally {
      setLoading(false);
    }
  }, [ready, accessToken, workspaceId, canInvite, manage]);

  useEffect(() => {
    void load();
  }, [load, reloadKey, teamsRefreshKey]);

  useEffect(() => {
    if (showInvitePanel) setInviteOpen(true);
  }, [showInvitePanel]);

  const closeInviteSheet = () => {
    setInviteOpen(false);
    if (showInvitePanel) router.replace("/people");
  };

  const q = query.trim().toLowerCase();

  const filteredMembers = useMemo(
    () =>
      members.filter((m) => {
        const qMatch =
          !q ||
          m.fullName.toLowerCase().includes(q) ||
          m.email.toLowerCase().includes(q);
        const teamMatch =
          teamFilter === "all" ||
          (m.teams ?? []).some((t) => t.id === teamFilter);
        return qMatch && teamMatch;
      }),
    [members, q, teamFilter]
  );

  const filteredInvites = useMemo(
    () =>
      invites.filter(
        (i) =>
          i.email.toLowerCase().includes(q) ||
          i.role.toLowerCase().includes(q)
      ),
    [invites, q]
  );

  useEffect(() => {
    if (!members.length) return;
    seedPresence(
      members
        .filter((m) => m.presence)
        .map((m) => ({ userId: m.id, status: m.presence! }))
    );
  }, [members, seedPresence]);

  const selectedFilterTeam = useMemo(
    () => teams.find((t) => t.id === teamFilter),
    [teams, teamFilter]
  );

  const showMembers =
    tab === "all" || tab === "members"
      ? filteredMembers
      : [];
  const showPending =
    tab === "all" || tab === "pending"
      ? filteredInvites
      : [];

  const copyLink = async (url: string) => {
    await navigator.clipboard.writeText(url);
    toast.success("Invite link copied");
  };

  const handleResend = async (invite: WorkspaceInviteRow) => {
    setInviteActionId(`resend:${invite.id}`);
    try {
      const result = await resendWorkspaceInvite(
        accessToken,
        workspaceId,
        invite.id
      );
      if (result.emailSent) {
        toast.success(`Invite email resent to ${invite.email}`);
      } else {
        await navigator.clipboard.writeText(result.inviteUrl);
        toast.warning("SMTP not configured — new link copied to clipboard");
      }
      reload();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Resend failed");
    } finally {
      setInviteActionId(null);
    }
  };

  const handleCancel = async (inviteId: string) => {
    setInviteActionId(`cancel:${inviteId}`);
    try {
      await cancelWorkspaceInvite(accessToken, workspaceId, inviteId);
      toast.success("Invite cancelled");
      reload();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Cancel failed");
    } finally {
      setInviteActionId(null);
    }
  };

  const handleRoleChange = async (member: WorkspaceMemberRow, roleKey: string) => {
    const apiRole = INVITE_ROLE_MAP[roleKey] ?? roleKey;
    try {
      await updateWorkspaceMemberRole(
        accessToken,
        workspaceId,
        member.id,
        apiRole
      );
      toast.success("Role updated");
      reload();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Update failed");
    }
  };

  const handleRemove = async (member: WorkspaceMemberRow) => {
    setRemovingMemberId(member.id);
    try {
      await removeWorkspaceMember(accessToken, workspaceId, member.id);
      toast.success(`${member.fullName} removed`);
      reload();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Remove failed");
    } finally {
      setRemovingMemberId(null);
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-background">
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-border px-6 py-4">
        <div>
          <h1 className="text-xl font-semibold">People</h1>
          <p className="text-sm text-muted-foreground">
            {workspace?.name ?? "Workspace"} · {members.length} active
            {invites.length > 0 ? ` · ${invites.length} pending` : ""}
          </p>
        </div>
        {canInvite ? (
          <Button className="gap-2" onClick={() => setInviteOpen(true)}>
            <UserPlusIcon className="size-4" />
            Invite people
          </Button>
        ) : null}
      </header>

      <Sheet open={inviteOpen} onOpenChange={(o) => !o && closeInviteSheet()}>
        <SheetContent side="right" className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Invite people</SheetTitle>
            <SheetDescription>
              Add teammates to {workspace?.name ?? "this workspace"}. They join
              via email link — same flow as ClickUp workspace invites.
            </SheetDescription>
          </SheetHeader>
          {ready ? (
            <WorkspaceInviteForm
              accessToken={accessToken}
              workspaceId={workspaceId}
              canInviteAdmin={canInviteAdmin}
              canInviteSuperAdmin={actorRole === "OWNER"}
              compact
              onSuccess={() => {
                reload();
                closeInviteSheet();
              }}
            />
          ) : null}
        </SheetContent>
      </Sheet>

      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <Tabs
            value={tab}
            onValueChange={(v) => {
              if (v === "all" || v === "members" || v === "pending") setTab(v);
            }}
          >
            <TabsList variant="line" className="w-auto border-0">
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="members">
                Members
                <Badge variant="secondary" className="ml-1.5 h-4 px-1 text-[10px]">
                  {members.length}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="pending">
                Pending
                <Badge variant="secondary" className="ml-1.5 h-4 px-1 text-[10px]">
                  {invites.length}
                </Badge>
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="relative min-w-[200px] flex-1 max-w-sm">
            <SearchIcon className="absolute top-2.5 left-2.5 size-4 text-muted-foreground" />
            <Input
              placeholder="Search by name or email"
              className="h-9 pl-8"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <Select value={teamFilter} onValueChange={(v) => v && setTeamFilter(v)}>
            <SelectTrigger className="h-9 w-[200px]">
              <SelectValue placeholder="All teams">
                {teamFilter === "all" ? (
                  "All teams"
                ) : selectedFilterTeam ? (
                  <TeamFilterLabel team={selectedFilterTeam} />
                ) : null}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All teams</SelectItem>
              {teams.map((t) => (
                <SelectItem key={t.id} value={t.id} label={t.name}>
                  <TeamFilterLabel team={t} />
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading people…</p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-border">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border bg-muted/40 text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Name</th>
                  <th className="px-4 py-2.5 font-medium">Email</th>
                  <th className="px-4 py-2.5 font-medium">Role</th>
                  <th className="min-w-[200px] px-4 py-2.5 font-medium">Teams</th>
                  <th className="px-4 py-2.5 font-medium">Joined</th>
                  <th className="px-4 py-2.5 font-medium">Invited by</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                  {manage ? (
                    <th className="px-4 py-2.5 font-medium text-right">Actions</th>
                  ) : null}
                </tr>
              </thead>
              <tbody>
                {showMembers.map((m) => (
                  <tr
                    key={m.id}
                    className="border-b border-border last:border-0 hover:bg-muted/30"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <MemberPresenceAvatar member={m} />
                        <span className="font-medium">{m.fullName}</span>
                        {m.id === currentUserId ? (
                          <Badge variant="outline" className="text-[10px]">
                            You
                          </Badge>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{m.email}</td>
                    <td className="px-4 py-3">
                      {canEditMemberRole(actorRole, manage, m, currentUserId) ? (
                        <Select
                          value={memberRoleSelectValue(m.role)}
                          onValueChange={(v) => v && handleRoleChange(m, v)}
                        >
                          <SelectTrigger className="h-8 w-[140px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="member">Member</SelectItem>
                            <SelectItem value="limited-member">
                              Limited member
                            </SelectItem>
                            <SelectItem value="guest">Guest</SelectItem>
                            {canInviteAdmin ? (
                              <SelectItem value="admin">Admin</SelectItem>
                            ) : null}
                            {actorRole === "OWNER" ? (
                              <SelectItem value="super-admin">Super admin</SelectItem>
                            ) : null}
                          </SelectContent>
                        </Select>
                      ) : (
                        <span className="capitalize">
                          {ROLE_LABELS[m.role] ?? m.role}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <MemberTeamBadges teams={m.teams ?? []} />
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {formatJoined(m.joinedAt)}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">—</td>
                    <td className="px-4 py-3">
                      <MemberPresenceStatus member={m} />
                    </td>
                    {manage ? (
                      <td className="px-4 py-3 text-right">
                        {canEditMemberRole(actorRole, manage, m, currentUserId) ? (
                          <DropdownMenu>
                            <DropdownMenuTrigger
                              render={
                                <Tooltip>
                                  <TooltipTrigger
                                    render={
                                      <Button
                                        variant="ghost"
                                        size="icon-sm"
                                        aria-label="Member actions"
                                      >
                                        <MoreHorizontalIcon className="size-4" />
                                      </Button>
                                    }
                                  />
                                  <TooltipContent side="bottom">Actions</TooltipContent>
                                </Tooltip>
                              }
                            />
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                variant="destructive"
                                disabled={removingMemberId === m.id}
                                onClick={() => setMemberToRemove(m)}
                              >
                                Remove from workspace
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        ) : null}
                      </td>
                    ) : null}
                  </tr>
                ))}
                {showPending.map((inv) => (
                  <tr
                    key={inv.id}
                    className="border-b border-border last:border-0 hover:bg-muted/30"
                  >
                    <td className="px-4 py-3 text-muted-foreground">—</td>
                    <td className="px-4 py-3">{inv.email}</td>
                    <td className="px-4 py-3 capitalize">
                      {ROLE_LABELS[inv.role] ?? inv.role}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">—</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {inv.invitedBy?.fullName ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        variant={
                          inv.status === "expired" ? "destructive" : "outline"
                        }
                        className="capitalize"
                      >
                        {inv.status === "expired" ? "Expired" : "Pending"}
                      </Badge>
                    </td>
                    {manage ? (
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 gap-1"
                            onClick={() => copyLink(inv.inviteUrl)}
                          >
                            <CopyIcon className="size-3.5" />
                            Copy link
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 gap-1"
                            loading={inviteActionId === `resend:${inv.id}`}
                            loadingText="Resending…"
                            onClick={() => void handleResend(inv)}
                          >
                            <RefreshCwIcon className="size-3.5" />
                            Resend
                          </Button>
                          <Tooltip>
                            <TooltipTrigger
                              render={
                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  loading={inviteActionId === `cancel:${inv.id}`}
                                  onClick={() => void handleCancel(inv.id)}
                                  aria-label="Cancel invite"
                                >
                                  <XIcon className="size-4" />
                                </Button>
                              }
                            />
                            <TooltipContent side="bottom">Cancel invite</TooltipContent>
                          </Tooltip>
                        </div>
                      </td>
                    ) : null}
                  </tr>
                ))}
                {!loading &&
                showMembers.length === 0 &&
                showPending.length === 0 ? (
                  <tr>
                    <td
                      colSpan={manage ? 7 : 6}
                      className="px-4 py-8 text-center text-muted-foreground"
                    >
                      No people match your search.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={memberToRemove !== null}
        onOpenChange={(open) => !open && setMemberToRemove(null)}
        title="Remove from workspace?"
        description={
          memberToRemove
            ? `Remove ${memberToRemove.fullName} from this workspace? They will lose access immediately.`
            : ""
        }
        confirmLabel="Remove"
        loading={memberToRemove !== null && removingMemberId === memberToRemove.id}
        onConfirm={async () => {
          if (!memberToRemove) return;
          await handleRemove(memberToRemove);
          setMemberToRemove(null);
        }}
      />
    </div>
  );
}
