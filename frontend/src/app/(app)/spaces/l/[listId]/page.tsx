"use client";

import { use, useCallback, useEffect, useState } from "react";
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

  if (!metaQuery.data && !metaQuery.loading) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
        List not found
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
