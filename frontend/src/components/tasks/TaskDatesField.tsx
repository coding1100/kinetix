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
              "inline-flex items-center gap-1.5 text-xs",
              !hasAny && "text-muted-foreground"
            )}
          >
            <span className="inline-flex items-center gap-1">
              <CalendarIcon className="size-3" />
              <span className={cn(!startDateIso && "text-muted-foreground")}>{startLabel}</span>
            </span>
            <ArrowRightIcon className="size-3 text-muted-foreground" />
            <span className="inline-flex items-center gap-1">
              <CalendarIcon className="size-3" />
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
            max={toInputDate(dueDateIso) || undefined}
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
            min={toInputDate(startDateIso) || undefined}
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
