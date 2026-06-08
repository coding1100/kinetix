"use client";

import { useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import type { Task } from "@/lib/types/task";
import { HomeDataState } from "@/components/home/HomeDataState";
import { cn } from "@/lib/utils";
import { patchTask } from "@/lib/api/spaces";
import { useWorkspaceApi } from "@/hooks/use-workspace-api";
import {
  TASK_STATUS_COLUMNS,
  taskStatusKeyFromLabel,
  type TaskStatusKey,
} from "@/lib/task-status";
import { toast } from "sonner";

type BoardViewProps = {
  tasks: Task[] | undefined;
  loading: boolean;
  error: string | null;
  onTaskSelect: (taskId: string) => void;
  onTasksChange: () => void;
};

function taskColumnKey(task: Task): TaskStatusKey {
  return (task.statusKey as TaskStatusKey) || taskStatusKeyFromLabel(task.status);
}

export function BoardView({
  tasks,
  loading,
  error,
  onTaskSelect,
  onTasksChange,
}: BoardViewProps) {
  const { accessToken, workspaceId, ready } = useWorkspaceApi();
  const [activeId, setActiveId] = useState<string | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  const columns = useMemo(() => {
    const grouped: Record<TaskStatusKey, Task[]> = {
      OPEN: [],
      TODO: [],
      IN_PROGRESS: [],
      DONE: [],
    };
    for (const task of tasks ?? []) {
      grouped[taskColumnKey(task)].push(task);
    }
    return grouped;
  }, [tasks]);

  const activeTask = tasks?.find((t) => t.id === activeId);

  async function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const { active, over } = event;
    if (!over || !ready || !accessToken || !workspaceId) return;
    const taskId = String(active.id);
    const columnKey = String(over.id) as TaskStatusKey;
    if (!TASK_STATUS_COLUMNS.some((c) => c.key === columnKey)) return;
    const task = tasks?.find((t) => t.id === taskId);
    if (!task || taskColumnKey(task) === columnKey) return;
    try {
      await patchTask(accessToken, workspaceId, taskId, { status: columnKey });
      onTasksChange();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not move task");
    }
  }

  return (
    <HomeDataState
      loading={loading}
      error={error}
      empty={!loading && !error && tasks?.length === 0}
      emptyMessage="No tasks on this board. Switch to List to add one."
    >
      <DndContext
        sensors={sensors}
        onDragStart={(e: DragStartEvent) => setActiveId(String(e.active.id))}
        onDragEnd={(e) => void handleDragEnd(e)}
        onDragCancel={() => setActiveId(null)}
      >
        <div className="flex min-h-0 flex-1 gap-3 overflow-x-auto p-4">
          {TASK_STATUS_COLUMNS.map((col) => (
            <BoardColumn
              key={col.key}
              statusKey={col.key}
              label={col.label}
              color={col.color}
              tasks={columns[col.key]}
              onTaskSelect={onTaskSelect}
            />
          ))}
        </div>
        <DragOverlay>
          {activeTask ? (
            <BoardCard task={activeTask} isDragging onOpen={() => {}} />
          ) : null}
        </DragOverlay>
      </DndContext>
    </HomeDataState>
  );
}

function BoardColumn({
  statusKey,
  label,
  color,
  tasks,
  onTaskSelect,
}: {
  statusKey: TaskStatusKey;
  label: string;
  color: string;
  tasks: Task[];
  onTaskSelect: (id: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: statusKey });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex w-[240px] shrink-0 flex-col rounded-xl border border-border bg-muted/30",
        isOver && "ring-2 ring-primary/40"
      )}
    >
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <span
          className="size-2 rounded-full"
          style={{ backgroundColor: color }}
          aria-hidden
        />
        <span className="text-xs font-semibold uppercase tracking-wide">
          {label}
        </span>
        <span className="ml-auto text-xs text-muted-foreground">
          {tasks.length}
        </span>
      </div>
      <ul className="flex min-h-[120px] flex-col gap-2 p-2">
        {tasks.map((task) => (
          <BoardCardDraggable
            key={task.id}
            task={task}
            onOpen={() => onTaskSelect(task.id)}
          />
        ))}
      </ul>
    </div>
  );
}

function BoardCardDraggable({
  task,
  onOpen,
}: {
  task: Task;
  onOpen: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id: task.id });

  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;

  if (isDragging) {
    return (
      <li ref={setNodeRef} className="opacity-40">
        <BoardCard task={task} onOpen={onOpen} />
      </li>
    );
  }

  return (
    <li ref={setNodeRef} style={style} {...listeners} {...attributes}>
      <BoardCard task={task} onOpen={onOpen} />
    </li>
  );
}

function BoardCard({
  task,
  onOpen,
  isDragging,
}: {
  task: Task;
  onOpen: () => void;
  isDragging?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        "w-full rounded-lg border border-border bg-card px-3 py-2.5 text-left shadow-sm transition-shadow hover:shadow-md",
        isDragging && "shadow-md ring-2 ring-primary/30"
      )}
    >
      <p className="text-sm font-medium leading-snug">{task.name}</p>
      {task.assignees.length > 0 ? (
        <p className="mt-1 truncate text-xs text-muted-foreground">
          {task.assignees.join(", ")}
        </p>
      ) : null}
      {task.dueDate ? (
        <p
          className={cn(
            "mt-1 text-xs",
            task.overdue ? "text-destructive" : "text-muted-foreground"
          )}
        >
          {task.dueDate}
        </p>
      ) : null}
    </button>
  );
}
