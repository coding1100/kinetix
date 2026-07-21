"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  addTeamMember,
  deleteTeam,
  fetchTeam,
  removeTeamMember,
  type TeamDetail,
} from "@/lib/api/teams";
import { fetchWorkspacePeople } from "@/lib/api/workspace";
import { useWorkspaceApi } from "@/hooks/use-workspace-api";
import { useAuthStore, selectActiveWorkspace } from "@/stores/auth-store";
import { ApiError } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { EditTeamDialog } from "@/components/teams/EditTeamDialog";
import { TeamDetailHeader } from "@/components/teams/TeamDetailHeader";
import { TeamDetailSidebar } from "@/components/teams/TeamDetailSidebar";
import { TeamMembersPanel } from "@/components/teams/TeamMembersPanel";
import { TeamOverviewPanel } from "@/components/teams/TeamOverviewPanel";
import { TEAM_DETAIL_TABS, type TeamDetailTab } from "@/components/teams/team-utils";
import { useTeamsStore } from "@/stores/teams-store";

function canManageTeam(
  actorRole: string,
  team: TeamDetail | null,
  currentUserId: string | undefined
) {
  if (actorRole === "OWNER" || actorRole === "SUPER_ADMIN" || actorRole === "ADMIN") {
    return true;
  }
  if (!team || !currentUserId) return false;
  return team.members.some((m) => m.id === currentUserId && m.role === "LEAD");
}

function parseTab(value: string | null): TeamDetailTab {
  const match = TEAM_DETAIL_TABS.find((t) => t.id === value && t.enabled);
  return match?.id ?? "overview";
}

export function TeamDetailView({ teamId }: { teamId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { accessToken, workspaceId, ready } = useWorkspaceApi();
  const workspace = useAuthStore(selectActiveWorkspace);
  const currentUserId = useAuthStore((s) => s.user?.id);
  const actorRole = workspace?.role ?? "MEMBER";
  const bumpTeamsRefresh = useTeamsStore((s) => s.bumpRefresh);

  const tab = parseTab(searchParams.get("tab"));

  const [team, setTeam] = useState<TeamDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [people, setPeople] = useState<{ id: string; fullName: string }[]>([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [busy, setBusy] = useState(false);

  const manage = canManageTeam(actorRole, team, currentUserId);

  const selectedPerson = useMemo(
    () => people.find((p) => p.id === selectedUserId),
    [people, selectedUserId]
  );

  const setTab = useCallback(
    (next: TeamDetailTab) => {
      const params = new URLSearchParams(searchParams.toString());
      if (next === "overview") params.delete("tab");
      else params.set("tab", next);
      const qs = params.toString();
      router.replace(qs ? `/teams/${teamId}?${qs}` : `/teams/${teamId}`);
    },
    [router, searchParams, teamId]
  );

  const openAddMember = useCallback(() => {
    setSelectedUserId("");
    setAddOpen(true);
  }, []);

  const load = useCallback(async () => {
    if (!ready) return;
    setLoading(true);
    try {
      const detail = await fetchTeam(accessToken, workspaceId, teamId);
      setTeam(detail);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to load team");
    } finally {
      setLoading(false);
    }
  }, [ready, accessToken, workspaceId, teamId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!addOpen || !ready) return;
    void fetchWorkspacePeople(accessToken, workspaceId).then((res) => {
      const memberIds = new Set(team?.members.map((m) => m.id) ?? []);
      setPeople(res.data.filter((p) => !memberIds.has(p.id)));
    });
  }, [addOpen, ready, accessToken, workspaceId, team?.members]);

  const handleAddMember = async () => {
    if (!selectedUserId || !ready) return;
    setBusy(true);
    try {
      const updated = await addTeamMember(
        accessToken,
        workspaceId,
        teamId,
        selectedUserId
      );
      setTeam(updated);
      bumpTeamsRefresh();
      setAddOpen(false);
      setSelectedUserId("");
      toast.success("Member added");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to add member");
    } finally {
      setBusy(false);
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!ready) return;
    setBusy(true);
    try {
      const updated = await removeTeamMember(
        accessToken,
        workspaceId,
        teamId,
        userId
      );
      setTeam(updated);
      bumpTeamsRefresh();
      toast.success("Member removed");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to remove member");
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!ready) return;
    setBusy(true);
    try {
      await deleteTeam(accessToken, workspaceId, teamId);
      bumpTeamsRefresh();
      toast.success("Team deleted");
      router.push("/teams");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to delete team");
    } finally {
      setBusy(false);
      setDeleteOpen(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center p-8 text-sm text-muted-foreground">
        Loading team…
      </div>
    );
  }

  if (!team) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8">
        <p className="text-sm text-muted-foreground">Team not found</p>
        <Button variant="outline" onClick={() => router.push("/teams")}>
          Back to teams
        </Button>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <TeamDetailHeader
        team={team}
        tab={tab}
        onTabChange={setTab}
        manage={manage}
        onEdit={() => setEditOpen(true)}
        onAddMember={openAddMember}
        onDelete={() => setDeleteOpen(true)}
      />

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <div className="min-h-0 min-w-0 flex-1 overflow-y-auto">
          {tab === "overview" ? (
            <TeamOverviewPanel
              team={team}
              manage={manage}
              onUpdated={setTeam}
            />
          ) : (
            <TeamMembersPanel
              team={team}
              manage={manage}
              busy={busy}
              onAddMember={openAddMember}
              onRemoveMember={(id) => void handleRemoveMember(id)}
            />
          )}
        </div>

        <TeamDetailSidebar
          team={team}
          manage={manage}
          onTabChange={setTab}
          onAddMember={openAddMember}
        />
      </div>

      <EditTeamDialog
        team={team}
        open={editOpen}
        onOpenChange={setEditOpen}
        onUpdated={(updated) => {
          setTeam(updated);
          bumpTeamsRefresh();
        }}
      />

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add team member</DialogTitle>
          </DialogHeader>
          <Select
            value={selectedUserId || null}
            onValueChange={(v) => v && setSelectedUserId(v)}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select a person">
                {selectedPerson?.fullName}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {people.map((p) => (
                <SelectItem key={p.id} value={p.id} label={p.fullName}>
                  {p.fullName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>
              Cancel
            </Button>
            <Button disabled={!selectedUserId || busy} onClick={() => void handleAddMember()}>
              Add
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete team?"
        description={`Permanently delete "${team.name}"? Members stay in the workspace.`}
        confirmLabel="Delete team"
        confirmVariant="destructive"
        loading={busy}
        onConfirm={() => void handleDelete()}
      />
    </div>
  );
}
