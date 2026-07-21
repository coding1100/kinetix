"use client";

import { PlusIcon } from "lucide-react";
import type { Task } from "@/lib/types/task";
import {
  MyTasksColumnHeader,
  MyTasksTaskRow,
} from "@/components/home/MyTasksTaskRow";
import { cn } from "@/lib/utils";

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

export function MyTasksTaskSection({
  title,
  color,
  tasks,
  onTaskSelect,
  onAddTask,
  showAddTask = true,
  emptyLabel = "No tasks",
}: {
  title: string;
  color: string;
  tasks: Task[];
  onTaskSelect: (taskId: string) => void;
  onAddTask?: () => void;
  showAddTask?: boolean;
  emptyLabel?: string;
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <StatusPill name={title} color={color} count={tasks.length} />
      {tasks.length > 0 ? (
        <>
          <MyTasksColumnHeader />
          {tasks.map((task) => (
            <MyTasksTaskRow
              key={task.id}
              task={task}
              onSelect={() => onTaskSelect(task.id)}
            />
          ))}
        </>
      ) : (
        <p className="border-t border-border/60 px-4 py-3 text-sm text-muted-foreground">
          {emptyLabel}
        </p>
      )}
      {showAddTask && onAddTask ? (
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
      ) : null}
    </section>
  );
}
