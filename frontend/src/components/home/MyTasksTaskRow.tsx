"use client";

import {
  ChevronRightIcon,
  FlagIcon,
  MessageSquareIcon,
} from "lucide-react";
import type { Task } from "@/lib/types/task";
import type { TaskPriority } from "@/lib/task-priority";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  avatarColorClassForKey,
  avatarInitialFromName,
} from "@/lib/user-display";
import { cn } from "@/lib/utils";

function priorityFlagClass(priority?: TaskPriority) {
  switch (priority) {
    case "urgent":
      return "text-red-500";
    case "high":
      return "text-amber-500";
    case "normal":
      return "text-blue-500";
    case "low":
      return "text-muted-foreground";
    default:
      return "text-muted-foreground/40";
  }
}

function priorityLabel(priority?: TaskPriority) {
  if (!priority) return null;
  return priority.charAt(0).toUpperCase() + priority.slice(1);
}

export function MyTasksColumnHeader() {
  return (
    <div className="grid grid-cols-[minmax(0,1.4fr)_100px_110px_100px_88px] gap-3 border-b border-border bg-muted/30 px-4 py-2 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
      <span>Name</span>
      <span>Priority</span>
      <span>Due date</span>
      <span>Assignee</span>
      <span className="text-center">Comments</span>
    </div>
  );
}

export function MyTasksTaskRow({
  task,
  onSelect,
}: {
  task: Task;
  onSelect: () => void;
}) {
  const commentCount =
    task.commentCount ?? (task.comments ? task.comments.length : 0);

  return (
    <button
      type="button"
      onClick={onSelect}
      className="group grid w-full grid-cols-[minmax(0,1.4fr)_100px_110px_100px_88px] items-center gap-3 border-b border-border/60 px-4 py-2.5 text-left text-sm transition-colors hover:bg-muted/40"
    >
      <div className="flex min-w-0 items-center gap-2">
        <ChevronRightIcon className="size-3.5 shrink-0 text-muted-foreground/40 opacity-0 group-hover:opacity-100" />
        <span
          className="size-2.5 shrink-0 rounded-full"
          style={{ backgroundColor: task.statusColor }}
          aria-hidden
        />
        <div className="min-w-0">
          <p className="truncate font-medium">{task.name}</p>
          <p className="truncate text-xs text-muted-foreground">
            {task.space} · {task.list}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-1.5">
        <FlagIcon
          className={cn("size-3.5 shrink-0", priorityFlagClass(task.priority))}
        />
        <span className="truncate text-xs text-muted-foreground capitalize">
          {priorityLabel(task.priority) ?? "—"}
        </span>
      </div>

      <span
        className={cn(
          "text-xs",
          task.overdue
            ? "font-medium text-destructive"
            : task.dueDate
              ? "text-foreground"
              : "text-muted-foreground"
        )}
      >
        {task.dueDate ?? "—"}
      </span>

      <div className="flex items-center gap-1">
        {task.assigneeIds?.length ? (
          task.assigneeIds.slice(0, 2).map((id, index) => (
            <Avatar key={id} className="size-6 border border-background">
              <AvatarFallback
                className={cn(
                  "text-[10px] text-white",
                  avatarColorClassForKey(id)
                )}
              >
                {avatarInitialFromName(task.assignees[index] ?? id)}
              </AvatarFallback>
            </Avatar>
          ))
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </div>

      <div className="flex justify-center">
        {commentCount > 0 ? (
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <MessageSquareIcon className="size-3.5" />
            {commentCount}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </div>
    </button>
  );
}
