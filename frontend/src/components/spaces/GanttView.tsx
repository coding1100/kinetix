"use client";

import { useMemo, useState } from "react";
import { ChevronLeftIcon, ChevronRightIcon, DiamondIcon } from "lucide-react";
import type { Task } from "@/lib/types/task";
import { Button } from "@/components/ui/button";
import { HomeDataState } from "@/components/home/HomeDataState";
import { cn } from "@/lib/utils";

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

  // Timeline date bounds
  const dates = useMemo(() => {
    const arr: Date[] = [];
    const today = new Date();
    const start = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 7);
    for (let i = 0; i < 28; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      arr.push(d);
    }
    return arr;
  }, []);

  return (
    <HomeDataState loading={loading} error={error} empty={!tasks || tasks.length === 0}>
      <div className="flex flex-1 flex-col overflow-hidden p-4">
        {/* Controls */}
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold">Gantt Timeline</h2>
            <span className="rounded bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
              {tasks?.length ?? 0} tasks
            </span>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant={scale === "days" ? "default" : "outline"}
              size="xs"
              onClick={() => setScale("days")}
            >
              Days
            </Button>
            <Button
              variant={scale === "weeks" ? "default" : "outline"}
              size="xs"
              onClick={() => setScale("weeks")}
            >
              Weeks
            </Button>
          </div>
        </div>

        {/* Gantt Table Grid */}
        <div className="flex flex-1 flex-col overflow-auto rounded-lg border border-border bg-card">
          {/* Timeline Header */}
          <div className="flex border-b border-border bg-muted/50 text-xs font-semibold text-muted-foreground">
            <div className="w-56 shrink-0 border-r border-border p-2">Task Name</div>
            <div className="flex flex-1">
              {dates.map((d, idx) => (
                <div
                  key={idx}
                  className="w-10 shrink-0 border-r border-border/40 p-1 text-center text-[10px]"
                >
                  <div>{d.toLocaleDateString("en-US", { weekday: "narrow" })}</div>
                  <div className="font-bold text-foreground">{d.getDate()}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Timeline Rows */}
          <div className="divide-y divide-border/40 text-xs">
            {(tasks ?? []).map((task) => {
              const start = task.dueDateIso ? new Date(task.dueDateIso) : new Date();
              const isMilestone = (task as any).isMilestone;

              return (
                <div
                  key={task.id}
                  className="flex items-center hover:bg-muted/20"
                  onClick={() => onTaskSelect(task.id)}
                >
                  {/* Sidebar Title */}
                  <div className="flex w-56 shrink-0 items-center justify-between border-r border-border p-2 font-medium">
                    <span className="truncate hover:underline cursor-pointer">{task.name}</span>
                    {isMilestone ? (
                      <DiamondIcon className="size-3.5 fill-amber-500 text-amber-500 shrink-0 ml-1" />
                    ) : null}
                  </div>

                  {/* Gantt Bar Lane */}
                  <div className="relative flex flex-1 items-center py-2">
                    <div className="flex w-full">
                      {dates.map((_, i) => (
                        <div key={i} className="h-6 w-10 shrink-0 border-r border-border/20" />
                      ))}
                    </div>

                    {/* Timeline Bar */}
                    <div
                      className={cn(
                        "absolute h-5 rounded-md px-2 text-[10px] font-medium text-white flex items-center shadow-xs truncate cursor-pointer transition-all",
                        isMilestone
                          ? "bg-amber-500 w-6 justify-center rounded-full"
                          : task.priority?.toLowerCase() === "urgent"
                          ? "bg-rose-500"
                          : "bg-primary"
                      )}
                      style={{ left: `${Math.max(10, (task.name.length * 7) % 600)}px`, width: isMilestone ? "24px" : "140px" }}
                    >
                      {isMilestone ? <DiamondIcon className="size-3 text-white fill-white" /> : task.name}
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
