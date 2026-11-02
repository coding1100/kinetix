"use client";

import { useState } from "react";
import { CalendarIcon, ArrowRightIcon } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { formatShortDate, isCompleteDateInput } from "@/lib/tasks/task-time";
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

/** Saves only finished dates: saving every keystroke re-rendered the input
 * from the server mid-typing and stored partial years. Remounted per saved
 * value (see `key` below), so the draft always starts from it. */
function CommittedDateInput({
  value,
  min,
  max,
  onCommit,
}: {
  value: string;
  min?: string;
  max?: string;
  onCommit: (value: string) => void | Promise<void>;
}) {
  const [draft, setDraft] = useState(value);
  const commit = (next: string) => {
    if (next !== value) void onCommit(next);
  };
  return (
    <Input
      type="date"
      value={draft}
      min={min}
      max={max}
      onChange={(e) => {
        setDraft(e.target.value);
        if (isCompleteDateInput(e.target.value)) commit(e.target.value);
      }}
      onBlur={() => {
        if (draft === "" || isCompleteDateInput(draft)) commit(draft);
        else setDraft(value);
      }}
    />
  );
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
          <CommittedDateInput
            key={toInputDate(startDateIso)}
            value={toInputDate(startDateIso)}
            max={toInputDate(dueDateIso) || undefined}
            onCommit={onStartChange}
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
          <CommittedDateInput
            key={toInputDate(dueDateIso)}
            value={toInputDate(dueDateIso)}
            min={toInputDate(startDateIso) || undefined}
            onCommit={onDueChange}
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
