"use client";

import { useMemo, useState } from "react";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import type { Task } from "@/lib/types/task";
import { HomeDataState } from "@/components/home/HomeDataState";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function addMonths(d: Date, n: number) {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}

function sameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function parseTaskDue(task: Task): Date | null {
  if (!task.dueDateIso) return null;
  const d = new Date(task.dueDateIso);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function CalendarView({
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
  const [cursor, setCursor] = useState(() => startOfMonth(new Date()));
  const today = useMemo(() => new Date(), []);

  const tasksByDay = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const task of tasks ?? []) {
      const due = parseTaskDue(task);
      if (!due) continue;
      const key = `${due.getFullYear()}-${due.getMonth()}-${due.getDate()}`;
      const list = map.get(key) ?? [];
      list.push(task);
      map.set(key, list);
    }
    return map;
  }, [tasks]);

  const grid = useMemo(() => {
    const year = cursor.getFullYear();
    const month = cursor.getMonth();
    const first = new Date(year, month, 1);
    const startPad = first.getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: { date: Date; inMonth: boolean }[] = [];
    for (let i = 0; i < startPad; i++) {
      const d = new Date(year, month, -(startPad - 1 - i));
      cells.push({ date: d, inMonth: false });
    }
    for (let day = 1; day <= daysInMonth; day++) {
      cells.push({ date: new Date(year, month, day), inMonth: true });
    }
    while (cells.length % 7 !== 0) {
      const last = cells[cells.length - 1].date;
      cells.push({
        date: new Date(last.getFullYear(), last.getMonth(), last.getDate() + 1),
        inMonth: false,
      });
    }
    return cells;
  }, [cursor]);

  const monthLabel = cursor.toLocaleString(undefined, {
    month: "long",
    year: "numeric",
  });

  return (
    <HomeDataState
      loading={loading}
      error={error}
      empty={false}
    >
      <div className="flex min-h-0 flex-1 flex-col p-4">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold">{monthLabel}</h2>
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="icon-sm"
              onClick={() => setCursor((c) => addMonths(c, -1))}
              aria-label="Previous month"
            >
              <ChevronLeftIcon className="size-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCursor(startOfMonth(new Date()))}
            >
              Today
            </Button>
            <Button
              variant="outline"
              size="icon-sm"
              onClick={() => setCursor((c) => addMonths(c, 1))}
              aria-label="Next month"
            >
              <ChevronRightIcon className="size-4" />
            </Button>
          </div>
        </div>
        <div className="grid grid-cols-7 gap-px rounded-lg border border-border bg-border text-xs">
          {WEEKDAYS.map((w) => (
            <div
              key={w}
              className="bg-muted px-2 py-1.5 text-center font-semibold text-muted-foreground"
            >
              {w}
            </div>
          ))}
          {grid.map(({ date, inMonth }) => {
            const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
            const dayTasks = tasksByDay.get(key) ?? [];
            const isToday = sameDay(date, today);
            return (
              <div
                key={key}
                className={cn(
                  "min-h-[88px] bg-card p-1",
                  !inMonth && "bg-muted/40 text-muted-foreground"
                )}
              >
                <span
                  className={cn(
                    "inline-flex size-6 items-center justify-center rounded-full text-[11px]",
                    isToday && "bg-primary font-semibold text-primary-foreground"
                  )}
                >
                  {date.getDate()}
                </span>
                <ul className="mt-0.5 space-y-0.5">
                  {dayTasks.slice(0, 3).map((t) => (
                    <li key={t.id}>
                      <button
                        type="button"
                        onClick={() => onTaskSelect(t.id)}
                        className="w-full truncate rounded px-1 py-0.5 text-left text-[10px] hover:bg-primary/10"
                        title={t.name}
                      >
                        {t.name}
                      </button>
                    </li>
                  ))}
                  {dayTasks.length > 3 ? (
                    <li className="px-1 text-[10px] text-muted-foreground">
                      +{dayTasks.length - 3} more
                    </li>
                  ) : null}
                </ul>
              </div>
            );
          })}
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Tasks with a due date appear on the calendar. Set due dates in the task drawer.
        </p>
      </div>
    </HomeDataState>
  );
}
