"use client";

import {
  ChevronRightIcon,
  FlagIcon,
  ListTreeIcon,
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
      return "text-blue-400";
    case "low":
      return "text-muted-foreground";
    default:
      return "text-muted-foreground/40";
  }
}

export function ListTaskRow({
  task,
  onSelect,
}: {
  task: Task;
  onSelect: () => void;
}) {
  const commentCount =
    task.commentCount ?? (task.comments ? task.comments.length : 0);
  const subtaskCount =
    task.subtaskCount ?? (task.subtasks ? task.subtasks.length : 0);

  return (
    <button
      type="button"
      onClick={onSelect}
      className="group grid w-full grid-cols-[minmax(0,1fr)_100px_110px_72px] items-center gap-3 border-b border-border/60 px-4 py-2 text-left text-sm transition-colors hover:bg-muted/40"
    >
      <div className="flex min-w-0 items-center gap-2">
        <ChevronRightIcon className="size-3.5 shrink-0 text-muted-foreground/50 opacity-0 group-hover:opacity-100" />
        <span
          className="size-2.5 shrink-0 rounded-full"
          style={{ backgroundColor: task.statusColor }}
          aria-hidden
        />
        <span className="truncate font-medium">{task.name}</span>
        {commentCount > 0 ? (
          <span className="flex shrink-0 items-center gap-0.5 text-xs text-muted-foreground">
            <MessageSquareIcon className="size-3" />
            {commentCount}
          </span>
        ) : null}
        {subtaskCount > 0 ? (
          <span className="flex shrink-0 items-center gap-0.5 text-xs text-muted-foreground">
            <ListTreeIcon className="size-3" />
            {subtaskCount}
          </span>
        ) : null}
      </div>

      <div className="flex items-center gap-1">
        {task.assigneeIds?.length ? (
          task.assigneeIds.slice(0, 3).map((id, index) => (
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

      <div className="flex justify-center">
        <FlagIcon
          className={cn("size-3.5", priorityFlagClass(task.priority))}
          aria-label={task.priority ?? "No priority"}
        />
      </div>
    </button>
  );
}

export function ListTaskColumnHeader() {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_100px_110px_72px] gap-3 border-b border-border bg-muted/30 px-4 py-2 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
      <span>Name</span>
      <span>Assignee</span>
      <span>Due date</span>
      <span className="text-center">Priority</span>
    </div>
  );
}
