"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { mergeInboxItems } from "@/lib/notifications/live-cache";
import { resolveInboxHref } from "@/lib/notifications/inbox-item-utils";
import { subscribeNotificationsRefresh } from "@/lib/notifications/realtime";
import {
  markAllNotificationsReadAndSync,
  markNotificationReadAndSync,
} from "@/lib/notifications/sync";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { PageTabs } from "@/components/shared/Tabs";
import { HomeDataState } from "@/components/home/HomeDataState";
import { InboxItemCard } from "@/components/home/InboxItemCard";
import { fetchInbox, type InboxItemDto } from "@/lib/api/home";
import { useHomeQuery } from "@/hooks/use-home-query";
import { useWorkspaceApi } from "@/hooks/use-workspace-api";
import { ScrollArea } from "@/components/ui/scroll-area";

export function InboxView() {
  const router = useRouter();
  const { accessToken, workspaceId, ready } = useWorkspaceApi();
  const [tab, setTab] = useState<"all" | "later">("all");
  const [refreshKey, setRefreshKey] = useState(0);
  const [liveTick, setLiveTick] = useState(0);
  const load = useCallback(
    (token: string, ws: string) =>
      fetchInbox(token, ws, tab).then((r) => r.data),
    [tab]
  );
  const { data: apiItems, loading, error } = useHomeQuery(load, [tab], {
    refreshKey,
  });

  useEffect(
    () =>
      subscribeNotificationsRefresh(() => {
        setLiveTick((t) => t + 1);
        setRefreshKey((k) => k + 1);
      }),
    []
  );

  const items = useMemo(
    () => (apiItems ? mergeInboxItems(apiItems) : apiItems),
    [apiItems, liveTick]
  );
  const today = items?.filter((i) => i.group === "today") ?? [];
  const earlier = items?.filter((i) => i.group === "earlier") ?? [];
  const hasUnread = (items ?? []).some((item) => item.unread);

  const clearAll = async () => {
    if (!ready || !hasUnread) return;
    const unreadIds = (items ?? [])
      .filter((item) => item.unread)
      .map((item) => item.id);
    await markAllNotificationsReadAndSync(
      accessToken,
      workspaceId,
      unreadIds
    );
    setRefreshKey((k) => k + 1);
  };

  const clearItem = async (event: React.MouseEvent, item: InboxItemDto) => {
    event.stopPropagation();
    if (!item.unread || !ready) return;
    await markNotificationReadAndSync(accessToken, workspaceId, item.id);
    setRefreshKey((k) => k + 1);
  };

  const openItem = async (item: InboxItemDto) => {
    if (item.unread && ready) {
      await markNotificationReadAndSync(accessToken, workspaceId, item.id);
      setRefreshKey((k) => k + 1);
    }
    router.push(resolveInboxHref(item));
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <PageHeader title="Inbox">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 text-xs font-medium text-muted-foreground"
          disabled={!hasUnread || !ready}
          onClick={() => void clearAll()}
        >
          Mark all as read
        </Button>
      </PageHeader>
      <PageTabs
        className="shrink-0 border-b border-border bg-card"
        tabs={[
          { id: "all" as const, label: "All" },
          { id: "later" as const, label: "Later" },
        ]}
        active={tab}
        onChange={setTab}
      />
      <HomeDataState
        loading={loading}
        error={error}
        empty={!loading && !error && items?.length === 0}
      >
        <ScrollArea className="min-h-0 flex-1">
          <div className="w-full px-4 py-5 pb-8 sm:px-6">
            <InboxSection
              title="Today"
              items={today}
              onOpen={openItem}
              onClear={clearItem}
            />
            <InboxSection
              title="Earlier"
              items={earlier}
              onOpen={openItem}
              onClear={clearItem}
            />
          </div>
        </ScrollArea>
      </HomeDataState>
    </div>
  );
}

function InboxSection({
  title,
  items,
  onOpen,
  onClear,
}: {
  title: string;
  items: InboxItemDto[];
  onOpen: (item: InboxItemDto) => void;
  onClear: (event: React.MouseEvent, item: InboxItemDto) => void;
}) {
  if (items.length === 0) return null;
  return (
    <section className="mb-8 last:mb-0">
      <h2 className="mb-3 px-1 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
        {title}
      </h2>
      <ul className="space-y-2.5">
        {items.map((item) => (
          <li key={item.id}>
            <InboxItemCard item={item} onOpen={onOpen} onClear={onClear} />
          </li>
        ))}
      </ul>
    </section>
  );
}
