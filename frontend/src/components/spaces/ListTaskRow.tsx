"use client";

import { useState } from "react";
import {
  ChevronRightIcon,
  FlagIcon,
  ListTreeIcon,
  MessageSquareIcon,
  MoreHorizontalIcon,
  Trash2Icon,
} from "lucide-react";
import { toast } from "sonner";
import type { Task } from "@/lib/types/task";
import type { TaskPriority } from "@/lib/task-priority";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { deleteTask } from "@/lib/api/spaces";
import { useWorkspaceApi } from "@/hooks/use-workspace-api";
import { useSpacesStore } from "@/stores/spaces-store";
import {
  avatarColorClassForKey,
  avatarInitialFromName,
} from "@/lib/user-display";
import { cn } from "@/lib/utils";
import { FEATURE_FLAGS } from "@/lib/feature-flags";

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
  onDeleted,
}: {
  task: Task;
  onSelect: () => void;
  onDeleted?: () => void;
}) {
  const commentCount =
    task.commentCount ?? (task.comments ? task.comments.length : 0);
  const subtaskCount =
    task.subtaskCount ?? (task.subtasks ? task.subtasks.length : 0);
  const { accessToken, workspaceId, ready } = useWorkspaceApi();
  const bumpSpacesRefresh = useSpacesStore((s) => s.bumpRefresh);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!ready) return;
    setDeleting(true);
    try {
      await deleteTask(accessToken, workspaceId, task.id);
      setDeleteOpen(false);
      toast.success("Task deleted");
      bumpSpacesRefresh();
      onDeleted?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete task");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
      className="group grid w-full cursor-pointer grid-cols-[minmax(0,1fr)_100px_110px_72px_32px] items-center gap-3 border-b border-border/60 px-4 py-2 text-left text-sm transition-colors hover:bg-muted/40"
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
        {FEATURE_FLAGS.subtasks && subtaskCount > 0 ? (
          <span className="flex shrink-0 items-center gap-0.5 text-xs text-muted-foreground">
            <ListTreeIcon className="size-3" />
            {subtaskCount}
          </span>
        ) : null}
      </div>

      <div className="flex items-center gap-1">
        {task.assigneeIds?.length ? (
          task.assigneeIds.slice(0, 3).map((id, index) => (
            <Avatar
              key={id}
              className={cn(
                "size-6 border border-background",
                task.disabledAssigneeIds?.includes(id) && "opacity-50"
              )}
              title={
                task.disabledAssigneeIds?.includes(id)
                  ? `${task.assignees[index] ?? "Member"} (deactivated)`
                  : undefined
              }
            >
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

      <div className="flex justify-center" onClick={(e) => e.stopPropagation()}>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="size-6 shrink-0 opacity-0 group-hover:opacity-100 data-[popup-open]:opacity-100"
                aria-label={`Actions for ${task.name}`}
              >
                <MoreHorizontalIcon className="size-3.5" />
              </Button>
            }
          />
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              variant="destructive"
              onClick={() => setDeleteOpen(true)}
            >
              <Trash2Icon className="size-4" />
              Delete task
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>

    <ConfirmDialog
      open={deleteOpen}
      onOpenChange={setDeleteOpen}
      title="Delete task?"
      description="This task will be permanently deleted. This cannot be undone."
      confirmLabel="Delete task"
      loading={deleting}
      onConfirm={() => void handleDelete()}
    />
    </>
  );
}

export function ListTaskColumnHeader() {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_100px_110px_72px_32px] gap-3 border-b border-border bg-muted/30 px-4 py-2 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
      <span>Name</span>
      <span>Assignee</span>
      <span>Due date</span>
      <span className="text-center">Priority</span>
      <span />
    </div>
  );
}
