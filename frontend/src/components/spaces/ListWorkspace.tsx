"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { PlusIcon } from "lucide-react";
import type { Task } from "@/lib/types/task";
import { TaskRow } from "@/components/shared/TaskRow";
import { HomeDataState } from "@/components/home/HomeDataState";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { UnderlineTabBar } from "@/components/shared/Tabs";
import type { ListMetaDto } from "@/lib/api/spaces";
import { createListTask } from "@/lib/api/spaces";
import { useWorkspaceApi } from "@/hooks/use-workspace-api";
import { BoardView } from "@/components/spaces/BoardView";
import { CalendarView } from "@/components/spaces/CalendarView";
import { TaskDrawer } from "@/components/spaces/TaskDrawer";
import { toast } from "sonner";

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
  const viewParam = searchParams.get("view");
  const view: ViewMode =
    viewParam === "board" || viewParam === "calendar" ? viewParam : "list";
  const selectedTaskId = searchParams.get("task");

  const { accessToken, workspaceId, ready } = useWorkspaceApi();
  const [newTaskName, setNewTaskName] = useState("");
  const [creating, setCreating] = useState(false);

  const setView = useCallback(
    (mode: ViewMode) => {
      const params = new URLSearchParams(searchParams.toString());
      if (mode === "list") params.delete("view");
      else params.set("view", mode);
      // preserve task param
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

  async function handleAddTask() {
    const name = newTaskName.trim();
    if (!name || !ready || !accessToken || !workspaceId) return;
    setCreating(true);
    try {
      const task = await createListTask(accessToken, workspaceId, meta.id, {
        name,
      });
      setNewTaskName("");
      onTasksChange();
      openTask(task.id);
      toast.success("Task created");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not create task");
    } finally {
      setCreating(false);
    }
  }

  return (
    <>
      <PageHeader title={meta.name}>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span
            className="size-2 rounded-sm"
            style={{ backgroundColor: meta.space.color }}
            aria-hidden
          />
          <Link
            href={`/home/spaces/${meta.space.id}`}
            className="hover:text-foreground"
          >
            {meta.space.name}
          </Link>
        </div>
      </PageHeader>
      <UnderlineTabBar
        className="px-4"
        tabs={[
          { id: "list", label: "List" },
          { id: "board", label: "Board" },
          { id: "calendar", label: "Calendar" },
        ]}
        active={view}
        onChange={setView}
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
        <>
          <HomeDataState
            loading={loading}
            error={error}
            empty={!loading && !error && tasks?.length === 0}
            emptyMessage="No tasks in this list. Add one below."
          >
            <div className="grid grid-cols-[1fr_100px_120px_100px] gap-2 border-b border-border bg-muted px-4 py-2 text-xs font-semibold text-muted-foreground">
              <span>Name</span>
              <span>Status</span>
              <span>Due</span>
              <span>Assignee</span>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-2">
              {tasks?.map((t) => (
                <TaskRow key={t.id} task={t} onSelect={() => openTask(t.id)} />
              ))}
            </div>
          </HomeDataState>
          <div className="flex gap-2 border-t border-border p-3">
            <Input
              value={newTaskName}
              onChange={(e) => setNewTaskName(e.target.value)}
              placeholder="New task name"
              className="h-9"
              onKeyDown={(e) => {
                if (e.key === "Enter") void handleAddTask();
              }}
            />
            <Button
              size="sm"
              disabled={!newTaskName.trim()}
              loading={creating}
              loadingText="Adding…"
              onClick={() => void handleAddTask()}
            >
              <PlusIcon className="size-4" />
              Add
            </Button>
          </div>
        </>
      )}

      <TaskDrawer
        taskId={selectedTaskId}
        open={!!selectedTaskId}
        onOpenChange={(open) => {
          if (!open) closeTask();
        }}
        onSaved={onTasksChange}
        onDeleted={closeTask}
      />
    </>
  );
}

