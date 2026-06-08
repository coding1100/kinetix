"use client";

import { use } from "react";
import { TaskDetailView } from "@/components/home/TaskDetailView";
import { HomeDataState } from "@/components/home/HomeDataState";
import { fetchTask } from "@/lib/api/home";
import { useHomeQuery } from "@/hooks/use-home-query";

export default function TaskDetailPage({
  params,
}: {
  params: Promise<{ taskId: string }>;
}) {
  const { taskId } = use(params);
  const { data: task, loading, error } = useHomeQuery(
    (token, ws) => fetchTask(token, ws, taskId),
    [taskId]
  );

  return (
    <HomeDataState loading={loading} error={error} empty={!task && !loading}>
      {task ? <TaskDetailView task={task} /> : null}
    </HomeDataState>
  );
}
