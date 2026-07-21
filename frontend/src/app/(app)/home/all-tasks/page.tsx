"use client";

import { Suspense, useMemo, useState } from "react";
import { ChevronDownIcon } from "lucide-react";
import {
  MyTasksGroupedList,
  myTasksStatusFilterOptions,
} from "@/components/home/MyTasksGroupedList";
import { MyTasksPageShell } from "@/components/home/MyTasksPageShell";
import { useMyTasksTaskDrawer } from "@/components/home/useMyTasksTaskDrawer";
import { fetchTasks } from "@/lib/api/home";
import { useHomeQuery } from "@/hooks/use-home-query";
import { useUiStore } from "@/stores/ui-store";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

const TASK_FILTERS = [
  { value: "", label: "All tasks" },
  { value: "assigned", label: "Assigned to me" },
  { value: "personal", label: "Personal list" },
  { value: "today", label: "Due today" },
  { value: "overdue", label: "Overdue" },
] as const;

const BASE_PATH = "/home/all-tasks";

function AllTasksContent() {
  const { openTask } = useMyTasksTaskDrawer(BASE_PATH);
  const openModal = useUiStore((s) => s.openModal);
  const [filter, setFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [refreshKey, setRefreshKey] = useState(0);
  const activeFilter =
    TASK_FILTERS.find((f) => f.value === filter) ?? TASK_FILTERS[0];

  const { data: tasks, loading, error } = useHomeQuery(
    (token, ws) =>
      fetchTasks(token, ws, filter || undefined).then((r) => r.data),
    [filter, refreshKey]
  );

  const statusOptions = useMemo(
    () => myTasksStatusFilterOptions(tasks ?? undefined),
    [tasks]
  );

  return (
    <MyTasksPageShell
      title="All Tasks"
      subtitle="Browse every task in your workspace."
      basePath={BASE_PATH}
      statusFilter={statusFilter}
      onStatusFilterChange={setStatusFilter}
      statusOptions={statusOptions}
      showCreateTask
      onTasksRefresh={() => setRefreshKey((k) => k + 1)}
      headerRight={
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button variant="outline" size="sm" className="h-8 gap-1">
                {activeFilter.label}
                <ChevronDownIcon className="size-3.5 opacity-60" />
              </Button>
            }
          />
          <DropdownMenuContent align="end">
            {TASK_FILTERS.map((f) => (
              <DropdownMenuItem key={f.value || "all"} onClick={() => setFilter(f.value)}>
                {f.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      }
    >
      <MyTasksGroupedList
        tasks={tasks ?? undefined}
        loading={loading}
        error={error}
        statusFilter={statusFilter}
        onTaskSelect={openTask}
        onAddTask={() => openModal("create-task")}
        emptyMessage="No tasks match this filter."
      />
    </MyTasksPageShell>
  );
}

export default function AllTasksPage() {
  return (
    <Suspense fallback={null}>
      <AllTasksContent />
    </Suspense>
  );
}
