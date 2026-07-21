"use client";

import { useMemo, useState } from "react";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVerticalIcon, XIcon } from "lucide-react";
import { Suspense } from "react";
import { HomeDataState } from "@/components/home/HomeDataState";
import { MyTasksColumnHeader, MyTasksTaskRow } from "@/components/home/MyTasksTaskRow";
import { MyTasksPageShell } from "@/components/home/MyTasksPageShell";
import { useMyTasksTaskDrawer } from "@/components/home/useMyTasksTaskDrawer";
import { fetchLineup, reorderLineup, removeFromLineup } from "@/lib/api/home";
import { useHomeQuery } from "@/hooks/use-home-query";
import { useWorkspaceApi } from "@/hooks/use-workspace-api";
import type { Task } from "@/lib/types/task";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const BASE_PATH = "/home/my-tasks/lineup";

function SortableLineupRow({
  task,
  onSelect,
  onRemove,
}: {
  task: Task;
  onSelect: () => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: task.id });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.6 : 1,
      }}
      className="flex items-stretch border-b border-border/60 last:border-b-0"
    >
      <button
        type="button"
        className="flex w-9 shrink-0 cursor-grab items-center justify-center text-muted-foreground hover:bg-muted/40 active:cursor-grabbing"
        aria-label="Drag to reorder"
        {...attributes}
        {...listeners}
      >
        <GripVerticalIcon className="size-4" />
      </button>
      <div className="min-w-0 flex-1">
        <MyTasksTaskRow task={task} onSelect={onSelect} />
      </div>
      <div className="flex shrink-0 items-center pr-2">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Remove from LineUp"
          onClick={onRemove}
        >
          <XIcon className="size-4" />
        </Button>
      </div>
    </div>
  );
}

function LineupContent() {
  const { accessToken, workspaceId, ready } = useWorkspaceApi();
  const { openTask } = useMyTasksTaskDrawer(BASE_PATH);
  const [refreshKey, setRefreshKey] = useState(0);
  const { data: tasks, loading, error } = useHomeQuery(
    (token, ws) => fetchLineup(token, ws).then((r) => r.data),
    [refreshKey]
  );
  const [items, setItems] = useState<Task[] | null>(null);
  const [saving, setSaving] = useState(false);

  const displayTasks = items ?? tasks ?? [];
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );
  const taskIds = useMemo(() => displayTasks.map((t) => t.id), [displayTasks]);

  async function persistOrder(next: Task[]) {
    if (!ready || !accessToken || !workspaceId) return;
    setSaving(true);
    try {
      await reorderLineup(
        accessToken,
        workspaceId,
        next.map((t) => t.id)
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not reorder");
      setItems(tasks ?? []);
    } finally {
      setSaving(false);
    }
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = displayTasks.findIndex((t) => t.id === active.id);
    const newIndex = displayTasks.findIndex((t) => t.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const next = arrayMove(displayTasks, oldIndex, newIndex);
    setItems(next);
    await persistOrder(next);
  }

  async function handleRemove(taskId: string) {
    if (!ready || !accessToken || !workspaceId) return;
    try {
      await removeFromLineup(accessToken, workspaceId, taskId);
      setItems((prev) => (prev ?? displayTasks).filter((t) => t.id !== taskId));
      setRefreshKey((k) => k + 1);
      toast.success("Removed from LineUp");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not remove");
    }
  }

  return (
    <MyTasksPageShell
      title="LineUp"
      subtitle="Your priority queue — drag to reorder what to tackle next."
      basePath={BASE_PATH}
      showToolbar={false}
      headerRight={
        saving ? (
          <span className="text-xs text-muted-foreground">Saving order…</span>
        ) : null
      }
      onTasksRefresh={() => setRefreshKey((k) => k + 1)}
    >
      <HomeDataState
        loading={loading}
        error={error}
        empty={!loading && !error && displayTasks.length === 0}
        emptyMessage="No tasks in LineUp. Open a task and choose Add to LineUp."
      >
        <section className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          <div className="flex items-center gap-2 px-4 py-2.5">
            <span className="inline-flex items-center rounded-md bg-violet-600 px-2.5 py-0.5 text-[11px] font-bold tracking-wide text-white uppercase">
              LineUp
            </span>
            <span className="text-xs text-muted-foreground tabular-nums">
              {displayTasks.length}
            </span>
          </div>
          <MyTasksColumnHeader />
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={(e) => void handleDragEnd(e)}
          >
            <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
              {displayTasks.map((task) => (
                <SortableLineupRow
                  key={task.id}
                  task={task}
                  onSelect={() => openTask(task.id)}
                  onRemove={() => void handleRemove(task.id)}
                />
              ))}
            </SortableContext>
          </DndContext>
        </section>
      </HomeDataState>
    </MyTasksPageShell>
  );
}

export default function LineupPage() {
  return (
    <Suspense fallback={null}>
      <LineupContent />
    </Suspense>
  );
}
