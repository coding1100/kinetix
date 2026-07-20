"use client";

import { use, useCallback, useState } from "react";
import { Suspense } from "react";
import { ConversationView } from "@/components/chat/ConversationView";
import { ListWorkspace } from "@/components/spaces/ListWorkspace";
import { PageLoader } from "@/components/ui/page-loader";
import { fetchChannel } from "@/lib/api/chat";
import { fetchListMeta, fetchListTasks } from "@/lib/api/spaces";
import { useHomeQuery } from "@/hooks/use-home-query";

export default function ChannelPage({
  params,
}: {
  params: Promise<{ channelId: string }>;
}) {
  const { channelId } = use(params);
  const [refreshKey, setRefreshKey] = useState(0);

  const channelQuery = useHomeQuery(
    (token, ws) => fetchChannel(token, ws, channelId),
    [channelId]
  );

  const listId = channelQuery.data?.isListPrimary
    ? channelQuery.data.listId
    : null;

  const metaQuery = useHomeQuery(
    (token, ws) => (listId ? fetchListMeta(token, ws, listId) : Promise.resolve(null)),
    [listId, refreshKey]
  );

  const tasksQuery = useHomeQuery(
    (token, ws) =>
      listId
        ? fetchListTasks(token, ws, listId).then((r) => r.data)
        : Promise.resolve(undefined),
    [listId, refreshKey]
  );

  const onTasksChange = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  if (channelQuery.loading) {
    return <PageLoader label="Loading..." />;
  }

  if (listId) {
    if (!metaQuery.data) {
      return <PageLoader label="Loading..." />;
    }
    return (
      <Suspense fallback={<PageLoader label="Loading..." />}>
        <ListWorkspace
          listId={listId}
          meta={metaQuery.data}
          tasks={tasksQuery.data ?? undefined}
          loading={tasksQuery.loading}
          error={tasksQuery.error}
          onTasksChange={onTasksChange}
          basePath={`/chat/c/${channelId}`}
          defaultView="channel"
        />
      </Suspense>
    );
  }

  return (
    <Suspense fallback={<div className="flex flex-1 items-center justify-center">Loading...</div>}>
      <ConversationView type="channel" id={channelId} />
    </Suspense>
  );
}
