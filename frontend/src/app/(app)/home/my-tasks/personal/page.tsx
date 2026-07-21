"use client";

import { Suspense, useMemo, useState } from "react";
import { MyTasksGroupedList, myTasksStatusFilterOptions } from "@/components/home/MyTasksGroupedList";
import { MyTasksPageShell } from "@/components/home/MyTasksPageShell";
import { useMyTasksTaskDrawer } from "@/components/home/useMyTasksTaskDrawer";
import { fetchTasks } from "@/lib/api/home";
import { useHomeQuery } from "@/hooks/use-home-query";
import { useUiStore } from "@/stores/ui-store";

const BASE_PATH = "/home/my-tasks/personal";

function PersonalListContent() {
  const { openTask } = useMyTasksTaskDrawer(BASE_PATH);
  const openModal = useUiStore((s) => s.openModal);
  const [statusFilter, setStatusFilter] = useState("all");
  const [refreshKey, setRefreshKey] = useState(0);

  const { data: tasks, loading, error } = useHomeQuery(
    (token, ws) => fetchTasks(token, ws, "personal").then((r) => r.data),
    [refreshKey]
  );

  const statusOptions = useMemo(
    () => myTasksStatusFilterOptions(tasks ?? undefined),
    [tasks]
  );

  return (
    <MyTasksPageShell
      title="Personal List"
      subtitle="Quick personal todos in your workspace."
      basePath={BASE_PATH}
      statusFilter={statusFilter}
      onStatusFilterChange={setStatusFilter}
      statusOptions={statusOptions}
      showCreateTask
      onTasksRefresh={() => setRefreshKey((k) => k + 1)}
    >
      <MyTasksGroupedList
        tasks={tasks ?? undefined}
        loading={loading}
        error={error}
        statusFilter={statusFilter}
        onTaskSelect={openTask}
        onAddTask={() => openModal("create-task")}
        emptyMessage="No tasks in your personal list yet."
      />
    </MyTasksPageShell>
  );
}

export default function PersonalListPage() {
  return (
    <Suspense fallback={null}>
      <PersonalListContent />
    </Suspense>
  );
}
