"use client";

import Link from "next/link";
import {
  FilterIcon,
  LayoutGridIcon,
  SearchIcon,
  SlidersHorizontalIcon,
  SquareCheckBigIcon,
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

type ViewMode = "list" | "board" | "calendar";

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
      <div className="flex items-start justify-between gap-4 px-6 pt-4 pb-2">
        <div className="min-w-0">
          <div className="mb-1 flex items-center gap-1.5 text-xs text-muted-foreground">
            <span
              className="size-2 shrink-0 rounded-sm"
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
            <span className="truncate">{listName}</span>
          </div>
          <h1 className="truncate text-xl font-semibold tracking-tight">
            {listName}
          </h1>
        </div>
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="h-9 w-9 shrink-0 rounded-full"
                aria-label="Create task"
                onClick={onCreateTask}
              >
                <SquareCheckBigIcon className="size-4" strokeWidth={2} />
              </Button>
            }
          />
          <TooltipContent side="bottom" align="end">
            Create task
          </TooltipContent>
        </Tooltip>
      </div>

      <UnderlineTabBar
        className="px-6"
        tabs={[
          { id: "list", label: "List" },
          { id: "board", label: "Board" },
          { id: "calendar", label: "Calendar" },
        ]}
        active={view}
        onChange={onViewChange}
      />

      <div className="flex flex-wrap items-center justify-between gap-2 px-6 py-2.5">
        <div className="flex items-center gap-2">
          <Select
            value={statusFilter}
            onValueChange={(v) => onStatusFilterChange(v ?? "all")}
          >
            <SelectTrigger className="h-8 w-[140px] gap-2 text-xs font-medium">
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
        <div className="flex items-center gap-0.5">
          <Tooltip>
            <TooltipTrigger
              render={
                <Button variant="ghost" size="icon-sm" aria-label="Filter">
                  <FilterIcon className="size-4" />
                </Button>
              }
            />
            <TooltipContent side="bottom">Filter</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger
              render={
                <Button variant="ghost" size="icon-sm" aria-label="Group">
                  <LayoutGridIcon className="size-4" />
                </Button>
              }
            />
            <TooltipContent side="bottom">Group</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger
              render={
                <Button variant="ghost" size="icon-sm" aria-label="Search">
                  <SearchIcon className="size-4" />
                </Button>
              }
            />
            <TooltipContent side="bottom">Search</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger
              render={
                <Button variant="ghost" size="icon-sm" aria-label="Display settings">
                  <SlidersHorizontalIcon className="size-4" />
                </Button>
              }
            />
            <TooltipContent side="bottom">Display</TooltipContent>
          </Tooltip>
        </div>
      </div>
    </div>
  );
}
