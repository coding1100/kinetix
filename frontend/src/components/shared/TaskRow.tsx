import Link from "next/link";
import type { Task } from "@/lib/types/task";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const rowClassName =
  "group flex w-full cursor-pointer items-center gap-3 rounded-lg border border-transparent px-3 py-2.5 text-left transition-colors hover:border-border hover:bg-muted/60";

export function TaskRow({
  task,
  onSelect,
}: {
  task: Task;
  onSelect?: () => void;
}) {
  const content = (
    <>
      <Badge
        className="shrink-0 border-0 text-white"
        style={{ backgroundColor: task.statusColor }}
      >
        {task.status}
      </Badge>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{task.name}</p>
        <p className="truncate text-xs text-muted-foreground">
          {task.space} · {task.list}
        </p>
      </div>
      {task.dueDate && (
        <span
          className={cn(
            "shrink-0 text-xs",
            task.overdue ? "font-medium text-destructive" : "text-muted-foreground"
          )}
        >
          {task.dueDate}
        </span>
      )}
    </>
  );

  if (onSelect) {
    return (
      <button type="button" onClick={onSelect} className={rowClassName}>
        {content}
      </button>
    );
  }

  return (
    <Link href={`/home/tasks/${task.id}`} className={rowClassName}>
      {content}
    </Link>
  );
}
