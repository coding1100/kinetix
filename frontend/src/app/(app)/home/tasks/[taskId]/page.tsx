"use client";

import { use, useEffect } from "react";
import { useRouter } from "next/navigation";
import { HomeDataState } from "@/components/home/HomeDataState";
import { TaskDrawer } from "@/components/spaces/TaskDrawer";
import { fetchTask, recordTaskRecent } from "@/lib/api/home";
import { useHomeQuery } from "@/hooks/use-home-query";
import { useWorkspaceApi } from "@/hooks/use-workspace-api";

export default function TaskDetailPage({
  params,
}: {
  params: Promise<{ taskId: string }>;
}) {
  const { taskId } = use(params);
  const router = useRouter();
  const { accessToken, workspaceId, ready } = useWorkspaceApi();
  const { data: task, loading, error } = useHomeQuery(
    (token, ws) => fetchTask(token, ws, taskId),
    [taskId]
  );

  useEffect(() => {
    if (!task?.listId) return;
    router.replace(`/spaces/l/${task.listId}?task=${taskId}`);
  }, [task?.listId, taskId, router]);

  useEffect(() => {
    if (!task || !ready || !accessToken || !workspaceId) return;
    void recordTaskRecent(accessToken, workspaceId, task).catch(() => {});
  }, [task, ready, accessToken, workspaceId]);

  if (task?.listId) {
    return (
      <HomeDataState loading={loading} error={error}>
        <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
          Opening task…
        </div>
      </HomeDataState>
    );
  }

  return (
    <HomeDataState loading={loading} error={error} empty={!task && !loading}>
      {task ? (
        <TaskDrawer
          taskId={taskId}
          open
          onOpenChange={(open) => {
            if (!open) router.push("/home/all-tasks");
          }}
          onSaved={() => router.refresh()}
          onDeleted={() => router.push("/home/all-tasks")}
          onTaskNavigate={(id) => router.replace(`/home/tasks/${id}`)}
        />
      ) : null}
    </HomeDataState>
  );
}
