"use client";

import { useState } from "react";
import { ClockIcon, CalendarIcon, SendIcon } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

interface SendLaterPopoverProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onScheduleSend: (scheduledAtIso: string) => void;
  disabled?: boolean;
}

export function SendLaterPopover({
  open,
  onOpenChange,
  onScheduleSend,
  disabled,
}: SendLaterPopoverProps) {
  const [customDate, setCustomDate] = useState("");
  const [customTime, setCustomTime] = useState("09:00");

  function getTomorrow9AM() {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(9, 0, 0, 0);
    return d;
  }

  function getNextMonday9AM() {
    const d = new Date();
    const day = d.getDay();
    const diff = d.getDate() + ((7 - day + 1) % 7 || 7);
    d.setDate(diff);
    d.setHours(9, 0, 0, 0);
    return d;
  }

  function handleSchedulePreset(date: Date) {
    onScheduleSend(date.toISOString());
    onOpenChange(false);
    toast.success(`Message scheduled for ${date.toLocaleString()}`);
  }

  function handleScheduleCustom() {
    if (!customDate) {
      toast.error("Please pick a date");
      return;
    }
    const target = new Date(`${customDate}T${customTime}:00`);
    if (Number.isNaN(target.getTime()) || target <= new Date()) {
      toast.error("Scheduled time must be in the future");
      return;
    }
    onScheduleSend(target.toISOString());
    onOpenChange(false);
    toast.success(`Message scheduled for ${target.toLocaleString()}`);
  }

  const tomorrow = getTomorrow9AM();
  const nextMonday = getNextMonday9AM();

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger className="hidden" />
      <PopoverContent align="end" className="w-64 p-2 space-y-2">
        <div className="flex items-center gap-1.5 border-b border-border px-2 py-1 text-xs font-semibold text-foreground">
          <ClockIcon className="size-3.5 text-blue-500" />
          Send Later / Schedule
        </div>

        <div className="space-y-1">
          <button
            type="button"
            className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-xs text-foreground hover:bg-muted transition-colors"
            onClick={() => handleSchedulePreset(tomorrow)}
          >
            <span>Tomorrow</span>
            <span className="text-[10px] text-muted-foreground">9:00 AM</span>
          </button>

          <button
            type="button"
            className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-xs text-foreground hover:bg-muted transition-colors"
            onClick={() => handleSchedulePreset(nextMonday)}
          >
            <span>Next Monday</span>
            <span className="text-[10px] text-muted-foreground">9:00 AM</span>
          </button>
        </div>

        <div className="border-t border-border pt-2 space-y-2">
          <div className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
            <CalendarIcon className="size-3" />
            Custom Date & Time
          </div>
          <div className="grid grid-cols-2 gap-1">
            <Input
              type="date"
              value={customDate}
              onChange={(e) => setCustomDate(e.target.value)}
              className="h-7 text-[11px]"
            />
            <Input
              type="time"
              value={customTime}
              onChange={(e) => setCustomTime(e.target.value)}
              className="h-7 text-[11px]"
            />
          </div>
          <Button
            size="sm"
            className="w-full h-7 gap-1 text-xs bg-blue-600 hover:bg-blue-700 text-white"
            onClick={handleScheduleCustom}
          >
            <SendIcon className="size-3" />
            Schedule Send
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
