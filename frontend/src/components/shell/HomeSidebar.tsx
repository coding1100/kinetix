"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  PlusIcon,
  SearchIcon,
  FilterIcon,
  Settings2Icon,
  PanelLeftCloseIcon,
  ChevronDownIcon,
  ChevronRightIcon,
} from "lucide-react";
import {
  useHomeSidebarStore,
  MY_TASKS_LINKS,
  type SidebarItem,
} from "@/stores/home-sidebar-store";
import { useUiStore } from "@/stores/ui-store";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { useShellStore } from "@/stores/shell-store";
import { SidebarNavIcon } from "@/components/icons/SidebarNavIcon";
import { useNotificationsUnread } from "@/hooks/use-notifications-unread";

const navItemClass =
  "flex w-full min-w-0 items-center gap-2 rounded-md px-2.5 text-left text-sm font-medium text-sidebar-foreground transition-colors duration-150 hover:bg-sidebar-accent/80";

const navItemActiveClass =
  "bg-sidebar-accent font-medium text-sidebar-accent-foreground";

function formatUnreadCount(count: number) {
  if (count > 99) return "99+";
  return String(count);
}

function HomeNavItem({
  item,
  active,
  unreadCount,
  expandable,
  expanded,
  onToggleExpand,
}: {
  item: SidebarItem;
  active: boolean;
  unreadCount?: number;
  expandable?: boolean;
  expanded?: boolean;
  onToggleExpand?: () => void;
}) {
  return (
    <div
      className={cn(
        navItemClass,
        "h-8",
        active && navItemActiveClass
      )}
    >
      {expandable ? (
        <button
          type="button"
          className="flex size-4 shrink-0 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:text-foreground"
          aria-label={expanded ? "Collapse" : "Expand"}
          onClick={onToggleExpand}
        >
          {expanded ? (
            <ChevronDownIcon className="size-3.5" />
          ) : (
            <ChevronRightIcon className="size-3.5" />
          )}
        </button>
      ) : null}
      <Link href={item.href} className="flex min-w-0 flex-1 items-center gap-2">
        <SidebarNavIcon itemId={item.id} active={active} />
        <span className="min-w-0 flex-1 truncate">{item.label}</span>
        {item.id === "inbox" && unreadCount && unreadCount > 0 ? (
          <Badge
            variant="default"
            className="h-4 min-w-4 shrink-0 rounded-full px-1 text-[10px] font-semibold leading-none"
          >
            {formatUnreadCount(unreadCount)}
          </Badge>
        ) : null}
      </Link>
    </div>
  );
}

