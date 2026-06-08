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
import {
  fetchNotifications,
  markNotificationRead,
  type NotificationDto,
} from "@/lib/api/home";
import { useWorkspaceApi } from "@/hooks/use-workspace-api";
import { formatRelativeTime } from "@/lib/utils";
import { cn } from "@/lib/utils";

function notificationIcon(type: NotificationDto["type"]) {
  switch (type) {
    case "mention":
      return "@";
    case "assignment":
      return "✓";
    case "chat":
      return "💬";
    case "comment":
      return "¶";
    case "reminder":
      return "⏰";
    default:
      return "•";
  }
}

export function NotificationsMenu() {
  const router = useRouter();
  const { accessToken, workspaceId, ready } = useWorkspaceApi();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<NotificationDto[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const load = useCallback(async () => {
    if (!accessToken || !workspaceId) return;
    setLoading(true);
    try {
      const res = await fetchNotifications(accessToken, workspaceId);
      setItems(res.data);
      setUnreadCount(res.unreadCount);
    } catch {
      setItems([]);
      setUnreadCount(0);
    } finally {
      setLoading(false);
    }
  }, [accessToken, workspaceId]);

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

  const openItem = async (item: NotificationDto) => {
    if (item.unread && accessToken && workspaceId) {
      try {
        await markNotificationRead(accessToken, workspaceId, item.id);
        setItems((prev) =>
          prev.map((n) => (n.id === item.id ? { ...n, unread: false } : n))
        );
        setUnreadCount((c) => Math.max(0, c - 1));
      } catch {
        /* keep navigation */
      }
    }
    setOpen(false);
    if (item.href) router.push(item.href);
    else router.push("/home/inbox");
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
      <DropdownMenuContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b border-border px-3 py-2">
          <span className="text-sm font-semibold">Notifications</span>
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
          <ScrollArea className="max-h-[min(360px,60vh)]">
            <ul className="p-1">
              {items.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    className={cn(
                      "flex w-full gap-2 rounded-md px-2 py-2 text-left text-sm hover:bg-accent",
                      item.unread && "bg-accent/40"
                    )}
                    onClick={() => void openItem(item)}
                  >
                    <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded bg-muted text-xs">
                      {notificationIcon(item.type)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-start justify-between gap-2">
                        <span className="truncate font-medium">{item.title}</span>
                        <span className="shrink-0 text-[10px] text-muted-foreground">
                          {formatRelativeTime(new Date(item.createdAt))}
                        </span>
                      </span>
                      <span className="line-clamp-2 text-xs text-muted-foreground">
                        {item.preview}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {item.source}
                      </span>
                    </span>
                    {item.unread ? (
                      <span className="mt-2 size-2 shrink-0 rounded-full bg-primary" />
                    ) : null}
                  </button>
                </li>
              ))}
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
