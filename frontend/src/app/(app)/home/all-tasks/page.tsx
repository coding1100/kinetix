"use client";

import { useState } from "react";
import { PageHeader } from "@/components/shared/PageHeader";
import { TaskRow } from "@/components/shared/TaskRow";
import { HomeDataState } from "@/components/home/HomeDataState";
import { fetchTasks } from "@/lib/api/home";
import { useHomeQuery } from "@/hooks/use-home-query";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { ChevronDownIcon } from "lucide-react";

const TASK_FILTERS = [
  { value: "", label: "All tasks" },
  { value: "assigned", label: "Assigned to me" },
  { value: "personal", label: "Personal list" },
  { value: "today", label: "Due today" },
  { value: "overdue", label: "Overdue" },
] as const;

export default function AllTasksPage() {
  const [filter, setFilter] = useState("");
  const activeFilter = TASK_FILTERS.find((f) => f.value === filter) ?? TASK_FILTERS[0];

  const { data: tasks, loading, error } = useHomeQuery(
    (token, ws) =>
      fetchTasks(token, ws, filter || undefined).then((r) => r.data),
    [filter]
  );

  return (
    <>
      <PageHeader title="All Tasks">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button variant="outline" size="sm" className="gap-1">
                {activeFilter.label}
                <ChevronDownIcon className="size-3.5 opacity-60" />
              </Button>
            }
          />
          <DropdownMenuContent align="end">
            {TASK_FILTERS.map((f) => (
              <DropdownMenuItem
                key={f.value || "all"}
                onClick={() => setFilter(f.value)}
              >
                {f.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </PageHeader>
      <HomeDataState
        loading={loading}
        error={error}
        empty={!loading && !error && tasks?.length === 0}
      >
        <div className="grid grid-cols-[1fr_100px_120px_100px] gap-2 border-b border-border bg-muted px-4 py-2 text-xs font-semibold text-muted-foreground">
          <span>Name</span>
          <span>Status</span>
          <span>Due</span>
          <span>Assignee</span>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {tasks?.map((t) => (
            <TaskRow key={t.id} task={t} />
          ))}
        </div>
      </HomeDataState>
    </>
  );
}
