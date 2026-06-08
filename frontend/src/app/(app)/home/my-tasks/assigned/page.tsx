"use client";

import { PageHeader } from "@/components/shared/PageHeader";
import { TaskRow } from "@/components/shared/TaskRow";
import { HomeDataState } from "@/components/home/HomeDataState";
import { fetchTasks } from "@/lib/api/home";
import { useHomeQuery } from "@/hooks/use-home-query";

export default function AssignedToMePage() {
  const { data: tasks, loading, error } = useHomeQuery((token, ws) =>
    fetchTasks(token, ws, "assigned").then((r) => r.data)
  );

  return (
    <>
      <PageHeader title="Assigned to me" />
      <HomeDataState loading={loading} error={error}>
        <div className="flex-1 overflow-y-auto p-4">
          {tasks?.map((t) => (
            <TaskRow key={t.id} task={t} />
          ))}
        </div>
      </HomeDataState>
    </>
  );
}
