"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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
} from "@/stores/home-sidebar-store";
import { useUiStore } from "@/stores/ui-store";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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

export function HomeSidebar() {
  const pathname = usePathname();
  const { items, filter, setFilter, myTasksExpanded, setMyTasksExpanded } =
    useHomeSidebarStore();
  const visibleItems = items.filter((i) => i.pinned);
  const openModal = useUiStore((s) => s.openModal);
  const { secondaryPanelOpen, setSecondaryPanelOpen } = useShellStore();
  const { unreadCount } = useNotificationsUnread();
  const onMyTasksRoute = pathname.startsWith("/home/my-tasks");
  const showMyTasksChildren = myTasksExpanded || onMyTasksRoute;

  if (!secondaryPanelOpen) return null;

  return (
    <aside className="flex w-[260px] shrink-0 flex-col border-r border-sidebar-border bg-sidebar">
      <div className="flex items-center justify-between px-3 py-3">
        <span className="text-sm font-semibold text-sidebar-foreground">
          Home
        </span>
        <div className="flex items-center gap-0.5">
          <Button variant="ghost" size="icon-sm" title="Search">
            <SearchIcon className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            title="Filter unread"
            className={filter === "unread" ? "text-primary" : ""}
            onClick={() =>
              setFilter(filter === "unread" ? "none" : "unread")
            }
          >
            <FilterIcon className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            title="Customize"
            onClick={() => openModal("customize-home")}
          >
            <Settings2Icon className="size-4" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button variant="ghost" size="icon-sm" title="Create">
                  <PlusIcon className="size-4" />
                </Button>
              }
            />
            <DropdownMenuContent align="end" className="w-44">
              {["Task", "Message", "Channel", "Doc"].map((item) => (
                <DropdownMenuItem
                  key={item}
                  onClick={() => {
                    if (item === "Channel") openModal("new-channel");
                    else if (item === "Message") openModal("new-dm");
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
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setSecondaryPanelOpen(false)}
            title="Collapse sidebar"
          >
            <PanelLeftCloseIcon className="size-4" />
          </Button>
        </div>
      </div>
      {filter === "unread" && (
        <div className="px-3 pb-2">
          <Badge variant="secondary" className="text-xs">
            Unread only
          </Badge>
        </div>
      )}
      <ScrollArea className="flex-1 px-2">
        <nav className="pb-4">
          {visibleItems.map((item) => {
            const active =
              pathname === item.href ||
              (item.id === "my-tasks" && onMyTasksRoute);
            const isMyTasks = item.id === "my-tasks";

            return (
              <div key={item.id}>
                <div className="flex items-center gap-0.5">
                  {isMyTasks ? (
                    <button
                      type="button"
                      className="flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-sidebar-accent"
                      aria-label={showMyTasksChildren ? "Collapse" : "Expand"}
                      onClick={() => setMyTasksExpanded(!showMyTasksChildren)}
                    >
                      {showMyTasksChildren ? (
                        <ChevronDownIcon className="size-3.5" />
                      ) : (
                        <ChevronRightIcon className="size-3.5" />
                      )}
                    </button>
                  ) : (
                    <span className="size-8 shrink-0" aria-hidden />
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    nativeButton={false}
                    render={<Link href={item.href} />}
                    className={cn(
                      "mb-0.5 h-8 min-w-0 flex-1 justify-start gap-2 px-2 font-medium",
                      active && "bg-sidebar-accent text-primary"
                    )}
                  >
                    <SidebarNavIcon itemId={item.id} active={active} />
                    <span className="min-w-0 flex-1 truncate">{item.label}</span>
                    {item.id === "inbox" && unreadCount > 0 ? (
                      <span className="size-2 shrink-0 rounded-full bg-primary" />
                    ) : null}
                  </Button>
                </div>
                {isMyTasks && showMyTasksChildren ? (
                  <ul className="mb-1 ml-8 space-y-0.5 border-l border-sidebar-border pl-2">
                    {MY_TASKS_LINKS.map((link) => {
                      const subActive = pathname === link.href;
                      return (
                        <li key={link.href}>
                          <Button
                            variant="ghost"
                            size="sm"
                            nativeButton={false}
                            render={<Link href={link.href} />}
                            className={cn(
                              "h-7 w-full justify-start gap-2 px-2 text-xs font-normal",
                              subActive &&
                                "bg-sidebar-accent font-medium text-primary"
                            )}
                          >
                            <SidebarNavIcon
                              itemId="my-tasks"
                              href={link.href}
                              active={subActive}
                            />
                            <span className="truncate">{link.label}</span>
                          </Button>
                        </li>
                      );
                    })}
                  </ul>
                ) : null}
              </div>
            );
          })}
        </nav>
      </ScrollArea>
      <Separator />
    </aside>
  );
}
