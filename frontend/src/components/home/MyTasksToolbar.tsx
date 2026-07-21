"use client";

import {
  FilterIcon,
  LayoutGridIcon,
  SearchIcon,
  SlidersHorizontalIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function MyTasksToolbar({
  statusFilter,
  onStatusFilterChange,
  statusOptions,
  showStatusFilter = true,
}: {
  statusFilter?: string;
  onStatusFilterChange?: (value: string) => void;
  statusOptions?: { id: string; name: string }[];
  showStatusFilter?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-6 py-2.5">
      {showStatusFilter && statusFilter !== undefined && onStatusFilterChange ? (
        <Select
          value={statusFilter}
          onValueChange={(v) => onStatusFilterChange(v ?? "all")}
        >
          <SelectTrigger className="h-8 w-[130px] gap-2 text-xs font-medium">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {(statusOptions ?? []).map((option) => (
              <SelectItem key={option.id} value={option.id}>
                {option.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        <div />
      )}
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
              <Button variant="ghost" size="icon-sm" aria-label="Display">
                <SlidersHorizontalIcon className="size-4" />
              </Button>
            }
          />
          <TooltipContent side="bottom">Display</TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}
