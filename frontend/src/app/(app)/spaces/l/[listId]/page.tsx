"use client";

import { use, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ListWorkspace } from "@/components/spaces/ListWorkspace";
import { Suspense } from "react";
import { PageLoader } from "@/components/ui/page-loader";
import { fetchListMeta, fetchListTasks } from "@/lib/api/spaces";
import { useHomeQuery } from "@/hooks/use-home-query";
import { subscribeTaskEvents } from "@/lib/tasks/realtime";
import { useWorkspaceApi } from "@/hooks/use-workspace-api";

export default function ListPage({
  params,
}: {
  params: Promise<{ listId: string }>;
}) {
  const router = useRouter();
  const { listId } = use(params);
  const { workspaceId } = useWorkspaceApi();
  const [refreshKey, setRefreshKey] = useState(0);

  const metaQuery = useHomeQuery(
    (token, ws) => fetchListMeta(token, ws, listId),
    [listId, refreshKey]
  );

  const tasksQuery = useHomeQuery(
    (token, ws) => fetchListTasks(token, ws, listId).then((r) => r.data),
    [listId, refreshKey]
  );

  const onTasksChange = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  useEffect(() => {
    return subscribeTaskEvents((event) => {
      if (event.workspaceId && workspaceId && event.workspaceId !== workspaceId) {
        return;
      }
      if (event.listId && event.listId !== listId) return;
      onTasksChange();
    });
  }, [listId, onTasksChange, workspaceId]);

  useEffect(() => {
    if (!metaQuery.loading && (!metaQuery.data || metaQuery.error)) {
      const timer = setTimeout(() => {
        router.push("/spaces");
      }, 1200);
      return () => clearTimeout(timer);
    }
  }, [metaQuery.loading, metaQuery.data, metaQuery.error, router]);

  if (!metaQuery.data && !metaQuery.loading) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center p-6 text-center animate-in fade-in-50 duration-200">
        <p className="text-base font-semibold">List not found or deleted</p>
        <p className="mt-1 text-sm text-muted-foreground">
          This list may have been deleted. Redirecting to spaces…
        </p>
      </div>
    );
  }

  return metaQuery.data ? (
    <Suspense fallback={<PageLoader label="Loading list…" />}>
      <ListWorkspace
        listId={listId}
        meta={metaQuery.data}
        tasks={tasksQuery.data ?? undefined}
        loading={tasksQuery.loading}
        error={tasksQuery.error}
        onTasksChange={onTasksChange}
      />
    </Suspense>
  ) : null;
}
