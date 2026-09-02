"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo } from "react";
import { HomeIcon, MessageSquareIcon, UsersIcon, UsersRoundIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { FEATURE_FLAGS } from "@/lib/feature-flags";
import { useNotificationsUnread } from "@/hooks/use-notifications-unread";
import { useChatStore } from "@/stores/chat-store";

type MobileNavItem = {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number | "dot";
  hidden?: boolean;
};

export function MobileBottomNav() {
  const pathname = usePathname();
  const { unreadCount } = useNotificationsUnread();
  const homeUnread = unreadCount > 0 ? unreadCount : undefined;

  const chatHasUnread = useChatStore((s) => {
    const cache = s.sidebarListsCache;
    if (!cache) return false;
    return (
      cache.channels.some((c) => c.unread > 0) ||
      cache.dms.some((d) => d.unread > 0)
    );
  });

  const items = useMemo<MobileNavItem[]>(() => {
    const list: MobileNavItem[] = [
      { label: "Home", href: "/home/inbox", icon: HomeIcon, badge: homeUnread },
      { label: "Chat", href: "/chat", icon: MessageSquareIcon, badge: chatHasUnread ? "dot" : undefined },
      { label: "Teams", href: "/teams", icon: UsersRoundIcon, hidden: !FEATURE_FLAGS.teams },
      { label: "People", href: "/people", icon: UsersIcon },
    ];
    return list.filter((item) => !item.hidden);
  }, [homeUnread, chatHasUnread]);

  const isActive = (href: string) => {
    if (href === "/home/inbox") return pathname.startsWith("/home");
    if (href === "/chat") return pathname.startsWith("/chat");
    if (href === "/teams") return pathname.startsWith("/teams");
    if (href === "/people") return pathname.startsWith("/people");
    return pathname === href;
  };

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 flex h-14 items-center justify-around border-t border-border bg-card pb-safe backdrop-blur-md md:hidden"
      aria-label="Mobile bottom navigation"
    >
      {items.map((item) => {
        const Icon = item.icon;
        const active = isActive(item.href);
        return (
          <Link
            key={item.label}
            href={item.href}
            className={cn(
              "relative flex flex-1 flex-col items-center justify-center py-1.5 transition-colors",
              active ? "text-primary font-semibold" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <span className="relative flex size-6 items-center justify-center">
              <Icon className="size-5" />
              {item.badge === "dot" && (
                <span className="absolute -top-0.5 -right-1 size-2 rounded-full bg-rose-500 ring-2 ring-card" />
              )}
              {typeof item.badge === "number" && (
                <span className="absolute -top-1 -right-2 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-bold text-white ring-2 ring-card">
                  {item.badge > 99 ? "99+" : item.badge}
                </span>
              )}
            </span>
            <span className="mt-0.5 text-[10px] leading-none">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
