"use client";

import { useMemo, useState } from "react";
import { ChevronLeftIcon, ChevronRightIcon, DiamondIcon } from "lucide-react";
import type { Task } from "@/lib/types/task";
import { Button } from "@/components/ui/button";
import { HomeDataState } from "@/components/home/HomeDataState";
import { cn } from "@/lib/utils";

const DAY_COL_WIDTH = 40; // 40px per day column
const WEEK_COL_WIDTH = 80; // 80px per week column
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function GanttView({
  tasks,
  loading,
  error,
  onTaskSelect,
}: {
  tasks: Task[] | undefined;
  loading: boolean;
  error: string | null;
  onTaskSelect: (taskId: string) => void;
}) {
  const [scale, setScale] = useState<"days" | "weeks">("days");
  const [dayOffset, setDayOffset] = useState<number>(0);

  // Today reference normalized to local midnight
  const today = useMemo(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }, []);

  // Timeline date bounds
  const dates = useMemo(() => {
    const arr: Date[] = [];
    if (scale === "days") {
      const start = new Date(today);
      start.setDate(today.getDate() - 7 + dayOffset);
      for (let i = 0; i < 28; i++) {
        const d = new Date(start);
        d.setDate(start.getDate() + i);
        arr.push(d);
      }
    } else {
      // 12 weeks
      const start = new Date(today);
      start.setDate(today.getDate() - today.getDay() - 14 + dayOffset);
      for (let i = 0; i < 12; i++) {
        const d = new Date(start);
        d.setDate(start.getDate() + i * 7);
        arr.push(d);
      }
    }
    return arr;
  }, [scale, today, dayOffset]);

  const timelineStartMs = dates[0]?.getTime() ?? today.getTime();
  const colWidth = scale === "days" ? DAY_COL_WIDTH : WEEK_COL_WIDTH;
  const msPerCol = scale === "days" ? MS_PER_DAY : MS_PER_DAY * 7;
  const totalTimelineWidth = dates.length * colWidth;

  // Calculate today indicator position
  const todayLeftPx = useMemo(() => {
    const diffMs = today.getTime() - timelineStartMs;
    const cols = diffMs / msPerCol;
    if (cols < 0 || cols > dates.length) return null;
    return cols * colWidth;
  }, [today, timelineStartMs, msPerCol, colWidth, dates.length]);

  return (
    <HomeDataState loading={loading} error={error} empty={!tasks || tasks.length === 0}>
      <div className="flex flex-1 flex-col overflow-hidden p-4">
        {/* Controls */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold">Gantt Timeline</h2>
            <span className="rounded bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
              {tasks?.length ?? 0} tasks
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon"
                className="size-7"
                onClick={() => setDayOffset((prev) => prev - (scale === "days" ? 7 : 14))}
                title="Previous"
              >
                <ChevronLeftIcon className="size-4" />
              </Button>
              <Button
                variant="outline"
                size="xs"
                onClick={() => setDayOffset(0)}
                disabled={dayOffset === 0}
              >
                Today
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="size-7"
                onClick={() => setDayOffset((prev) => prev + (scale === "days" ? 7 : 14))}
                title="Next"
              >
                <ChevronRightIcon className="size-4" />
              </Button>
            </div>
            <div className="flex items-center gap-1 border-l border-border pl-2">
              <Button
                variant={scale === "days" ? "default" : "outline"}
                size="xs"
                onClick={() => {
                  setScale("days");
                  setDayOffset(0);
                }}
              >
                Days
              </Button>
              <Button
                variant={scale === "weeks" ? "default" : "outline"}
                size="xs"
                onClick={() => {
                  setScale("weeks");
                  setDayOffset(0);
                }}
              >
                Weeks
              </Button>
            </div>
          </div>
        </div>

        {/* Gantt Table Grid */}
        <div className="flex flex-1 flex-col overflow-auto rounded-lg border border-border bg-card">
          {/* Timeline Header */}
          <div className="flex border-b border-border bg-muted/50 text-xs font-semibold text-muted-foreground sticky top-0 z-10">
            <div className="w-56 shrink-0 border-r border-border p-2 bg-muted/50">Task Name</div>
            <div className="flex" style={{ width: totalTimelineWidth }}>
              {dates.map((d, idx) => {
                const isToday =
                  scale === "days" &&
                  d.getFullYear() === today.getFullYear() &&
                  d.getMonth() === today.getMonth() &&
                  d.getDate() === today.getDate();

                return (
                  <div
                    key={idx}
                    className={cn(
                      "shrink-0 border-r border-border/40 p-1 text-center text-[10px]",
                      isToday && "bg-primary/10 font-bold text-primary"
                    )}
                    style={{ width: colWidth }}
                  >
                    <div>
                      {scale === "days"
                        ? d.toLocaleDateString("en-US", { weekday: "narrow" })
                        : `Wk ${Math.ceil(d.getDate() / 7)}`}
                    </div>
                    <div className={cn("font-bold", isToday ? "text-primary" : "text-foreground")}>
                      {scale === "days" ? d.getDate() : d.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Timeline Rows */}
          <div className="divide-y divide-border/40 text-xs">
            {(tasks ?? []).map((task) => {
              const isMilestone = (task as any).isMilestone;
              const hasStart = !!task.startDateIso;
              const hasDue = !!task.dueDateIso;
              const isScheduled = hasStart || hasDue;

              let startMs: number;
              let endMs: number;

              if (hasStart && hasDue) {
                startMs = new Date(task.startDateIso!).getTime();
                endMs = new Date(task.dueDateIso!).getTime();
              } else if (hasDue) {
                endMs = new Date(task.dueDateIso!).getTime();
                startMs = endMs - MS_PER_DAY;
              } else if (hasStart) {
                startMs = new Date(task.startDateIso!).getTime();
                endMs = startMs + MS_PER_DAY;
              } else {
                // Fallback for unscheduled tasks: placed on today's column
                startMs = today.getTime();
                endMs = today.getTime() + MS_PER_DAY;
              }

              // Compute coordinates
              const offsetMs = startMs - timelineStartMs;
              const durationMs = Math.max(MS_PER_DAY, endMs - startMs);

              const leftPx = (offsetMs / msPerCol) * colWidth;
              const rawWidthPx = (durationMs / msPerCol) * colWidth;
              const widthPx = isMilestone ? 24 : Math.max(colWidth, rawWidthPx);

              return (
                <div
                  key={task.id}
                  className="flex items-center hover:bg-muted/20 relative group"
                  onClick={() => onTaskSelect(task.id)}
                >
                  {/* Sidebar Title */}
                  <div className="flex w-56 shrink-0 items-center justify-between border-r border-border p-2 font-medium bg-card group-hover:bg-muted/20 z-1">
                    <span className="truncate hover:underline cursor-pointer" title={task.name}>
                      {task.name}
                    </span>
                    <div className="flex items-center gap-1 shrink-0 ml-1">
                      {!isScheduled && (
                        <span className="text-[9px] text-muted-foreground bg-muted px-1 rounded" title="Unscheduled">
                          No date
                        </span>
                      )}
                      {isMilestone ? (
                        <DiamondIcon className="size-3.5 fill-amber-500 text-amber-500" />
                      ) : null}
                    </div>
                  </div>

                  {/* Gantt Bar Lane */}
                  <div className="relative flex items-center py-2 h-9" style={{ width: totalTimelineWidth }}>
                    {/* Grid Columns */}
                    <div className="flex h-full w-full pointer-events-none">
                      {dates.map((_, i) => (
                        <div
                          key={i}
                          className="h-full shrink-0 border-r border-border/20"
                          style={{ width: colWidth }}
                        />
                      ))}
                    </div>

                    {/* Today Line marker */}
                    {todayLeftPx !== null && (
                      <div
                        className="absolute top-0 bottom-0 w-[2px] bg-primary/40 pointer-events-none z-2"
                        style={{ left: `${todayLeftPx}px` }}
                      />
                    )}

                    {/* Timeline Bar */}
                    <div
                      className={cn(
                        "absolute h-6 rounded-md px-2 text-[10px] font-medium text-white flex items-center shadow-xs truncate cursor-pointer transition-all z-3",
                        isMilestone
                          ? "bg-amber-500 w-6 justify-center rounded-full"
                          : !isScheduled
                          ? "bg-muted text-muted-foreground border border-dashed border-border"
                          : task.priority?.toLowerCase() === "urgent"
                          ? "bg-rose-500 hover:bg-rose-600"
                          : task.priority?.toLowerCase() === "high"
                          ? "bg-amber-500 hover:bg-amber-600"
                          : "bg-primary hover:bg-primary/90"
                      )}
                      style={{
                        left: `${leftPx}px`,
                        width: `${widthPx}px`,
                        backgroundColor: isScheduled && task.statusColor ? task.statusColor : undefined,
                      }}
                      title={`${task.name} (${isScheduled ? (task.dueDate || "In progress") : "Unscheduled"})`}
                    >
                      {isMilestone ? (
                        <DiamondIcon className="size-3 text-white fill-white" />
                      ) : (
                        <span className="truncate">{task.name}</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </HomeDataState>
  );
}
