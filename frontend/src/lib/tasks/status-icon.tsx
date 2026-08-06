import {
  ArchiveIcon,
  CheckCircle2Icon,
  CircleDashedIcon,
  CircleDotIcon,
  CircleIcon,
  FlaskConicalIcon,
  Loader2Icon,
  RocketIcon,
  ShieldCheckIcon,
  SquareCheckBigIcon,
  Undo2Icon,
  WandSparklesIcon,
  type LucideIcon,
} from "lucide-react";

/** Fallback by statusGroup, for any status name not special-cased below
 * (including legacy tasks with no ListStatus row at all). */
export function statusGroupIcon(group: string): LucideIcon {
  switch (group) {
    case "ACTIVE":
      return CircleDotIcon;
    case "DONE":
      return CheckCircle2Icon;
    case "CLOSED":
      return ArchiveIcon;
    default:
      return CircleIcon;
  }
}

/**
 * Same status -> icon mapping ClickUp-style workflows use in the task
 * drawer's status picker - shared so the Inbox notification icon shows the
 * task's actual status glyph instead of a generic per-notification-type one.
 */
export function statusIcon(status: { name: string; statusGroup: string }): LucideIcon {
  const name = status.name.trim().toLowerCase();
  if (name === "backlog") return CircleIcon;
  if (name === "grooming") return WandSparklesIcon;
  if (name === "todo") return CircleDashedIcon;
  if (name === "ready for development") return RocketIcon;
  if (name === "in progress") return Loader2Icon;
  if (name === "in ui integration ready") return SquareCheckBigIcon;
  if (name === "in qa ready") return FlaskConicalIcon;
  if (name === "in qa") return ShieldCheckIcon;
  if (name === "in qa sent back") return Undo2Icon;
  if (name === "done") return CheckCircle2Icon;
  if (name === "closed") return ArchiveIcon;
  return statusGroupIcon(status.statusGroup);
}

/** Renders a task's actual status glyph, in its status color - the shared
 * shape for "status" (name), "statusGroup" and "statusColor" that map_task()/
 * map_subtask_summary() return, so callers don't repeat the icon lookup. */
export function TaskStatusIcon({
  task,
  className,
}: {
  task: { status: string; statusGroup?: string; statusColor: string };
  className?: string;
}) {
  const Icon = statusIcon({
    name: task.status,
    statusGroup: task.statusGroup ?? "NOT_STARTED",
  });
  return (
    <Icon
      className={className}
      style={{ color: task.statusColor }}
      strokeWidth={2}
      aria-hidden
    />
  );
}
