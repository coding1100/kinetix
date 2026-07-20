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
import { ConversationView } from "@/components/chat/ConversationView";

type ViewMode = "channel" | "list" | "board" | "calendar";

type ListWorkspaceProps = {
  listId: string;
  meta: ListMetaDto;
  tasks: Task[] | undefined;
  loading: boolean;
  error: string | null;
  onTasksChange: () => void;
  /** URL this workspace's tabs/task-drawer navigate within - defaults to the
   * Spaces list URL, but the same tabbed layout is also used from the Chat
   * route for a list's primary channel (see /chat/c/[channelId]/page.tsx),
   * where it must stay on that URL instead of jumping to /spaces/l/. */
  basePath?: string;
  /** Tab shown when the URL has no `?view=` param - "list" from a Spaces/
   * list URL, "channel" when opened via a channel link (the channel's
   * conversation should be what a channel click lands on, not its board). */
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
  const viewParam = searchParams.get("view");
  const view: ViewMode =
    viewParam === "board" ||
    viewParam === "calendar" ||
    viewParam === "channel" ||
    viewParam === "list"
      ? viewParam
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

      {view === "channel" ? (
        meta.channelId ? (
          <ConversationView type="channel" id={meta.channelId} hideHeaderTitle />
        ) : (
          <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
            No channel linked to this list yet.
          </div>
        )
      ) : view === "calendar" ? (
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
