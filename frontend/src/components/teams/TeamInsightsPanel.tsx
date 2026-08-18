"use client";

import { useMemo } from "react";
import { ClockIcon, FlagIcon, UsersIcon } from "lucide-react";
import { fetchTasks } from "@/lib/api/home";
import type { TeamDetail } from "@/lib/api/teams";
import type { Task } from "@/lib/types/task";
import { useHomeQuery } from "@/hooks/use-home-query";
import { HomeDataState } from "@/components/home/HomeDataState";
import type { TeamDetailTab } from "@/components/teams/team-utils";

function filterTeamTasks(tasks: Task[], team: TeamDetail) {
  const memberIds = new Set(team.members.map((member) => member.id));
  return tasks.filter((task) =>
    (task.assigneeIds ?? []).some((id) => memberIds.has(id))
  );
}

function isDone(task: Task) {
  return task.statusGroup === "DONE" || task.statusKey === "DONE";
}

function formatDuration(seconds = 0) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return hours ? `${hours}h ${minutes}m` : `${minutes}m`;
}

function TaskRows({ tasks, empty }: { tasks: Task[]; empty: string }) {
  if (tasks.length === 0) {
    return <p className="py-10 text-center text-sm text-muted-foreground">{empty}</p>;
  }
  return (
    <ul className="divide-y divide-border rounded-lg border border-border">
      {tasks.map((task) => (
        <li key={task.id} className="flex items-center gap-3 px-3 py-2.5">
          <span className="size-2 shrink-0 rounded-full" style={{ background: task.statusColor }} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{task.name}</p>
            <p className="truncate text-xs text-muted-foreground">{task.space} / {task.list}</p>
          </div>
          <span className="text-xs text-muted-foreground">{task.status}</span>
        </li>
      ))}
    </ul>
  );
}

export function TeamInsightsPanel({ team, tab }: { team: TeamDetail; tab: TeamDetailTab }) {
  const { data, loading, error } = useHomeQuery(
    (token, workspaceId) => fetchTasks(token, workspaceId).then((res) => res.data),
    [team.id]
  );
  const tasks = useMemo(() => filterTeamTasks(data ?? [], team), [data, team]);
  const active = tasks.filter((task) => !isDone(task));
  const completed = tasks.filter(isDone);
  const priorities = active
    .filter((task) => task.priority === "urgent" || task.priority === "high" || task.overdue)
    .sort((a, b) => Number(Boolean(b.overdue)) - Number(Boolean(a.overdue)));
  const recent = [...tasks]
    .sort((a, b) => Date.parse(b.updatedAt ?? "") - Date.parse(a.updatedAt ?? ""))
    .slice(0, 12);
  const trackedSeconds = tasks.reduce((sum, task) => sum + (task.timeTrackedSeconds ?? 0), 0);
  const workload = team.members.map((member) => ({
    member,
    tasks: active.filter((task) => task.assigneeIds?.includes(member.id)),
  }));

  return (
    <div className="p-6">
      <HomeDataState loading={loading} error={error} empty={false}>
        {tab === "analytics" ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[
              ["Assigned tasks", tasks.length],
              ["Active", active.length],
              ["Completed", completed.length],
              ["Tracked time", formatDuration(trackedSeconds)],
            ].map(([label, value]) => (
              <section key={label} className="rounded-lg border border-border p-4">
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="mt-2 text-2xl font-semibold">{value}</p>
              </section>
            ))}
          </div>
        ) : null}

        {tab === "priorities" ? (
          <section>
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
              <FlagIcon className="size-4" /> Current priorities
            </h2>
            <TaskRows tasks={priorities} empty="No urgent, high-priority, or overdue work." />
          </section>
        ) : null}

        {tab === "team-chart" ? (
          <section>
            <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold">
              <UsersIcon className="size-4" /> Team structure
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {team.members.map((member) => (
                <div key={member.id} className="rounded-lg border border-border p-3">
                  <p className="text-sm font-medium">{member.fullName}</p>
                  <p className="text-xs text-muted-foreground">
                    {member.role === "LEAD" ? "Team lead" : "Member"}
                  </p>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {tab === "standup" ? (
          <section>
            <h2 className="mb-3 text-sm font-semibold">Recently updated work</h2>
            <TaskRows tasks={recent} empty="No recent task updates for this team." />
          </section>
        ) : null}

        {tab === "workload" ? (
          <section className="space-y-3">
            <h2 className="text-sm font-semibold">Active workload</h2>
            {workload.map(({ member, tasks: assigned }) => (
              <div key={member.id} className="rounded-lg border border-border p-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-medium">{member.fullName}</span>
                  <span className="text-xs text-muted-foreground">{assigned.length} active</span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                  <div className="h-full bg-primary" style={{ width: `${Math.min(100, assigned.length * 12.5)}%` }} />
                </div>
              </div>
            ))}
          </section>
        ) : null}

        {tab === "timesheet" ? (
          <section>
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
              <ClockIcon className="size-4" /> Tracked task time
            </h2>
            <ul className="divide-y divide-border rounded-lg border border-border">
              {tasks.filter((task) => (task.timeTrackedSeconds ?? 0) > 0).map((task) => (
                <li key={task.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                  <span className="truncate text-sm">{task.name}</span>
                  <span className="shrink-0 text-sm font-medium">{formatDuration(task.timeTrackedSeconds)}</span>
                </li>
              ))}
            </ul>
            {trackedSeconds === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">No tracked time for team tasks.</p>
            ) : null}
          </section>
        ) : null}
      </HomeDataState>
    </div>
  );
}
