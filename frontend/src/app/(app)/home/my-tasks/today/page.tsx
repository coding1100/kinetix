"use client";

import { Suspense, useState } from "react";
import { BellIcon } from "lucide-react";
import { HomeDataState } from "@/components/home/HomeDataState";
import { MyTasksPageShell } from "@/components/home/MyTasksPageShell";
import { MyTasksTaskSection } from "@/components/home/MyTasksTaskSection";
import { useMyTasksTaskDrawer } from "@/components/home/useMyTasksTaskDrawer";
import { fetchReminders, fetchTasks } from "@/lib/api/home";
import { useHomeQuery } from "@/hooks/use-home-query";
import { useUiStore } from "@/stores/ui-store";

const BASE_PATH = "/home/my-tasks/today";

function TodayOverdueContent() {
  const { openTask } = useMyTasksTaskDrawer(BASE_PATH);
  const openModal = useUiStore((s) => s.openModal);
  const [refreshKey, setRefreshKey] = useState(0);

  const { data: overdue, loading: overdueLoading, error: overdueError } =
    useHomeQuery(
      (token, ws) => fetchTasks(token, ws, "overdue").then((r) => r.data),
      [refreshKey]
    );

  const { data: today, loading: todayLoading, error: todayError } = useHomeQuery(
    (token, ws) => fetchTasks(token, ws, "today").then((r) => r.data),
    [refreshKey]
  );

  const { data: reminders, loading: remindersLoading } = useHomeQuery(
    (token, ws) => fetchReminders(token, ws).then((r) => r.data),
    [refreshKey]
  );

  const loading = overdueLoading || todayLoading || remindersLoading;
  const error = overdueError ?? todayError;

  return (
    <MyTasksPageShell
      title="Today & Overdue"
      subtitle="Stay on top of what's due now and what's coming up."
      basePath={BASE_PATH}
      showToolbar={false}
      showCreateTask
      onTasksRefresh={() => setRefreshKey((k) => k + 1)}
    >
      <HomeDataState loading={loading} error={error}>
        <div className="space-y-4">
          <MyTasksTaskSection
            title="Overdue"
            color="#ef4444"
            tasks={overdue ?? []}
            onTaskSelect={openTask}
            onAddTask={() => openModal("create-task")}
            emptyLabel="No overdue tasks — nice work."
          />
          <MyTasksTaskSection
            title="Today"
            color="#4194f6"
            tasks={today ?? []}
            onTaskSelect={openTask}
            onAddTask={() => openModal("create-task")}
            emptyLabel="Nothing scheduled for today."
          />

          <section className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
            <div className="flex items-center gap-2 px-4 py-2.5">
              <span className="inline-flex items-center rounded-md bg-amber-500 px-2.5 py-0.5 text-[11px] font-bold tracking-wide text-white uppercase">
                Reminders
              </span>
              <span className="text-xs text-muted-foreground tabular-nums">
                {reminders?.length ?? 0}
              </span>
            </div>
            {(reminders?.length ?? 0) > 0 ? (
              <ul>
                {reminders?.map((reminder, index) => (
                  <li
                    key={reminder.id}
                    className={
                      index > 0 ? "border-t border-border/60" : undefined
                    }
                  >
                    <div className="flex items-start gap-3 px-4 py-3">
                      <BellIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{reminder.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {reminder.due}
                        </p>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="border-t border-border/60 px-4 py-3 text-sm text-muted-foreground">
                No reminders set.
              </p>
            )}
          </section>
        </div>
      </HomeDataState>
    </MyTasksPageShell>
  );
}

export default function TodayOverduePage() {
  return (
    <Suspense fallback={null}>
      <TodayOverdueContent />
    </Suspense>
  );
}
