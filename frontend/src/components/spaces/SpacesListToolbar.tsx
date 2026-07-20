"use client";

import Link from "next/link";
import {
  CalendarIcon,
  FilterIcon,
  HashIcon,
  LayoutGridIcon,
  ListIcon,
  SearchIcon,
  SlidersHorizontalIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { UnderlineTabBar } from "@/components/shared/Tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ListStatus } from "@/lib/types/task";
import { cn } from "@/lib/utils";

type ViewMode = "channel" | "list" | "board" | "calendar";

export function SpacesListToolbar({
  listName,
  spaceName,
  spaceColor,
  spaceId,
  view,
  onViewChange,
  statuses,
  statusFilter,
  onStatusFilterChange,
  onCreateTask,
  className,
}: {
  listName: string;
  spaceName: string;
  spaceColor: string;
  spaceId: string;
  view: ViewMode;
  onViewChange: (view: ViewMode) => void;
  statuses?: ListStatus[];
  statusFilter: string;
  onStatusFilterChange: (value: string) => void;
  onCreateTask: () => void;
  className?: string;
}) {
  return (
    <div className={cn("shrink-0 border-b border-border bg-background", className)}>
      <div className="flex items-center justify-between gap-2 px-3 py-1">
        <div className="flex min-w-0 items-center gap-1 text-[11px] text-muted-foreground">
          <span
            className="size-1.5 shrink-0 rounded-sm"
            style={{ backgroundColor: spaceColor }}
            aria-hidden
          />
          <Link
            href={`/home/spaces/${spaceId}`}
            className="truncate hover:text-foreground"
          >
            {spaceName}
          </Link>
          <span>/</span>
          <span className="truncate text-[11px] font-medium text-foreground">
            {listName}
          </span>
        </div>
      </div>

      <UnderlineTabBar
        className="px-3"
        size="xs"
        tabs={[
          {
            id: "channel",
            label: "Channel",
            icon: <HashIcon className="size-3" />,
          },
          {
            id: "list",
            label: "List",
            icon: <ListIcon className="size-3" />,
          },
          {
            id: "board",
            label: "Board",
            icon: <LayoutGridIcon className="size-3" />,
          },
          {
            id: "calendar",
            label: "Calendar",
            icon: <CalendarIcon className="size-3" />,
          },
        ]}
        active={view}
        onChange={onViewChange}
      />

      {view === "channel" ? null : (
      <div className="flex flex-wrap items-center justify-between gap-1 px-3 py-1">
        <div className="flex items-center gap-1">
          <Select
            value={statusFilter}
            onValueChange={(v) => onStatusFilterChange(v ?? "all")}
          >
            <SelectTrigger className="h-6 w-[110px] gap-1 text-[11px] font-medium">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {(statuses ?? []).map((status) => (
                <SelectItem key={status.id} value={status.id}>
                  {status.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-0">
          <Tooltip>
            <TooltipTrigger
              render={
                <Button variant="ghost" size="icon-sm" className="h-6 w-6" aria-label="Filter">
                  <FilterIcon className="size-3" />
                </Button>
              }
            />
            <TooltipContent side="bottom">Filter</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger
              render={
                <Button variant="ghost" size="icon-sm" className="h-6 w-6" aria-label="Group">
                  <LayoutGridIcon className="size-3" />
                </Button>
              }
            />
            <TooltipContent side="bottom">Group</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger
              render={
                <Button variant="ghost" size="icon-sm" className="h-6 w-6" aria-label="Search">
                  <SearchIcon className="size-3" />
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
                  className="h-6 w-6"
                  aria-label="Display settings"
                >
                  <SlidersHorizontalIcon className="size-3" />
                </Button>
              }
            />
            <TooltipContent side="bottom">Display</TooltipContent>
          </Tooltip>
        </div>
      </div>
      )}
    </div>
  );
}
