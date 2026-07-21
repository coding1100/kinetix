"use client";

import { Suspense, useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  CalendarIcon,
  FilterIcon,
  LayoutGridIcon,
  SearchIcon,
  SlidersHorizontalIcon,
  SquareCheckBigIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { HomeDataState } from "@/components/home/HomeDataState";
import {
  MyTasksGroupedList,
  myTasksStatusFilterOptions,
} from "@/components/home/MyTasksGroupedList";
import { TaskDrawer } from "@/components/spaces/TaskDrawer";
import { fetchRecents, fetchTasks } from "@/lib/api/home";
import { useHomeQuery } from "@/hooks/use-home-query";
import { useAuthStore } from "@/stores/auth-store";
import { useUiStore } from "@/stores/ui-store";

function greetingForUser(fullName?: string | null) {
  const hour = new Date().getHours();
  const period =
    hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening";
  const first = fullName?.trim().split(/\s+/)[0] ?? "there";
  return `Good ${period}, ${first}`;
}

function MyTasksDashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const openModal = useUiStore((s) => s.openModal);
  const user = useAuthStore((s) => s.user);
  const [statusFilter, setStatusFilter] = useState("all");
  const [refreshKey, setRefreshKey] = useState(0);
  const selectedTaskId = searchParams.get("task");

  const {
    data: tasks,
    loading: tasksLoading,
    error: tasksError,
  } = useHomeQuery(
    (token, ws) => fetchTasks(token, ws, "assigned").then((r) => r.data),
    [refreshKey]
  );

  const { data: recents, loading: recentsLoading } = useHomeQuery(
    (token, ws) => fetchRecents(token, ws).then((r) => r.data)
  );

  const statusOptions = useMemo(
    () => myTasksStatusFilterOptions(tasks ?? undefined),
    [tasks]
  );

  const openTask = useCallback(
    (taskId: string) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("task", taskId);
      router.replace(`/home/my-tasks?${params.toString()}`);
    },
    [router, searchParams]
  );

  const closeTask = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("task");
    const q = params.toString();
    router.replace(`/home/my-tasks${q ? `?${q}` : ""}`);
  }, [router, searchParams]);

  return (
    <>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="shrink-0 border-b border-border px-6 py-4">
          <div className="flex items-center justify-between gap-4">
            <h1 className="text-lg font-semibold tracking-tight">My Tasks</h1>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => openModal("customize-home")}
            >
              Manage cards
            </Button>
          </div>
          <p className="mt-4 text-2xl font-semibold tracking-tight">
            {greetingForUser(user?.fullName)}
          </p>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          <section className="mb-8">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-sm font-semibold">Assigned to me</h2>
              <div className="flex items-center gap-0.5">
                <Select
                  value={statusFilter}
                  onValueChange={(v) => setStatusFilter(v ?? "all")}
                >
                  <SelectTrigger className="mr-2 h-8 w-[130px] gap-2 text-xs font-medium">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Status</SelectItem>
                    {statusOptions.map((option) => (
                      <SelectItem key={option.id} value={option.id}>
                        {option.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Button variant="ghost" size="icon-sm" aria-label="Filter">
                        <FilterIcon className="size-4" />
                      </Button>
                    }
                  />
                  <TooltipContent side="bottom">Filter</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Button variant="ghost" size="icon-sm" aria-label="Group">
                        <LayoutGridIcon className="size-4" />
                      </Button>
                    }
                  />
                  <TooltipContent side="bottom">Group</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Button variant="ghost" size="icon-sm" aria-label="Search">
                        <SearchIcon className="size-4" />
                      </Button>
                    }
                  />
                  <TooltipContent side="bottom">Search</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Button variant="ghost" size="icon-sm" aria-label="Display">
                        <SlidersHorizontalIcon className="size-4" />
                      </Button>
                    }
                  />
                  <TooltipContent side="bottom">Display</TooltipContent>
                </Tooltip>
              </div>
            </div>

            <MyTasksGroupedList
              tasks={tasks ?? undefined}
              loading={tasksLoading}
              error={tasksError}
              statusFilter={statusFilter}
              onTaskSelect={openTask}
              onAddTask={() => openModal("create-task")}
            />
          </section>

          <div className="grid gap-4 lg:grid-cols-2">
            <section className="rounded-xl border border-border bg-card p-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold">Recents</h2>
                <Link
                  href="/home/my-tasks/recents"
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  View all
                </Link>
              </div>
              <HomeDataState
                loading={recentsLoading}
                error={null}
                empty={!recentsLoading && (recents?.length ?? 0) === 0}
                emptyMessage="Recently opened tasks will appear here."
              >
                <ul className="space-y-1">
                  {recents?.slice(0, 6).map((item) => (
                    <li key={item.id}>
                      <Link
                        href={item.href}
                        className="flex items-start gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-muted/50"
                      >
                        <SquareCheckBigIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">
                            {item.name}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {item.space || "Workspace"}
                          </p>
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              </HomeDataState>
            </section>

            <section className="rounded-xl border border-border bg-card p-4 shadow-sm">
              <h2 className="mb-3 text-sm font-semibold">Agenda</h2>
              <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-muted/20 px-4 py-10 text-center">
                <CalendarIcon className="mb-3 size-8 text-muted-foreground/60" />
                <p className="text-sm font-medium">Connect your calendar</p>
                <p className="mt-1 max-w-xs text-xs text-muted-foreground">
                  View upcoming events and join your next call from My Tasks.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-4"
                  nativeButton={false}
                  render={<Link href="/home/my-tasks/today" />}
                >
                  View Today &amp; Overdue
                </Button>
              </div>
            </section>
          </div>
        </div>
      </div>

      <TaskDrawer
        taskId={selectedTaskId}
        open={!!selectedTaskId}
        onOpenChange={(open) => {
          if (!open) closeTask();
        }}
        onSaved={() => setRefreshKey((k) => k + 1)}
        onDeleted={closeTask}
        onTaskNavigate={openTask}
      />
    </>
  );
}

export function MyTasksDashboard() {
  return (
    <Suspense fallback={null}>
      <MyTasksDashboardContent />
    </Suspense>
  );
}
