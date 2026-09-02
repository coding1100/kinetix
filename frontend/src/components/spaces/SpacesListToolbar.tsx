"use client";

import Link from "next/link";
import { useState } from "react";
import {
  CalendarIcon,
  ChartGanttIcon,
  FolderKanbanIcon,
  GaugeIcon,
  HashIcon,
  LayoutGridIcon,
  ListIcon,
  PlusIcon,
  PresentationIcon,
  SearchIcon,
  Share2Icon,
  ZapIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";

import { Input } from "@/components/ui/input";
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


export type ViewMode =
  | "channel"
  | "list"
  | "board"
  | "calendar"
  | "gantt"
  | "workload"
  | "portfolios"
  | "whiteboard";

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
  priorityFilter = "all",
  onPriorityFilterChange,
  searchQuery = "",
  onSearchQueryChange,
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
  priorityFilter?: string;
  onPriorityFilterChange?: (value: string) => void;
  searchQuery?: string;
  onSearchQueryChange?: (query: string) => void;
  onCreateTask: () => void;
  canShare?: boolean;
  className?: string;
}) {
  const [shareOpen, setShareOpen] = useState(false);

  return (
    <div className={cn("shrink-0 border-b border-border bg-background", className)}>
      <div className="flex items-center gap-2 px-3 py-1">
        <div className="flex min-w-0 items-center gap-1 text-sm text-muted-foreground">
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
          <span className="truncate text-sm font-medium text-foreground">
            {listName}
          </span>
        </div>
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

      <div className="flex items-center justify-between border-b border-border px-3 overflow-x-auto no-scrollbar max-w-full">
        <UnderlineTabBar
          className="border-b-0 px-0"
          size="default"
          tabs={[
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
            {
              id: "gantt",
              label: "Gantt",
              icon: <ChartGanttIcon className="size-3" />,
            },
            {
              id: "workload",
              label: "Workload",
              icon: <GaugeIcon className="size-3" />,
            },
            {
              id: "portfolios",
              label: "Portfolios",
              icon: <FolderKanbanIcon className="size-3" />,
            },
            {
              id: "whiteboard",
              label: "Whiteboard",
              icon: <PresentationIcon className="size-3" />,
            },
            {
              id: "channel",
              label: "Channel",
              icon: <HashIcon className="size-3" />,
            },
          ]}

          active={view}
          onChange={(v) => onViewChange(v as ViewMode)}
        />
        <div className="flex shrink-0 items-center gap-2">
          {view !== "channel" ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1.5 px-3 text-xs"
              onClick={onCreateTask}
            >
              <PlusIcon className="size-3.5" />
              Add task
            </Button>
          ) : null}
          {canShare ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1.5 border-neutral-200 bg-white px-3 text-xs text-black hover:bg-neutral-100 hover:text-black dark:bg-white dark:text-black dark:hover:bg-neutral-100 dark:hover:text-black"
              onClick={() => setShareOpen(true)}
            >
              <Share2Icon className="size-3.5 text-black" />
              Share
            </Button>
          ) : null}
        </div>
      </div>

      {view === "channel" ? null : (
        <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-40">
              <SearchIcon className="absolute left-2 top-1.5 size-3.5 text-muted-foreground" />
              <Input
                placeholder="Search tasks…"
                value={searchQuery}
                onChange={(e) => onSearchQueryChange?.(e.target.value)}
                className="h-6 pl-7 text-xs"
              />
            </div>

            <Select
              value={statusFilter}
              onValueChange={(v) => onStatusFilterChange(v ?? "all")}
            >
              <SelectTrigger className="h-6 w-[110px] gap-1 text-[11px] font-medium">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All status</SelectItem>
                {(statuses ?? []).map((status) => (
                  <SelectItem key={status.id} value={status.id}>
                    {status.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {onPriorityFilterChange ? (
              <Select
                value={priorityFilter}
                onValueChange={(v) => onPriorityFilterChange(v ?? "all")}
              >
                <SelectTrigger className="h-6 w-[110px] gap-1 text-[11px] font-medium">
                  <SelectValue placeholder="Priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All priority</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
