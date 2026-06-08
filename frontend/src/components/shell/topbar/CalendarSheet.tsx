"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { CalendarView } from "@/components/spaces/CalendarView";
import { Button } from "@/components/ui/button";
import { fetchReminders, fetchTasks } from "@/lib/api/home";
import { useTopBarStore } from "@/stores/topbar-store";
import { useWorkspaceApi } from "@/hooks/use-workspace-api";
import type { Task } from "@/lib/types/task";

function parseDue(task: Task): Date | null {
  if (!task.dueDateIso) return null;
  const d = new Date(task.dueDateIso);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function CalendarSheet() {
  const router = useRouter();
  const activeSheet = useTopBarStore((s) => s.activeSheet);
  const closeSheet = useTopBarStore((s) => s.closeSheet);
  const open = activeSheet === "calendar";
  const { accessToken, workspaceId, ready } = useWorkspaceApi();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [reminders, setReminders] = useState<{ id: string; title: string; due: string }[]>(
    []
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !ready || !accessToken || !workspaceId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([
      fetchTasks(accessToken, workspaceId),
      fetchReminders(accessToken, workspaceId),
    ])
      .then(([tasksRes, remindersRes]) => {
        if (!cancelled) {
          setTasks(tasksRes.data);
          setReminders(remindersRes.data);
        }
      })
      .catch(() => {
        if (!cancelled) setError("Failed to load calendar data");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, ready, accessToken, workspaceId]);

  const tasksWithDue = useMemo(
    () => tasks.filter((t) => parseDue(t) != null),
    [tasks]
  );

  return (
    <Sheet open={open} onOpenChange={(o) => !o && closeSheet()}>
      <SheetContent side="right" className="flex w-full flex-col sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Calendar</SheetTitle>
          <SheetDescription>
            Tasks with due dates and your reminders.
          </SheetDescription>
        </SheetHeader>
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto">
          <CalendarView
            tasks={tasksWithDue}
            loading={loading}
            error={error}
            onTaskSelect={(taskId) => {
              closeSheet();
              router.push(`/home/tasks/${taskId}`);
            }}
          />
          {reminders.length > 0 ? (
            <div className="shrink-0 border-t border-border pt-3">
              <p className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                Reminders
              </p>
              <ul className="space-y-1.5">
                {reminders.map((r) => (
                  <li
                    key={r.id}
                    className="rounded-md border border-border px-2 py-1.5 text-sm"
                  >
                    <span className="font-medium">{r.title}</span>
                    <span className="ml-2 text-xs text-muted-foreground">{r.due}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <Button
            variant="outline"
            size="sm"
            className="shrink-0"
            nativeButton={false}
            render={<Link href="/home/my-tasks/today" onClick={() => closeSheet()} />}
          >
            Open My Tasks — Today
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
