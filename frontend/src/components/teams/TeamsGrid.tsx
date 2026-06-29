"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PlusIcon, SearchIcon } from "lucide-react";
import { fetchTeams } from "@/lib/api/teams";
import { useHomeQuery } from "@/hooks/use-home-query";
import { useWorkspaceApi } from "@/hooks/use-workspace-api";
import { useTeamsStore } from "@/stores/teams-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { HomeDataState } from "@/components/home/HomeDataState";
import { TeamCard } from "@/components/teams/TeamCard";
import { CreateTeamDialog } from "@/components/teams/CreateTeamDialog";

export function TeamsGrid({ initialCreateOpen = false }: { initialCreateOpen?: boolean }) {
  const router = useRouter();
  const { ready } = useWorkspaceApi();
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("name");
  const [order, setOrder] = useState("asc");
  const [createOpen, setCreateOpen] = useState(initialCreateOpen);
  const refreshKey = useTeamsStore((s) => s.refreshKey);
  const bumpRefresh = useTeamsStore((s) => s.bumpRefresh);

  useEffect(() => {
    if (initialCreateOpen) setCreateOpen(true);
  }, [initialCreateOpen]);

  const handleCreateOpenChange = (open: boolean) => {
    setCreateOpen(open);
    if (!open && initialCreateOpen) router.replace("/teams");
  };

  const { data: teams, loading, error } = useHomeQuery(
    (token, ws) =>
      fetchTeams(token, ws, { sort, order }).then((r) => r.data),
    [sort, order, refreshKey]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!teams || !q) return teams ?? [];
    return teams.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        (t.description ?? "").toLowerCase().includes(q)
    );
  }, [teams, query]);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-border px-6 py-4">
        <div>
          <h1 className="text-xl font-semibold">All Teams</h1>
          <p className="text-sm text-muted-foreground">
            Organize people into teams across your workspace
          </p>
        </div>
        <Button className="gap-2" onClick={() => setCreateOpen(true)}>
          <PlusIcon className="size-4" />
          Create Team
        </Button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="relative min-w-[200px] flex-1 max-w-sm">
            <SearchIcon className="absolute top-2.5 left-2.5 size-4 text-muted-foreground" />
            <Input
              placeholder="Search teams"
              className="h-9 pl-8"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <Select value={sort} onValueChange={(v) => v && setSort(v)}>
            <SelectTrigger className="h-9 w-[148px]">
              <SelectValue>
                {sort === "name"
                  ? "Sort: Name"
                  : sort === "members"
                    ? "Sort: Members"
                    : "Sort: Created"}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="name">Name</SelectItem>
              <SelectItem value="members">Members</SelectItem>
              <SelectItem value="created">Created</SelectItem>
            </SelectContent>
          </Select>
          <Select value={order} onValueChange={(v) => v && setOrder(v)}>
            <SelectTrigger className="h-9 w-[132px]">
              <SelectValue>
                {order === "asc" ? "Ascending" : "Descending"}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="asc">Ascending</SelectItem>
              <SelectItem value="desc">Descending</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <HomeDataState
          loading={loading}
          error={error}
          empty={ready && !loading && filtered.length === 0}
          emptyMessage="No teams yet. Create one to get started."
        >
          <div className="grid gap-5 sm:grid-cols-2 2xl:grid-cols-3">
            {filtered.map((team) => (
              <TeamCard key={team.id} team={team} />
            ))}
          </div>
        </HomeDataState>
      </div>

      {ready ? (
        <CreateTeamDialog
          open={createOpen}
          onOpenChange={handleCreateOpenChange}
          onCreated={() => bumpRefresh()}
        />
      ) : null}
    </div>
  );
}
