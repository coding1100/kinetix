"use client";

import { useMemo } from "react";
import Link from "next/link";
import { BarChart3Icon, NetworkIcon } from "lucide-react";
import { fetchTeams } from "@/lib/api/teams";
import { fetchTasks } from "@/lib/api/home";
import { useHomeQuery } from "@/hooks/use-home-query";
import { HomeDataState } from "@/components/home/HomeDataState";

export function TeamsInsightsView({ mode }: { mode: "org-chart" | "analytics" }) {
  const teamsQuery = useHomeQuery(
    (token, workspaceId) => fetchTeams(token, workspaceId).then((res) => res.data),
    []
  );
  const tasksQuery = useHomeQuery(
    (token, workspaceId) => fetchTasks(token, workspaceId).then((res) => res.data),
    []
  );
  const teams = teamsQuery.data ?? [];
  const tasks = tasksQuery.data ?? [];
  const memberIds = useMemo(
    () => new Set(teams.flatMap((team) => team.membersPreview.map((member) => member.id))),
    [teams]
  );
  const assignedTasks = tasks.filter((task) =>
    task.assigneeIds?.some((id) => memberIds.has(id))
  );
  const completed = assignedTasks.filter(
    (task) => task.statusGroup === "DONE" || task.statusKey === "DONE"
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <header className="shrink-0 border-b border-border px-6 py-4">
        <h1 className="flex items-center gap-2 text-xl font-semibold">
          {mode === "org-chart" ? <NetworkIcon className="size-5" /> : <BarChart3Icon className="size-5" />}
          {mode === "org-chart" ? "Organization Chart" : "Team Analytics"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {mode === "org-chart" ? "Workspace teams, leads, and membership." : "Live workspace team and task coverage."}
        </p>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto p-6">
        <HomeDataState
          loading={teamsQuery.loading || (mode === "analytics" && tasksQuery.loading)}
          error={teamsQuery.error ?? (mode === "analytics" ? tasksQuery.error : null)}
          empty={teams.length === 0}
          emptyMessage="No teams are configured in this workspace."
        >
          {mode === "org-chart" ? (
            <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
              {teams.map((team) => {
                const leads = team.membersPreview.filter((member) => member.role === "LEAD");
                const members = team.membersPreview.filter((member) => member.role !== "LEAD");
                return (
                  <section key={team.id} className="rounded-lg border border-border p-4">
                    <Link href={`/teams/${team.id}`} className="flex items-center gap-3 font-semibold hover:underline">
                      <span className="flex size-8 items-center justify-center rounded text-xs font-bold text-white" style={{ background: team.color }}>
                        {team.icon || team.name.slice(0, 1)}
                      </span>
                      {team.name}
                    </Link>
                    <div className="mt-4 space-y-3 text-sm">
                      <div><p className="text-xs font-medium text-muted-foreground">Leads</p><p className="mt-1">{leads.map((member) => member.fullName).join(", ") || "No lead assigned"}</p></div>
                      <div><p className="text-xs font-medium text-muted-foreground">Members</p><p className="mt-1">{members.map((member) => member.fullName).join(", ") || "No additional members"}</p></div>
                    </div>
                  </section>
                );
              })}
            </div>
          ) : (
            <div className="space-y-5">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {[["Teams", teams.length], ["Members in teams", memberIds.size], ["Assigned tasks", assignedTasks.length], ["Completed tasks", completed.length]].map(([label, value]) => (
                  <section key={label} className="rounded-lg border border-border p-4">
                    <p className="text-xs text-muted-foreground">{label}</p><p className="mt-2 text-2xl font-semibold">{value}</p>
                  </section>
                ))}
              </div>
              <div className="overflow-hidden rounded-lg border border-border">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-border bg-muted/30 text-xs text-muted-foreground"><tr><th className="px-3 py-2 font-medium">Team</th><th className="px-3 py-2 font-medium">Members</th><th className="px-3 py-2 font-medium">Leads</th></tr></thead>
                  <tbody className="divide-y divide-border">
                    {teams.map((team) => <tr key={team.id}><td className="px-3 py-2.5 font-medium"><Link href={`/teams/${team.id}`} className="hover:underline">{team.name}</Link></td><td className="px-3 py-2.5">{team.memberCount}</td><td className="px-3 py-2.5">{team.membersPreview.filter((member) => member.role === "LEAD").length}</td></tr>)}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </HomeDataState>
      </div>
    </div>
  );
}
