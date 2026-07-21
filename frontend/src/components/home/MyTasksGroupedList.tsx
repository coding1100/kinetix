"use client";

import { useMemo } from "react";
import { PlusIcon } from "lucide-react";
import type { Task } from "@/lib/types/task";
import { HomeDataState } from "@/components/home/HomeDataState";
import {
  MyTasksColumnHeader,
  MyTasksTaskRow,
} from "@/components/home/MyTasksTaskRow";
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
  tasks: Task[];
};

const STATUS_ORDER: TaskStatusKey[] = [
  "TODO",
  "OPEN",
  "IN_PROGRESS",
  "DONE",
];

function buildStatusGroups(tasks: Task[]): StatusGroup[] {
  const buckets = new Map<string, StatusGroup>();

  for (const task of tasks) {
    const key =
      (task.statusKey as TaskStatusKey) ||
      taskStatusKeyFromLabel(task.status);
    const groupId = key || task.status;
    if (!buckets.has(groupId)) {
      const fallback = TASK_STATUS_COLUMNS.find((c) => c.key === key);
      buckets.set(groupId, {
        id: groupId,
        name: task.status.toUpperCase(),
        color: task.statusColor || fallback?.color || "#87909e",
        tasks: [],
      });
    }
    buckets.get(groupId)!.tasks.push(task);
  }

  return [...buckets.values()]
    .filter((group) => group.tasks.length > 0)
    .sort((a, b) => {
      const ai = STATUS_ORDER.indexOf(a.id as TaskStatusKey);
      const bi = STATUS_ORDER.indexOf(b.id as TaskStatusKey);
      if (ai !== -1 && bi !== -1) return ai - bi;
      if (ai !== -1) return -1;
      if (bi !== -1) return 1;
      return a.name.localeCompare(b.name);
    });
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

export function MyTasksGroupedList({
  tasks,
  loading,
  error,
  statusFilter,
  onTaskSelect,
  onAddTask,
  emptyMessage = "No tasks assigned to you yet.",
}: {
  tasks: Task[] | undefined;
  loading: boolean;
  error: string | null;
  statusFilter: string;
  onTaskSelect: (taskId: string) => void;
  onAddTask: () => void;
  emptyMessage?: string;
}) {
  const groups = useMemo(() => {
    const all = buildStatusGroups(tasks ?? []);
    if (statusFilter === "all") return all;
    return all.filter((group) => group.id === statusFilter);
  }, [tasks, statusFilter]);

  const isEmpty = !loading && !error && (tasks?.length ?? 0) === 0;

  return (
    <HomeDataState loading={loading} error={error} empty={isEmpty} emptyMessage={emptyMessage}>
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
            <MyTasksColumnHeader />
            {group.tasks.map((task) => (
              <MyTasksTaskRow
                key={task.id}
                task={task}
                onSelect={() => onTaskSelect(task.id)}
              />
            ))}
            <button
              type="button"
              onClick={onAddTask}
              className={cn(
                "flex w-full items-center gap-2 border-t border-border/60 px-4 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-muted/30 hover:text-foreground"
              )}
            >
              <PlusIcon className="size-3.5" />
              Add task
            </button>
          </section>
        ))}
      </div>
    </HomeDataState>
  );
}

export function myTasksStatusFilterOptions(tasks: Task[] | undefined) {
  return buildStatusGroups(tasks ?? []).map((group) => ({
    id: group.id,
    name: group.name,
  }));
}
