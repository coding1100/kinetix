"use client";

import Link from "next/link";
import {
  BellIcon,
  FileTextIcon,
  LayoutListIcon,
  SquareCheckBigIcon,
} from "lucide-react";
import { HomeDataState } from "@/components/home/HomeDataState";
import { cn } from "@/lib/utils";

type RecentItem = {
  id: string;
  name: string;
  type: string;
  space: string;
  href: string;
};

function recentIcon(type: string) {
  switch (type.toLowerCase()) {
    case "task":
      return SquareCheckBigIcon;
    case "reminder":
      return BellIcon;
    case "doc":
      return FileTextIcon;
    default:
      return LayoutListIcon;
  }
}

export function MyTasksRecentsList({
  recents,
  loading,
  error,
}: {
  recents: RecentItem[] | undefined;
  loading: boolean;
  error: string | null;
}) {
  return (
    <HomeDataState
      loading={loading}
      error={error}
      empty={!loading && !error && (recents?.length ?? 0) === 0}
      emptyMessage="Recently opened items will appear here."
    >
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        {recents?.map((item, index) => {
          const Icon = recentIcon(item.type);
          return (
            <Link
              key={item.id}
              href={item.href}
              className={cn(
                "flex items-start gap-3 px-4 py-3 transition-colors hover:bg-muted/40",
                index > 0 && "border-t border-border/60"
              )}
            >
              <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{item.name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {item.type}
                  {item.space ? ` · ${item.space}` : ""}
                </p>
              </div>
            </Link>
          );
        })}
      </div>
    </HomeDataState>
  );
}
