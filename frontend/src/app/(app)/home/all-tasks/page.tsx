"use client";

import { PageHeader } from "@/components/shared/PageHeader";
import { TaskRow } from "@/components/shared/TaskRow";
import { HomeDataState } from "@/components/home/HomeDataState";
import { fetchTasks } from "@/lib/api/home";
import { useHomeQuery } from "@/hooks/use-home-query";

export default function AllTasksPage() {
  const { data: tasks, loading, error } = useHomeQuery((token, ws) =>
    fetchTasks(token, ws).then((r) => r.data)
  );

  return (
    <>
      <PageHeader title="All Tasks">
        <button
          type="button"
          className="rounded-lg border border-border px-2 py-1 text-sm"
        >
          Filter
        </button>
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