function MyTasksSubNav({ pathname }: { pathname: string }) {
  return (
    <ul className="relative mb-1 ml-[18px] space-y-px border-l border-sidebar-border/60 py-0.5 pl-3">
      {MY_TASKS_LINKS.map((link) => {
        const subActive = pathname === link.href;
        return (
          <li key={link.href}>
            <Link
              href={link.href}
              className={cn(
                navItemClass,
                "h-7 text-[13px] font-normal text-muted-foreground",
                subActive &&
                  "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
              )}
            >
              <SidebarNavIcon
                itemId="my-tasks"
                href={link.href}
                active={subActive}
                size="sm"
              />
              <span className="truncate">{link.label}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export function HomeSidebar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const inboxTab = pathname === "/home/inbox" ? searchParams.get("tab") : null;
  const { items, filter, setFilter, myTasksExpanded, setMyTasksExpanded } =
    useHomeSidebarStore();
  const visibleItems = items.filter((i) => i.pinned);
  const mainItems = visibleItems.filter((i) => i.id !== "favorites");
  const favoritesItem = visibleItems.find((i) => i.id === "favorites");
  const openModal = useUiStore((s) => s.openModal);
  const openModalDeferred = useUiStore((s) => s.openModalDeferred);
  const { secondaryPanelOpen, setSecondaryPanelOpen } = useShellStore();
  const { unreadCount } = useNotificationsUnread();
  const onMyTasksRoute = pathname.startsWith("/home/my-tasks");
  const showMyTasksChildren = myTasksExpanded || onMyTasksRoute;

  if (!secondaryPanelOpen) return null;

  return (
    <aside className="flex min-h-0 w-[260px] shrink-0 flex-col border-r border-sidebar-border bg-sidebar">
      <div className="flex items-center justify-between border-b border-sidebar-border px-3 py-2.5">
        <span className="text-[13px] font-semibold tracking-tight text-sidebar-foreground">
          Home
        </span>
        <div className="flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger
              render={
                <Button variant="ghost" size="icon-sm" className="size-7" aria-label="Search">
                  <SearchIcon className="size-3.5" />
                </Button>
              }
            />
            <TooltipContent side="bottom">Search</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className={cn("size-7", filter === "unread" && "text-primary")}
                  aria-label="Filter unread"
                  onClick={() =>
                    setFilter(filter === "unread" ? "none" : "unread")
                  }
                >
                  <FilterIcon className="size-3.5" />
                </Button>
              }
            />
            <TooltipContent side="bottom">Filter unread</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="size-7"
                  aria-label="Customize"
                  onClick={() => openModal("customize-home")}
                >
                  <Settings2Icon className="size-3.5" />
                </Button>
              }
            />
            <TooltipContent side="bottom">Customize</TooltipContent>
          </Tooltip>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Button variant="ghost" size="icon-sm" className="size-7" aria-label="Create">
                        <PlusIcon className="size-3.5" />
                      </Button>
                    }
                  />
                  <TooltipContent side="bottom">Create</TooltipContent>
                </Tooltip>
              }
            />
            <DropdownMenuContent align="end" className="w-44">
              {["Task", "Message", "Channel", "Doc"].map((item) => (
                <DropdownMenuItem
                  key={item}
                  onClick={() => {
                    if (item === "Channel") openModalDeferred("new-channel");
                    else if (item === "Message") openModalDeferred("new-dm");
                    else if (item === "Task") {
                      window.location.href = "/home/all-tasks";
                    } else toast(`${item} — coming soon`);
                  }}
                >
                  {item}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="size-7"
                  aria-label="Collapse sidebar"
                  onClick={() => setSecondaryPanelOpen(false)}
                >
                  <PanelLeftCloseIcon className="size-3.5" />
                </Button>
              }
            />
            <TooltipContent side="bottom">Collapse sidebar</TooltipContent>
          </Tooltip>
        </div>
      </div>
      {filter === "unread" && (
        <div className="px-3 py-2">
          <Badge variant="secondary" className="text-xs">
            Unread only
          </Badge>
        </div>
      )}
      <ScrollArea className="min-h-0 flex-1 px-2 pt-1">
        <nav className="flex flex-col gap-px pb-2">
          {mainItems.map((item) => {
            const active =
              item.id === "inbox"
                ? pathname === "/home/inbox" && inboxTab !== "replies"
                : item.id === "replies"
                  ? pathname === "/home/inbox" && inboxTab === "replies"
                  : pathname === item.href ||
                    (item.id === "my-tasks" && onMyTasksRoute);
            const isMyTasks = item.id === "my-tasks";

            return (
              <div key={item.id}>
                <HomeNavItem
                  item={item}
                  active={active}
                  unreadCount={item.id === "inbox" ? unreadCount : undefined}
                  expandable={isMyTasks}
                  expanded={showMyTasksChildren}
                  onToggleExpand={() =>
                    setMyTasksExpanded(!showMyTasksChildren)
                  }
                />
                {isMyTasks && showMyTasksChildren ? (
                  <MyTasksSubNav pathname={pathname} />
                ) : null}
              </div>
            );
          })}
        </nav>
      </ScrollArea>
      {favoritesItem ? (
        <div className="shrink-0 px-2 pb-2">
          <HomeNavItem
            item={favoritesItem}
            active={pathname === favoritesItem.href}
          />
        </div>
      ) : null}
      <Separator />
    </aside>
  );
}
