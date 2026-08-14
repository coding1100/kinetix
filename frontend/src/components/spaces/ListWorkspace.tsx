"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { Task } from "@/lib/types/task";
import type { ListMetaDto } from "@/lib/api/spaces";
import { useUiStore } from "@/stores/ui-store";
import { ListViewGrouped } from "@/components/spaces/ListViewGrouped";
import { BoardView } from "@/components/spaces/BoardView";
import { CalendarView } from "@/components/spaces/CalendarView";
import { SpacesListToolbar, type ViewMode } from "@/components/spaces/SpacesListToolbar";
import { TaskDrawer } from "@/components/spaces/TaskDrawer";
import { ConversationView } from "@/components/chat/ConversationView";

type ListWorkspaceProps = {
  listId: string;
  meta: ListMetaDto;
  tasks: Task[] | undefined;
  loading: boolean;
  error: string | null;
  onTasksChange: () => void;
  basePath?: string;
  defaultView?: ViewMode;
};

export function ListWorkspace({
  listId,
  meta,
  tasks,
  loading,
  error,
  onTasksChange,
  basePath,
  defaultView = "list",
}: ListWorkspaceProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const openModal = useUiStore((s) => s.openModal);

  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  const viewParam = searchParams.get("view");
  const view: ViewMode =
    viewParam === "channel" ||
    viewParam === "list" ||
    viewParam === "board" ||
    viewParam === "calendar"
      ? (viewParam as ViewMode)
      : defaultView;

  const selectedTaskId = searchParams.get("task");
  const path = basePath ?? `/spaces/l/${listId}`;

  const setView = useCallback(
    (mode: ViewMode) => {
      const params = new URLSearchParams(searchParams.toString());
      if (mode === defaultView) params.delete("view");
      else params.set("view", mode);
      const q = params.toString();
      router.replace(`${path}${q ? `?${q}` : ""}`);
    },
    [router, path, searchParams, defaultView]
  );

  const openTask = useCallback(
    (taskId: string) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("task", taskId);
      router.replace(`${path}?${params.toString()}`);
    },
    [router, path, searchParams]
  );

  const closeTask = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("task");
    const q = params.toString();
    router.replace(`${path}${q ? `?${q}` : ""}`);
  }, [router, path, searchParams]);

  const openCreateTask = useCallback(
    (statusId?: string) => {
      openModal("create-task", undefined, listId, statusId);
    },
    [openModal, listId]
  );

  // Apply Search, Status, and Priority filters to tasks
  const filteredTasks = useMemo(() => {
    if (!tasks) return undefined;
    return tasks.filter((t) => {
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchName = t.name.toLowerCase().includes(query);
        const matchDesc = t.description?.toLowerCase().includes(query) ?? false;
        if (!matchName && !matchDesc) return false;
      }
      if (priorityFilter !== "all") {
        if (t.priority?.toLowerCase() !== priorityFilter.toLowerCase()) return false;
      }
      return true;
    });
  }, [tasks, searchQuery, priorityFilter]);

  return (
    <>
      <SpacesListToolbar
        listId={listId}
        listName={meta.name}
        spaceName={meta.space.name}
        spaceColor={meta.space.color}
        spaceId={meta.space.id}
        spaceAccessible={meta.space.accessible !== false}
        view={view}
        onViewChange={setView}
        statuses={meta.statuses}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        priorityFilter={priorityFilter}
        onPriorityFilterChange={setPriorityFilter}
        searchQuery={searchQuery}
        onSearchQueryChange={setSearchQuery}
        onCreateTask={openCreateTask}
        canShare={meta.canShare}
      />

      {view === "channel" ? (
        meta.channelId ? (
          <ConversationView type="channel" id={meta.channelId} hideHeaderTitle />
        ) : (
          <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
            No channel linked to this list yet.
          </div>
        )
      ) : view === "board" ? (
        <BoardView
          tasks={filteredTasks}
          statuses={meta.statuses}
          loading={loading}
          error={error}
          onTaskSelect={openTask}
          onTasksChange={onTasksChange}
        />
      ) : view === "calendar" ? (
        <CalendarView
          tasks={filteredTasks}
          loading={loading}
          error={error}
          onTaskSelect={openTask}
        />
      ) : (
        <ListViewGrouped
          tasks={filteredTasks}
          statuses={meta.statuses}
          loading={loading}
          error={error}
          statusFilter={statusFilter}
          onTaskSelect={openTask}
          onAddTask={openCreateTask}
          onTaskDeleted={onTasksChange}
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
