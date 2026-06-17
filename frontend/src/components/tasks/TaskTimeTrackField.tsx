"use client";

import { useEffect, useState } from "react";
import { PlayIcon, SquareIcon, TimerIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatTrackedSeconds } from "@/lib/tasks/task-time";
import { cn } from "@/lib/utils";

type TaskTimeTrackFieldProps = {
  trackedSeconds?: number;
  active?: boolean;
  startedAt?: string | null;
  busy?: boolean;
  onStart: () => void | Promise<void>;
  onStop: () => void | Promise<void>;
};

function liveElapsedSeconds(startedAt: string, baseSeconds: number) {
  const start = new Date(startedAt).getTime();
  if (Number.isNaN(start)) return baseSeconds;
  const running = Math.max(0, Math.floor((Date.now() - start) / 1000));
  return baseSeconds + running;
}

export function TaskTimeTrackField({
  trackedSeconds = 0,
  active = false,
  startedAt,
  busy = false,
  onStart,
  onStop,
}: TaskTimeTrackFieldProps) {
  const [displaySeconds, setDisplaySeconds] = useState(trackedSeconds);

  useEffect(() => {
    if (!active || !startedAt) {
      setDisplaySeconds(trackedSeconds);
      return;
    }
    const tick = () => setDisplaySeconds(liveElapsedSeconds(startedAt, trackedSeconds));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [active, startedAt, trackedSeconds]);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span
        className={cn(
          "inline-flex items-center gap-1.5 text-sm",
          displaySeconds > 0 ? "text-foreground" : "text-muted-foreground"
        )}
      >
        <TimerIcon className="size-3.5" />
        {formatTrackedSeconds(displaySeconds)}
      </span>
      {active ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 gap-1.5 border-destructive/30 text-destructive hover:bg-destructive/5"
          disabled={busy}
          onClick={() => void onStop()}
        >
          <SquareIcon className="size-3.5 fill-current" />
          Stop
        </Button>
      ) : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 gap-1.5"
          disabled={busy}
          onClick={() => void onStart()}
        >
          <PlayIcon className="size-3.5 fill-current" />
          Start
        </Button>
      )}
    </div>
  );
}
