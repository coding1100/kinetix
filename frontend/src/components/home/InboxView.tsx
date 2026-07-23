"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCheckIcon, FilterIcon, SettingsIcon } from "lucide-react";
import { mergeInboxItems } from "@/lib/notifications/live-cache";
import { resolveInboxHref } from "@/lib/notifications/inbox-item-utils";
import { subscribeNotificationsRefresh } from "@/lib/notifications/realtime";
import {
  markAllNotificationsReadAndSync,
  markNotificationReadAndSync,
} from "@/lib/notifications/sync";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { HomeDataState } from "@/components/home/HomeDataState";
import { HomePageShell } from "@/components/home/HomePageShell";
import { InboxFeedDateHeader, InboxFeedRow } from "@/components/home/InboxFeedRow";
import { fetchInbox, type InboxItemDto, type InboxItemType } from "@/lib/api/home";
import { useHomeQuery } from "@/hooks/use-home-query";
import { useWorkspaceApi } from "@/hooks/use-workspace-api";

// Inbox only ever shows Primary - items that need direct action from the
// user (mentions, assignments, comments/replies, reminders). There is no
// tab switcher anymore; lower-signal activity is simply not surfaced here.
const PRIMARY_TYPES: InboxItemType[] = [
  "mention",
  "assignment",
  "comment",
  "reply",
  "reminder",
];

const TYPE_FILTER_OPTIONS: { id: InboxItemType; label: string }[] = [
  { id: "mention", label: "Mentions" },
  { id: "assignment", label: "Assignments" },
  { id: "comment", label: "Comments" },
  { id: "reply", label: "Replies" },
  { id: "reminder", label: "Reminders" },
];

function filterToPrimary(items: InboxItemDto[]) {
  return items.filter((i) => PRIMARY_TYPES.includes(i.type));
}

function filterByTypes(items: InboxItemDto[], types: Set<InboxItemType>) {
  if (types.size === 0) return items;
  return items.filter((item) => types.has(item.type));
}

type DateGroup = "Today" | "Yesterday" | "Last 7 days" | "Earlier this month" | "Older";

function dateGroupFor(value: string, now: Date): DateGroup {
  const date = new Date(value);
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const today = startOfDay(now);
  const day = startOfDay(date);
  const diffDays = Math.round((today.getTime() - day.getTime()) / 86400000);

  if (diffDays <= 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays <= 7) return "Last 7 days";
  if (date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth()) {
    return "Earlier this month";
  }
  return "Older";
}

const DATE_GROUP_ORDER: DateGroup[] = [
  "Today",
  "Yesterday",
  "Last 7 days",
  "Earlier this month",
  "Older",
];

export function InboxView() {
  const router = useRouter();
  const { accessToken, workspaceId, ready } = useWorkspaceApi();
  const [typeFilter, setTypeFilter] = useState<Set<InboxItemType>>(new Set());
  const [refreshKey, setRefreshKey] = useState(0);
  const [liveTick, setLiveTick] = useState(0);

  const load = useCallback(
    (token: string, ws: string) => fetchInbox(token, ws, "all").then((r) => r.data),
    []
  );
  const { data: apiItems, loading, error } = useHomeQuery(load, [], {
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

  const items = useMemo(() => {
    const merged = apiItems ? mergeInboxItems(apiItems) : apiItems;
    if (!merged) return merged;
    return filterByTypes(filterToPrimary(merged), typeFilter);
  }, [apiItems, liveTick, typeFilter]);

  const hasUnread = (items ?? []).some((item) => item.unread);

  const toggleTypeFilter = (type: InboxItemType) => {
    setTypeFilter((current) => {
      const next = new Set(current);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
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

  const groupedSections = useMemo(() => {
    if (!items) return [];
    const now = new Date();
    const buckets = new Map<DateGroup, InboxItemDto[]>();
    for (const item of items) {
      const group = dateGroupFor(item.createdAt, now);
      const bucket = buckets.get(group);
      if (bucket) bucket.push(item);
      else buckets.set(group, [item]);
    }
    return DATE_GROUP_ORDER.filter((group) => buckets.has(group)).map((group) => ({
      label: group,
      items: buckets.get(group)!,
    }));
  }, [items]);

  const emptyMessage = "You're all caught up. New notifications will appear here.";

  return (
    <HomePageShell
      title="Inbox"
      toolbar={
        <div className="flex shrink-0 items-center justify-between border-b border-border px-6 py-2">
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1.5 text-xs"
                >
                  <FilterIcon className="size-3.5" />
                  Filter
                  {typeFilter.size > 0 ? ` (${typeFilter.size})` : ""}
                </Button>
              }
            />
            <DropdownMenuContent align="start" className="w-56">
              <DropdownMenuLabel>Notification type</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {TYPE_FILTER_OPTIONS.map((option) => (
                <DropdownMenuCheckboxItem
                  key={option.id}
                  checked={typeFilter.has(option.id)}
                  onCheckedChange={() => toggleTypeFilter(option.id)}
                  onSelect={(e) => e.preventDefault()}
                >
                  {option.label}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Notification settings"
              title="Notification settings"
              onClick={() => router.push("/settings")}
            >
              <SettingsIcon className="size-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 gap-1.5 text-xs text-muted-foreground"
              disabled={!hasUnread || !ready}
              onClick={() => void clearAll()}
            >
              <CheckCheckIcon className="size-3.5" />
              Clear all
            </Button>
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
        <div className="w-full px-4 py-2">
          {groupedSections.map((section) => (
            <InboxFeedSection
              key={section.label}
              label={section.label}
              items={section.items}
              onOpen={openItem}
              onClear={clearItem}
            />
          ))}
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
    <section className="mb-2">
      <InboxFeedDateHeader label={label} />
      <ul className="overflow-hidden rounded-lg border border-border/60 bg-card/40 divide-y divide-border/50">
        {items.map((item) => (
          <li key={item.id}>
            <InboxFeedRow item={item} onOpen={onOpen} onClear={onClear} />
          </li>
        ))}
      </ul>
    </section>
  );
}
