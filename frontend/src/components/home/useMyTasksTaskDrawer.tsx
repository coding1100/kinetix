"use client";

import { Suspense, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { TaskDrawer } from "@/components/spaces/TaskDrawer";

export function useMyTasksTaskDrawer(basePath: string) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedTaskId = searchParams.get("task");

  const openTask = useCallback(
    (taskId: string) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("task", taskId);
      router.replace(`${basePath}?${params.toString()}`);
    },
    [basePath, router, searchParams]
  );

  const closeTask = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("task");
    const q = params.toString();
    router.replace(`${basePath}${q ? `?${q}` : ""}`);
  }, [basePath, router, searchParams]);

  return { selectedTaskId, openTask, closeTask };
}

export function MyTasksTaskDrawer({
  basePath,
  onSaved,
  onDeleted,
}: {
  basePath: string;
  onSaved?: () => void;
  onDeleted?: () => void;
}) {
  return (
    <Suspense fallback={null}>
      <MyTasksTaskDrawerInner
        basePath={basePath}
        onSaved={onSaved}
        onDeleted={onDeleted}
      />
    </Suspense>
  );
}

function MyTasksTaskDrawerInner({
  basePath,
  onSaved,
  onDeleted,
}: {
  basePath: string;
  onSaved?: () => void;
  onDeleted?: () => void;
}) {
  const { selectedTaskId, openTask, closeTask } = useMyTasksTaskDrawer(basePath);

  return (
    <TaskDrawer
      taskId={selectedTaskId}
      open={!!selectedTaskId}
      onOpenChange={(open) => {
        if (!open) closeTask();
      }}
      onSaved={() => onSaved?.()}
      onDeleted={() => {
        onDeleted?.();
        closeTask();
      }}
      onTaskNavigate={openTask}
    />
  );
}
