"use client";

import Link from "next/link";
import { useState } from "react";
import {
  CalendarIcon,
  FilterIcon,
  HashIcon,
  LayoutGridIcon,
  ListIcon,
  SearchIcon,
  Share2Icon,
  SlidersHorizontalIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ShareModal } from "@/components/shared/ShareModal";
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
  listId,
  listName,
  spaceName,
  spaceColor,
  spaceId,
  spaceAccessible = true,
  view,
  onViewChange,
  statuses,
  statusFilter,
  onStatusFilterChange,
  onCreateTask,
  canShare,
  className,
}: {
  listId: string;
  listName: string;
  spaceName: string;
  spaceColor: string;
  spaceId: string;
  spaceAccessible?: boolean;
  view: ViewMode;
  onViewChange: (view: ViewMode) => void;
  statuses?: ListStatus[];
  statusFilter: string;
  onStatusFilterChange: (value: string) => void;
  onCreateTask: () => void;
  canShare?: boolean;
  className?: string;
}) {
  const [shareOpen, setShareOpen] = useState(false);

  return (
    <div className={cn("shrink-0 border-b border-border bg-background", className)}>
      <div className="flex items-center justify-between gap-2 px-3 py-1">
        <div className="flex min-w-0 items-center gap-1 text-[11px] text-muted-foreground">
          <span
            className="size-1.5 shrink-0 rounded-sm"
            style={{ backgroundColor: spaceColor }}
            aria-hidden
          />
          {spaceAccessible ? (
            <Link
              href={`/home/spaces/${spaceId}`}
              className="truncate hover:text-foreground"
            >
              {spaceName}
            </Link>
          ) : (
            <span className="truncate">{spaceName}</span>
          )}
          <span>/</span>
          <span className="truncate text-[11px] font-medium text-foreground">
            {listName}
          </span>
        </div>
        {canShare ? (
          <Button
            variant="outline"
            size="sm"
            className="h-6 shrink-0 gap-1 px-2 text-[11px]"
            onClick={() => setShareOpen(true)}
          >
            <Share2Icon className="size-3" />
            Share
          </Button>
        ) : null}
      </div>
      {shareOpen ? (
        <ShareModal
          open={shareOpen}
          onOpenChange={setShareOpen}
          resourceType="list"
          resourceId={listId}
          resourceName={listName}
        />
      ) : null}

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
