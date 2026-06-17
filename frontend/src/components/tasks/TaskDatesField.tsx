"use client";

import { useState } from "react";
import { CalendarIcon, ArrowRightIcon } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { formatShortDate } from "@/lib/tasks/task-time";
import { cn } from "@/lib/utils";

type TaskDatesFieldProps = {
  startDateIso?: string | null;
  dueDateIso?: string | null;
  onStartChange: (value: string) => void | Promise<void>;
  onDueChange: (value: string) => void | Promise<void>;
};

function toInputDate(iso?: string | null) {
  return iso ? iso.slice(0, 10) : "";
}

export function TaskDatesField({
  startDateIso,
  dueDateIso,
  onStartChange,
  onDueChange,
}: TaskDatesFieldProps) {
  const [open, setOpen] = useState(false);
  const startLabel = formatShortDate(startDateIso) ?? "Start";
  const dueLabel = formatShortDate(dueDateIso) ?? "Due";
  const hasAny = Boolean(startDateIso || dueDateIso);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <button
            type="button"
            className={cn(
              "inline-flex items-center gap-2 rounded-md border border-dashed border-border px-2.5 py-1 text-sm hover:bg-muted/50",
              !hasAny && "text-muted-foreground"
            )}
          >
            <span className="inline-flex items-center gap-1.5">
              <CalendarIcon className="size-3.5" />
              <span className={cn(!startDateIso && "text-muted-foreground")}>{startLabel}</span>
            </span>
            <ArrowRightIcon className="size-3.5 text-muted-foreground" />
            <span className="inline-flex items-center gap-1.5">
              <CalendarIcon className="size-3.5" />
              <span className={cn(!dueDateIso && "text-muted-foreground")}>{dueLabel}</span>
            </span>
          </button>
        }
      />
      <PopoverContent align="start" className="w-72 space-y-3 p-3">
        <div>
          <p className="mb-1.5 text-xs font-medium text-muted-foreground">Start date</p>
          <Input
            type="date"
            value={toInputDate(startDateIso)}
            onChange={(e) => void onStartChange(e.target.value)}
          />
          {startDateIso ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="mt-2 w-full"
              onClick={() => void onStartChange("")}
            >
              Clear start date
            </Button>
          ) : null}
        </div>
        <div>
          <p className="mb-1.5 text-xs font-medium text-muted-foreground">Due date</p>
          <Input
            type="date"
            value={toInputDate(dueDateIso)}
            onChange={(e) => void onDueChange(e.target.value)}
          />
          {dueDateIso ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="mt-2 w-full"
              onClick={() => void onDueChange("")}
            >
              Clear due date
            </Button>
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  );
}
