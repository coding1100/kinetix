"use client";

import {
  MoreHorizontalIcon,
  PencilIcon,
  Trash2Icon,
  UserPlusIcon,
} from "lucide-react";
import type { TeamDetail } from "@/lib/api/teams";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { TEAM_DETAIL_TABS, teamHandle, type TeamDetailTab } from "@/components/teams/team-utils";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export function TeamDetailHeader({
  team,
  tab,
  onTabChange,
  manage,
  onEdit,
  onAddMember,
  onDelete,
}: {
  team: TeamDetail;
  tab: TeamDetailTab;
  onTabChange: (tab: TeamDetailTab) => void;
  manage: boolean;
  onEdit: () => void;
  onAddMember: () => void;
  onDelete: () => void;
}) {
  const iconLabel = team.icon?.slice(0, 2) ?? team.name.slice(0, 1).toUpperCase();

  return (
    <header className="shrink-0 border-b border-border bg-background">
      <div className="flex items-start justify-between gap-3 px-6 pb-3 pt-4">
        <div className="flex min-w-0 items-center gap-3">
          <span
            className="flex size-10 shrink-0 items-center justify-center rounded-lg text-sm font-bold text-white shadow-sm"
            style={{ backgroundColor: team.color }}
          >
            {iconLabel}
          </span>
          <div className="min-w-0">
            <h1 className="truncate text-xl font-semibold tracking-tight">{team.name}</h1>
            <p className="text-sm text-muted-foreground">{teamHandle(team.name)}</p>
          </div>
        </div>

        {manage ? (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button variant="outline" size="icon" aria-label="Team actions">
                  <MoreHorizontalIcon className="size-4" />
                </Button>
              }
            />
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem onClick={onEdit}>
                <PencilIcon className="size-4" />
                Edit team
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onAddMember}>
                <UserPlusIcon className="size-4" />
                Add member
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onClick={onDelete}>
                <Trash2Icon className="size-4" />
                Delete team
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>

      <Tabs
        value={tab}
        onValueChange={(v) => {
          const next = TEAM_DETAIL_TABS.find((t) => t.id === v);
          if (next?.enabled) onTabChange(next.id);
          else if (v) toast(`${next?.label ?? v} — coming soon`);
        }}
        className="px-6"
      >
        <div className="-mx-6 overflow-x-auto overflow-y-hidden px-6 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          <TabsList
            variant="line"
            className="h-auto w-max min-w-full justify-start gap-0 border-0 pb-0"
          >
            {TEAM_DETAIL_TABS.map((item) => (
              <TabsTrigger
                key={item.id}
                value={item.id}
                className={cn(
                  "shrink-0 px-3 py-2 text-sm",
                  !item.enabled && "opacity-60"
                )}
              >
                {item.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
      </Tabs>
    </header>
  );
}
