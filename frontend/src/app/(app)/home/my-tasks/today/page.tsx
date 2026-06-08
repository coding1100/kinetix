"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/shared/PageHeader";
import { TaskRow } from "@/components/shared/TaskRow";
import { HomeDataState } from "@/components/home/HomeDataState";
import { fetchReminders, fetchTasks } from "@/lib/api/home";
import type { Task } from "@/lib/types/task";
import { useWorkspaceApi } from "@/hooks/use-workspace-api";
import { ApiError } from "@/lib/api/client";

export default function TodayOverduePage() {
  const { accessToken, workspaceId, ready } = useWorkspaceApi();
  const [overdue, setOverdue] = useState<Task[]>([]);
  const [today, setToday] = useState<Task[]>([]);
  const [reminders, setReminders] = useState<
    { id: string; title: string; due: string }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ready) return;
    setLoading(true);
    Promise.all([
      fetchTasks(accessToken, workspaceId, "overdue"),
      fetchTasks(accessToken, workspaceId, "today"),
      fetchReminders(accessToken, workspaceId),
    ])
      .then(([o, t, r]) => {
        setOverdue(o.data);
        setToday(t.data);
        setReminders(r.data);
      })
      .catch((err) =>
        setError(err instanceof ApiError ? err.message : "Failed to load")
      )
      .finally(() => setLoading(false));
  }, [ready, accessToken, workspaceId]);

  return (
    <>
      <PageHeader title="Today & Overdue" />
      <HomeDataState loading={loading} error={error}>
        <div className="flex-1 overflow-y-auto p-4">
          <h2 className="mb-2 text-xs font-semibold uppercase text-red-500">
            Overdue
          </h2>
          {overdue.map((t) => (
            <TaskRow key={t.id} task={t} />
          ))}
          <h2 className="mt-6 mb-2 text-xs font-semibold uppercase text-muted-foreground">
            Agenda
          </h2>
          {today.map((t) => (
            <TaskRow key={t.id} task={t} />
          ))}
          <h2 className="mt-6 mb-2 text-xs font-semibold uppercase text-muted-foreground">
            Reminders
          </h2>
          {reminders.map((r) => (
            <div
              key={r.id}
              className="mb-2 rounded-lg border border-border bg-card px-4 py-2 text-sm"
            >
              {r.title} — {r.due}
            </div>
          ))}
        </div>
      </HomeDataState>
    </>
  );
}
