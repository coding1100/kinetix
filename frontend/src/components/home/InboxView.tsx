"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { SearchIcon } from "lucide-react";
import { mergeInboxItems } from "@/lib/notifications/live-cache";
import { resolveInboxHref } from "@/lib/notifications/inbox-item-utils";
import { subscribeNotificationsRefresh } from "@/lib/notifications/realtime";
import {
  markAllNotificationsReadAndSync,
  markNotificationReadAndSync,
} from "@/lib/notifications/sync";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { HomeDataState } from "@/components/home/HomeDataState";
import { HomePageShell } from "@/components/home/HomePageShell";
import { InboxFeedDateHeader, InboxFeedRow } from "@/components/home/InboxFeedRow";
import { UnderlineTabBar } from "@/components/shared/Tabs";
import { fetchInbox, type InboxItemDto } from "@/lib/api/home";
import { useHomeQuery } from "@/hooks/use-home-query";
import { useWorkspaceApi } from "@/hooks/use-workspace-api";

export type InboxTab = "all" | "replies" | "mentions" | "later";

const INBOX_TABS: { id: InboxTab; label: string }[] = [
  { id: "all", label: "All" },
  { id: "replies", label: "Replies" },
  { id: "mentions", label: "Mentions" },
  { id: "later", label: "Later" },
];

function parseInboxTab(value: string | null): InboxTab {
  if (value === "replies" || value === "mentions" || value === "later") return value;
  return "all";
}

function filterByTab(items: InboxItemDto[], tab: InboxTab) {
  if (tab === "replies") return items.filter((i) => i.type === "reply");
  if (tab === "mentions") return items.filter((i) => i.type === "mention");
  return items;
}

function filterBySearch(items: InboxItemDto[], query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return items;
  return items.filter(
    (item) =>
      item.title.toLowerCase().includes(q) ||
      item.preview.toLowerCase().includes(q) ||
      item.source.toLowerCase().includes(q)
  );
}

export function InboxView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { accessToken, workspaceId, ready } = useWorkspaceApi();
  const [tab, setTab] = useState<InboxTab>(() =>
    parseInboxTab(searchParams.get("tab"))
  );
  const [query, setQuery] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [liveTick, setLiveTick] = useState(0);

  const apiTab = tab === "later" ? "later" : "all";
  const load = useCallback(
    (token: string, ws: string) =>
      fetchInbox(token, ws, apiTab).then((r) => r.data),
    [apiTab]
  );
  const { data: apiItems, loading, error } = useHomeQuery(load, [apiTab], {
    refreshKey,
  });

  useEffect(() => {
    const next = parseInboxTab(searchParams.get("tab"));
    setTab((current) => (current === next ? current : next));
  }, [searchParams]);

  useEffect(
    () =>
      subscribeNotificationsRefresh(() => {
        setLiveTick((t) => t + 1);
        setRefreshKey((k) => k + 1);
      }),
    []
  );

  const items = useMemo(() => {
    const merged = apiItems ? mergeInboxItems(apiItems) : apiItems;
    if (!merged) return merged;
    return filterBySearch(filterByTab(merged, tab), query);
  }, [apiItems, liveTick, tab, query]);

  const today = items?.filter((i) => i.group === "today") ?? [];
  const earlier = items?.filter((i) => i.group === "earlier") ?? [];
  const hasUnread = (items ?? []).some((item) => item.unread);

  const changeTab = (next: InboxTab) => {
    setTab(next);
    const params = new URLSearchParams(searchParams.toString());
    if (next === "all") params.delete("tab");
    else params.set("tab", next);
    const qs = params.toString();
    router.replace(`/home/inbox${qs ? `?${qs}` : ""}`, { scroll: false });
  };

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

  const emptyMessage = (() => {
    if (query.trim()) return "No notifications match your search.";
    if (tab === "later") {
      return "Nothing saved for later. Snooze notifications to review them here.";
    }
    if (tab === "replies") {
      return "No thread replies yet. When someone replies to your messages, they'll show up here.";
    }
    if (tab === "mentions") {
      return "No mentions yet. When someone @mentions you, they'll show up here.";
    }
    return "You're all caught up. New notifications will appear here.";
  })();

  return (
    <HomePageShell
      title="Inbox"
      subtitle="Comments, mentions, assignments, and chat notifications in one place."
      headerRight={
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 text-xs"
          disabled={!hasUnread || !ready}
          onClick={() => void clearAll()}
        >
          Mark all as read
        </Button>
      }
      tabs={
        <UnderlineTabBar
          className="shrink-0 border-b border-border bg-card px-6"
          tabs={INBOX_TABS}
          active={tab}
          onChange={changeTab}
        />
      }
      toolbar={
        <div className="border-b border-border px-6 py-2.5">
          <div className="relative max-w-2xl">
            <SearchIcon className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search notifications"
              className="h-8 pl-9 text-sm focus-visible:ring-[0.5px]"
            />
          </div>
        </div>
      }
    >
      <HomeDataState
        loading={loading}
        error={error}
        empty={!loading && !error && (items?.length ?? 0) === 0}
        emptyMessage={emptyMessage}
      >
        <div className="w-full px-6 py-2">
          <InboxFeedSection label="Today" items={today} onOpen={openItem} onClear={clearItem} />
          <InboxFeedSection
            label="Earlier"
            items={earlier}
            onOpen={openItem}
            onClear={clearItem}
          />
        </div>
      </HomeDataState>
    </HomePageShell>
  );
}

function InboxFeedSection({
  label,
  items,
  onOpen,
  onClear,
}: {
  label: string;
  items: InboxItemDto[];
  onOpen: (item: InboxItemDto) => void;
  onClear: (event: React.MouseEvent, item: InboxItemDto) => void;
}) {
  if (items.length === 0) return null;
  return (
    <section className="mb-1">
      <InboxFeedDateHeader label={label} />
      <ul className="divide-y divide-border/60">
        {items.map((item) => (
          <li key={item.id}>
            <InboxFeedRow item={item} onOpen={onOpen} onClear={onClear} />
          </li>
        ))}
      </ul>
    </section>
  );
}
