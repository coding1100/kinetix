"use client";

import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ActivityIcon,
  CheckCheckIcon,
  ClockIcon,
  FilterIcon,
  InboxIcon,
  SettingsIcon,
} from "lucide-react";
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
import { UnderlineTabBar } from "@/components/shared/Tabs";
import { fetchInbox, type InboxItemDto, type InboxItemType } from "@/lib/api/home";
import { useHomeQuery } from "@/hooks/use-home-query";
import { useWorkspaceApi } from "@/hooks/use-workspace-api";

export type InboxTab = "primary" | "other" | "later" | "cleared";

const INBOX_TABS: { id: InboxTab; label: string; icon: ReactNode }[] = [
  { id: "primary", label: "Primary", icon: <InboxIcon className="size-4" /> },
  { id: "other", label: "Other", icon: <ActivityIcon className="size-4" /> },
  { id: "later", label: "Later", icon: <ClockIcon className="size-4" /> },
  { id: "cleared", label: "Cleared", icon: <CheckCheckIcon className="size-4" /> },
];

// Items that need direct action from the user surface in Primary; lower-signal
// activity (channel chatter, reactions, your own sent/scheduled/drafts) goes to Other.
const PRIMARY_TYPES: InboxItemType[] = [
  "mention",
  "assignment",
  "comment",
  "reply",
  "reminder",
];
const OTHER_TYPES: InboxItemType[] = ["chat", "reaction", "sent", "draft", "scheduled"];

const TYPE_FILTER_OPTIONS: { id: InboxItemType; label: string }[] = [
  { id: "mention", label: "Mentions" },
  { id: "assignment", label: "Assignments" },
  { id: "comment", label: "Comments" },
  { id: "reply", label: "Replies" },
  { id: "reminder", label: "Reminders" },
  { id: "chat", label: "Chat" },
  { id: "reaction", label: "Reactions" },
  { id: "sent", label: "Sent" },
  { id: "draft", label: "Drafts" },
  { id: "scheduled", label: "Scheduled" },
];

function parseInboxTab(value: string | null): InboxTab {
  if (value === "other" || value === "later" || value === "cleared") return value;
  return "primary";
}

function filterByTab(items: InboxItemDto[], tab: InboxTab) {
  if (tab === "other") return items.filter((i) => OTHER_TYPES.includes(i.type));
  if (tab === "cleared") return items.filter((i) => !i.unread);
  if (tab === "later") return items;
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
  const searchParams = useSearchParams();
  const { accessToken, workspaceId, ready } = useWorkspaceApi();
  const [tab, setTab] = useState<InboxTab>(() =>
    parseInboxTab(searchParams.get("tab"))
  );
  const [typeFilter, setTypeFilter] = useState<Set<InboxItemType>>(new Set());
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
    return filterByTypes(filterByTab(merged, tab), typeFilter);
  }, [apiItems, liveTick, tab, typeFilter]);

  const hasUnread = (items ?? []).some((item) => item.unread);

  const changeTab = (next: InboxTab) => {
    setTab(next);
    const params = new URLSearchParams(searchParams.toString());
    if (next === "primary") params.delete("tab");
    else params.set("tab", next);
    const qs = params.toString();
    router.replace(`/home/inbox${qs ? `?${qs}` : ""}`, { scroll: false });
  };

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

  const emptyMessage = (() => {
    if (tab === "later") {
      return "Nothing saved for later. Snooze notifications to review them here.";
    }
    if (tab === "cleared") {
      return "Nothing cleared yet. Items you clear will show up here.";
    }
    if (tab === "other") {
      return "No lower-priority activity right now.";
    }
    return "You're all caught up. New notifications will appear here.";
  })();

  return (
    <HomePageShell
      title="Inbox"
      tabs={
        <UnderlineTabBar
          className="shrink-0 border-b border-border bg-card px-6"
          tabs={INBOX_TABS}
          active={tab}
          onChange={changeTab}
        />
      }
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
