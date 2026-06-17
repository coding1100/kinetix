"use client";

import { useState } from "react";
import { HourglassIcon } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { formatTaskMinutes } from "@/lib/tasks/task-time";
import { cn } from "@/lib/utils";

const QUICK_ESTIMATES = [
  { label: "15m", minutes: 15 },
  { label: "30m", minutes: 30 },
  { label: "1h", minutes: 60 },
  { label: "2h", minutes: 120 },
  { label: "4h", minutes: 240 },
  { label: "1d", minutes: 480 },
];

type TaskTimeEstimateFieldProps = {
  minutes?: number | null;
  onChange: (minutes: number | null) => void | Promise<void>;
};

export function TaskTimeEstimateField({ minutes, onChange }: TaskTimeEstimateFieldProps) {
  const [open, setOpen] = useState(false);
  const [hours, setHours] = useState(minutes ? String(Math.floor(minutes / 60)) : "");
  const [mins, setMins] = useState(minutes ? String(minutes % 60) : "");
  const label = formatTaskMinutes(minutes);
  const isEmpty = !minutes || minutes <= 0;

  const applyCustom = () => {
    const h = Number.parseInt(hours || "0", 10) || 0;
    const m = Number.parseInt(mins || "0", 10) || 0;
    const total = h * 60 + m;
    void onChange(total > 0 ? total : null);
    setOpen(false);
  };

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          setHours(minutes ? String(Math.floor(minutes / 60)) : "");
          setMins(minutes ? String(minutes % 60) : "");
        }
      }}
    >
      <PopoverTrigger
        render={
          <button
            type="button"
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md border border-dashed border-border px-2.5 py-1 text-sm hover:bg-muted/50",
              isEmpty && "text-muted-foreground"
            )}
          >
            <HourglassIcon className="size-3.5" />
            {label}
          </button>
        }
      />
      <PopoverContent align="start" className="w-64 space-y-3 p-3">
        <div className="grid grid-cols-3 gap-2">
          {QUICK_ESTIMATES.map((item) => (
            <Button
              key={item.label}
              type="button"
              variant="outline"
              size="sm"
              className="h-8"
              onClick={() => {
                void onChange(item.minutes);
                setOpen(false);
              }}
            >
              {item.label}
            </Button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <p className="mb-1 text-xs text-muted-foreground">Hours</p>
            <Input
              type="number"
              min={0}
              value={hours}
              onChange={(e) => setHours(e.target.value)}
            />
          </div>
          <div>
            <p className="mb-1 text-xs text-muted-foreground">Minutes</p>
            <Input
              type="number"
              min={0}
              max={59}
              value={mins}
              onChange={(e) => setMins(e.target.value)}
            />
          </div>
        </div>
        <div className="flex gap-2">
          <Button type="button" className="flex-1" size="sm" onClick={applyCustom}>
            Set estimate
          </Button>
          {minutes ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                void onChange(null);
                setOpen(false);
              }}
            >
              Clear
            </Button>
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  );
}
