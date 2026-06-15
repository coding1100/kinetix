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
import { PageHeader } from "@/components/shared/PageHeader";
import { TaskRow } from "@/components/shared/TaskRow";
import { HomeDataState } from "@/components/home/HomeDataState";
import { fetchLineup, reorderLineup, removeFromLineup } from "@/lib/api/home";
import { useHomeQuery } from "@/hooks/use-home-query";
import { useWorkspaceApi } from "@/hooks/use-workspace-api";
import type { Task } from "@/lib/types/task";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

function SortableLineupRow({
  task,
  onRemove,
}: {
  task: Task;
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
        opacity: isDragging ? 0.5 : 1,
      }}
      className="flex items-center gap-1"
    >
      <button
        type="button"
        className="flex size-8 shrink-0 cursor-grab items-center justify-center rounded-md text-muted-foreground hover:bg-muted active:cursor-grabbing"
        aria-label="Drag to reorder"
        {...attributes}
        {...listeners}
      >
        <GripVerticalIcon className="size-4" />
      </button>
      <div className="min-w-0 flex-1">
        <TaskRow task={task} />
      </div>
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
  );
}

export default function LineupPage() {
  const { accessToken, workspaceId, ready } = useWorkspaceApi();
  const { data: tasks, loading, error } = useHomeQuery((token, ws) =>
    fetchLineup(token, ws).then((r) => r.data)
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
      toast.success("Removed from LineUp");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not remove");
    }
  }

  return (
    <>
      <PageHeader title="LineUp">
        {saving ? (
          <span className="text-xs text-muted-foreground">Saving order…</span>
        ) : null}
      </PageHeader>
      <HomeDataState
        loading={loading}
        error={error}
        empty={!loading && !error && displayTasks.length === 0}
        emptyMessage="No tasks in LineUp. Open a task and choose Add to LineUp."
      >
        <div className="flex-1 overflow-y-auto p-4">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={(e) => void handleDragEnd(e)}
          >
            <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
              <div className="space-y-1">
                {displayTasks.map((t) => (
                  <SortableLineupRow
                    key={t.id}
                    task={t}
                    onRemove={() => void handleRemove(t.id)}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </div>
      </HomeDataState>
    </>
  );
}
