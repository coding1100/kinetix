"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BellIcon } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { InboxItemCard } from "@/components/home/InboxItemCard";
import { type InboxItemDto, type NotificationDto } from "@/lib/api/home";
import { useWorkspaceApi } from "@/hooks/use-workspace-api";
import { useNotificationsUnread } from "@/hooks/use-notifications-unread";
import { resolveInboxHref } from "@/lib/notifications/inbox-item-utils";
import {
  markAllNotificationsReadAndSync,
  markNotificationReadAndSync,
} from "@/lib/notifications/sync";

function toInboxItem(item: NotificationDto): InboxItemDto {
  return {
    id: item.id,
    type: item.type,
    title: item.title,
    preview: item.preview,
    source: item.source,
    createdAt: item.createdAt,
    unread: item.unread,
    group: item.group ?? "today",
    href: item.href,
  };
}

export function NotificationsMenu() {
  const router = useRouter();
  const { accessToken, workspaceId, ready } = useWorkspaceApi();
  const { unreadCount, items, reload } = useNotificationsUnread();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      await reload();
    } finally {
      setLoading(false);
    }
  }, [reload]);

  useEffect(() => {
    if (ready) void load();
  }, [ready, load]);

  useEffect(() => {
    if (open && ready) void load();
  }, [open, ready, load]);

  const handleOpen = (next: boolean) => {
    setOpen(next);
    if (next && ready) void load();
  };

  const hasUnread = items.some((item) => item.unread);

  const clearAll = async () => {
    if (!ready || !hasUnread || !accessToken || !workspaceId) return;
    const unreadIds = items
      .filter((item) => item.unread)
      .map((item) => item.id);
    await markAllNotificationsReadAndSync(
      accessToken,
      workspaceId,
      unreadIds
    );
    await load();
  };

  const clearItem = async (
    event: React.MouseEvent,
    item: InboxItemDto
  ) => {
    event.stopPropagation();
    if (!item.unread || !accessToken || !workspaceId) return;
    await markNotificationReadAndSync(accessToken, workspaceId, item.id);
  };

  const openItem = async (item: InboxItemDto) => {
    if (item.unread && accessToken && workspaceId) {
      await markNotificationReadAndSync(accessToken, workspaceId, item.id);
    }
    setOpen(false);
    router.push(resolveInboxHref(item));
  };

  return (
    <DropdownMenu open={open} onOpenChange={handleOpen}>
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" size="icon-sm" aria-label="Notifications">
            <span className="relative">
              <BellIcon className="size-4" />
              {unreadCount > 0 ? (
                <Badge className="absolute -top-[8px] -right-[8px] size-4 min-w-4 justify-center rounded-full p-0 text-[9px]">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </Badge>
              ) : null}
            </span>
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="w-[min(100vw-2rem,28rem)] p-0">
        <div className="flex items-center justify-between border-b border-border px-3 py-2">
          <span className="text-sm font-semibold">Notifications</span>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs text-muted-foreground"
              disabled={!hasUnread || !ready}
              onClick={() => void clearAll()}
            >
              Mark all as read
            </Button>
            <Button
              variant="link"
              size="sm"
              className="h-auto px-0 text-xs"
              nativeButton={false}
              render={
                <Link href="/home/inbox" onClick={() => setOpen(false)} />
              }
            >
              View inbox
            </Button>
          </div>
        </div>
        {loading ? (
          <p className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
            <Spinner size="sm" label="Loading notifications" />
            Loading…
          </p>
        ) : items.length === 0 ? (
          <p className="px-3 py-8 text-center text-sm text-muted-foreground">
            No notifications yet.
          </p>
        ) : (
          <ScrollArea className="max-h-[min(420px,60vh)]">
            <ul className="space-y-2 p-2">
              {items.map((item) => {
                const row = toInboxItem(item);
                return (
                  <li key={item.id}>
                    <InboxItemCard
                      compact
                      item={row}
                      onOpen={openItem}
                      onClear={clearItem}
                    />
                  </li>
                );
              })}
            </ul>
          </ScrollArea>
        )}
        <DropdownMenuSeparator className="m-0" />
        <DropdownMenuItem
          className="justify-center text-xs text-muted-foreground"
          onClick={() => {
            setOpen(false);
            router.push("/home/inbox");
          }}
        >
          See all in Inbox
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
