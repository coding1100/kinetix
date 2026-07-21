"use client";

import { useMemo } from "react";
import { PlusIcon } from "lucide-react";
import type { ListStatus, Task } from "@/lib/types/task";
import { HomeDataState } from "@/components/home/HomeDataState";
import { ListTaskColumnHeader, ListTaskRow } from "@/components/spaces/ListTaskRow";
import { cn } from "@/lib/utils";
import {
  TASK_STATUS_COLUMNS,
  taskStatusKeyFromLabel,
  type TaskStatusKey,
} from "@/lib/task-status";

type StatusGroup = {
  id: string;
  name: string;
  color: string;
  legacyKey?: string | null;
  tasks: Task[];
};

function resolveTaskStatusId(task: Task, statuses: ListStatus[]): string {
  if (task.statusId && statuses.some((s) => s.id === task.statusId)) {
    return task.statusId;
  }
  const legacy =
    (task.statusKey as TaskStatusKey) || taskStatusKeyFromLabel(task.status);
  const byLegacy = statuses.find((s) => s.legacyKey === legacy);
  if (byLegacy) return byLegacy.id;
  const byName = statuses.find(
    (s) => s.name.toLowerCase() === task.status.toLowerCase()
  );
  return byName?.id ?? statuses[0]?.id ?? legacy;
}

function buildStatusGroups(
  tasks: Task[],
  statuses?: ListStatus[]
): StatusGroup[] {
  if (statuses?.length) {
    const sorted = [...statuses].sort((a, b) => a.sortOrder - b.sortOrder);
    const buckets = new Map<string, Task[]>();
    for (const status of sorted) {
      buckets.set(status.id, []);
    }
    for (const task of tasks) {
      const id = resolveTaskStatusId(task, sorted);
      if (!buckets.has(id)) buckets.set(id, []);
      buckets.get(id)!.push(task);
    }
    return sorted.map((status) => ({
      id: status.id,
      name: status.name,
      color: status.color,
      legacyKey: status.legacyKey,
      tasks: buckets.get(status.id) ?? [],
    }));
  }

  const columns = TASK_STATUS_COLUMNS.map((col) => ({
    id: col.key,
    name: col.label,
    color: col.color,
    legacyKey: col.key,
    tasks: [] as Task[],
  }));
  for (const task of tasks) {
    const legacy =
      (task.statusKey as TaskStatusKey) || taskStatusKeyFromLabel(task.status);
    const group = columns.find((c) => c.id === legacy) ?? columns[0];
    group.tasks.push(task);
  }
  return columns;
}

function StatusPill({
  name,
  color,
  count,
}: {
  name: string;
  color: string;
  count: number;
}) {
  return (
    <div className="flex items-center gap-2 px-4 py-2.5">
      <span
        className="inline-flex items-center rounded-md px-2.5 py-0.5 text-[11px] font-bold tracking-wide text-white uppercase"
        style={{ backgroundColor: color }}
      >
        {name}
      </span>
      <span className="text-xs text-muted-foreground tabular-nums">{count}</span>
    </div>
  );
}

export function ListViewGrouped({
  tasks,
  statuses,
  loading,
  error,
  statusFilter,
  onTaskSelect,
  onAddTask,
}: {
  tasks: Task[] | undefined;
  statuses?: ListStatus[];
  loading: boolean;
  error: string | null;
  statusFilter: string;
  onTaskSelect: (taskId: string) => void;
  onAddTask: () => void;
}) {
  const groups = useMemo(() => {
    const rows = tasks ?? [];
    const all = buildStatusGroups(rows, statuses);
    if (statusFilter === "all") return all;
    return all.filter((group) => group.id === statusFilter);
  }, [tasks, statuses, statusFilter]);

  const isEmpty = !loading && !error && (tasks?.length ?? 0) === 0;

  return (
    <HomeDataState
      loading={loading}
      error={error}
      empty={isEmpty}
      emptyMessage="No tasks in this list yet. Create one to get started."
    >
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <div className="space-y-4">
          {groups.map((group) => (
            <section
              key={group.id}
              className="overflow-hidden rounded-xl border border-border bg-card shadow-sm"
            >
              <StatusPill
                name={group.name}
                color={group.color}
                count={group.tasks.length}
              />
              {group.tasks.length > 0 ? (
                <>
                  <ListTaskColumnHeader />
                  {group.tasks.map((task) => (
                    <ListTaskRow
                      key={task.id}
                      task={task}
                      onSelect={() => onTaskSelect(task.id)}
                    />
                  ))}
                </>
              ) : null}
              <button
                type="button"
                onClick={onAddTask}
                className={cn(
                  "flex w-full items-center gap-2 px-4 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-muted/30 hover:text-foreground",
                  group.tasks.length === 0 && "border-t border-border/60"
                )}
              >
                <PlusIcon className="size-3.5" />
                Add task
              </button>
            </section>
          ))}
        </div>
      </div>
    </HomeDataState>
  );
}
