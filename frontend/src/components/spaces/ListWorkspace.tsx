"use client";

import { useCallback, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { Task } from "@/lib/types/task";
import type { ListMetaDto } from "@/lib/api/spaces";
import { useUiStore } from "@/stores/ui-store";
import { BoardView } from "@/components/spaces/BoardView";
import { CalendarView } from "@/components/spaces/CalendarView";
import { ListViewGrouped } from "@/components/spaces/ListViewGrouped";
import { SpacesListToolbar } from "@/components/spaces/SpacesListToolbar";
import { TaskDrawer } from "@/components/spaces/TaskDrawer";

type ViewMode = "list" | "board" | "calendar";

type ListWorkspaceProps = {
  listId: string;
  meta: ListMetaDto;
  tasks: Task[] | undefined;
  loading: boolean;
  error: string | null;
  onTasksChange: () => void;
};

export function ListWorkspace({
  listId,
  meta,
  tasks,
  loading,
  error,
  onTasksChange,
}: ListWorkspaceProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const openModal = useUiStore((s) => s.openModal);
  const [statusFilter, setStatusFilter] = useState("all");
  const viewParam = searchParams.get("view");
  const view: ViewMode =
    viewParam === "board" || viewParam === "calendar" ? viewParam : "list";
  const selectedTaskId = searchParams.get("task");

  const setView = useCallback(
    (mode: ViewMode) => {
      const params = new URLSearchParams(searchParams.toString());
      if (mode === "list") params.delete("view");
      else params.set("view", mode);
      const q = params.toString();
      router.replace(`/spaces/l/${listId}${q ? `?${q}` : ""}`);
    },
    [router, listId, searchParams]
  );

  const openTask = useCallback(
    (taskId: string) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("task", taskId);
      router.replace(`/spaces/l/${listId}?${params.toString()}`);
    },
    [router, listId, searchParams]
  );

  const closeTask = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("task");
    const q = params.toString();
    router.replace(`/spaces/l/${listId}${q ? `?${q}` : ""}`);
  }, [router, listId, searchParams]);

  const openCreateTask = useCallback(() => {
    openModal("create-task");
  }, [openModal]);

  return (
    <>
      <SpacesListToolbar
        listName={meta.name}
        spaceName={meta.space.name}
        spaceColor={meta.space.color}
        spaceId={meta.space.id}
        view={view}
        onViewChange={setView}
        statuses={meta.statuses}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        onCreateTask={openCreateTask}
      />

      {view === "calendar" ? (
        <CalendarView
          tasks={tasks}
          loading={loading}
          error={error}
          onTaskSelect={openTask}
        />
      ) : view === "board" ? (
        <BoardView
          tasks={tasks}
          statuses={meta.statuses}
          loading={loading}
          error={error}
          onTaskSelect={openTask}
          onTasksChange={onTasksChange}
        />
      ) : (
        <ListViewGrouped
          tasks={tasks}
          statuses={meta.statuses}
          loading={loading}
          error={error}
          statusFilter={statusFilter}
          onTaskSelect={openTask}
          onAddTask={openCreateTask}
        />
      )}

      <TaskDrawer
        taskId={selectedTaskId}
        open={!!selectedTaskId}
        onOpenChange={(open) => {
          if (!open) closeTask();
        }}
        onSaved={onTasksChange}
        onDeleted={closeTask}
        onTaskNavigate={openTask}
      />
    </>
  );
}
