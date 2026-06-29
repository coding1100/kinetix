"use client";

import Link from "next/link";
import { useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  HomeIcon,
  MessageSquareIcon,
  CalendarIcon,
  UsersIcon,
  UsersRoundIcon,
  FileTextIcon,
  LayoutDashboardIcon,
  ClipboardCheckIcon,
  ClockIcon,
  LayoutGridIcon,
  BoxesIcon,
  UserPlusIcon,
  ChevronsRightIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useShellStore } from "@/stores/shell-store";
import { useNotificationsUnread } from "@/hooks/use-notifications-unread";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";

type NavItem = {
  label: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  href?: string;
  badge?: number | "dot";
  disabled?: boolean;
  /** Hidden from rail — kept in config for future phases */
  hidden?: boolean;
};

const BASE_NAV_ITEMS: NavItem[] = [
  { label: "Home", icon: HomeIcon, href: "/home/inbox" },
  { label: "Chat", icon: MessageSquareIcon, href: "/chat", badge: "dot" },
  { label: "Spaces", icon: BoxesIcon, href: "/spaces" },
  { label: "Teams", icon: UsersRoundIcon, href: "/teams" },
  { label: "Planner", icon: CalendarIcon, disabled: true, hidden: true },
  { label: "People", icon: UsersIcon, href: "/people" },
  { label: "Docs", icon: FileTextIcon, disabled: true, hidden: true },
  { label: "Dashboard", icon: LayoutDashboardIcon, disabled: true, hidden: true },
  { label: "Forms", icon: ClipboardCheckIcon, disabled: true, hidden: true },
  { label: "Timesheet", icon: ClockIcon, disabled: true, hidden: true },
  { label: "More", icon: LayoutGridIcon, disabled: true, hidden: true },
];

export function GlobalNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { secondaryPanelOpen, setSecondaryPanelOpen } = useShellStore();
  const { unreadCount } = useNotificationsUnread();
  const homeUnread = unreadCount > 0 ? unreadCount : undefined;

  const navItems = useMemo<NavItem[]>(
    () =>
      BASE_NAV_ITEMS.filter((item) => !item.hidden).map((item) =>
        item.label === "Home" ? { ...item, badge: homeUnread } : item
      ),
    [homeUnread]
  );

  const isActive = (item: NavItem) => {
    if (!item.href) return false;
    if (item.label === "Home") return pathname.startsWith("/home");
    if (item.label === "Chat") return pathname.startsWith("/chat");
    if (item.label === "Spaces") return pathname.startsWith("/spaces");
    if (item.label === "Teams") return pathname.startsWith("/teams");
    if (item.label === "People") return pathname.startsWith("/people");
    return pathname === item.href;
  };

  return (
    <nav
      className="flex h-full w-[70px] shrink-0 flex-col py-2 pl-2"
      aria-label="Global navigation"
    >
      <div
        className={cn(
          "flex min-h-0 flex-1 flex-col rounded-lg px-1.5 py-1.5",
          "bg-gradient-to-b from-[rgb(90,67,214)] to-[rgb(43,33,106)]",
          "shadow-lg shadow-indigo-950/25"
        )}
      >
        {/* Expand — only when Home/Chat sidebar is collapsed */}
        {!secondaryPanelOpen && (
          <>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSecondaryPanelOpen(true)}
              className="mx-auto size-10 rounded-lg bg-white text-[#3d3d3d] shadow-sm hover:bg-white/95 hover:text-foreground"
              title="Open sidebar"
              aria-label="Open sidebar"
            >
              <ChevronsRightIcon className="size-5" strokeWidth={2.5} />
            </Button>
            <Separator className="my-2 bg-white/15" />
          </>
        )}

        <div className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto overflow-x-hidden">
          {navItems.map((item) => (
            <NavRailItem
              key={item.label}
              item={item}
              active={isActive(item)}
            />
          ))}
        </div>

        <Separator className="my-2 bg-white/15" />

        <Button
          variant="ghost"
          className="mx-auto flex h-auto w-full flex-col gap-1 py-2 text-white/80 hover:bg-white/10 hover:text-white"
          onClick={() => router.push("/people?invite=1")}
        >
          <UserPlusIcon className="size-5" strokeWidth={1.75} />
          <span className="text-[10px] leading-none font-medium">Invite</span>
        </Button>
      </div>
    </nav>
  );
}

function NavRailItem({
  item,
  active,
}: {
  item: NavItem;
  active: boolean;
}) {
  const setSecondaryPanelOpen = useShellStore((s) => s.setSecondaryPanelOpen);
  const Icon = item.icon;
  const iconWrapClass = cn(
    "flex size-8 items-center justify-center rounded-lg transition-colors",
    active ? "bg-white/20" : "bg-transparent",
    !item.disabled && !active && "group-hover:bg-white/20"
  );

  const content = (
    <>
      <span className="relative flex size-9 items-center justify-center">
        <span className={iconWrapClass}>
          <Icon className="size-[18px]" strokeWidth={1.75} />
        </span>
        {item.badge === "dot" && (
          <span className="absolute top-0.5 right-0.5 size-2 rounded-full bg-[#ff6b9d] ring-2 ring-[#6b52d4]" />
        )}
        {typeof item.badge === "number" && (
          <span className="absolute -top-0.5 -right-1 flex h-[15px] min-w-[15px] items-center justify-center rounded-full bg-[#ff6b9d] px-1 text-[9px] font-bold text-white ring-2 ring-[#6b52d4]">
            {item.badge}
          </span>
        )}
      </span>
      <span className="max-w-[64px] truncate text-center text-[10px] leading-tight font-medium">
        {item.label}
      </span>
    </>
  );

  const className = cn(
    "group relative flex w-full flex-col items-center gap-0.5 rounded-lg py-2 transition-colors",
    active ? "text-white" : "text-white/75 hover:text-white",
    item.disabled && "cursor-not-allowed opacity-40 hover:text-white/75"
  );

  if (item.href && !item.disabled) {
    return (
      <Link
        href={item.href}
        className={className}
        onClick={() => setSecondaryPanelOpen(true)}
      >
        {content}
      </Link>
    );
  }

  return (
    <button
      type="button"
      disabled={item.disabled}
      className={className}
      onClick={() => item.disabled && toast(`${item.label} — Phase 3+`)}
    >
      {content}
    </button>
  );
}
