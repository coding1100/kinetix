"use client";

import { PageHeader } from "@/components/shared/PageHeader";
import { HomeDataState } from "@/components/home/HomeDataState";
import { fetchReminders } from "@/lib/api/home";
import { useHomeQuery } from "@/hooks/use-home-query";

export default function RemindersPage() {
  const { data: reminders, loading, error } = useHomeQuery((token, ws) =>
    fetchReminders(token, ws).then((r) => r.data)
  );

  return (
    <>
      <PageHeader title="Reminders" />
      <HomeDataState loading={loading} error={error}>
        <ul className="flex-1 overflow-y-auto p-4">
          {reminders?.map((r) => (
            <li
              key={r.id}
              className="mb-2 rounded-lg border border-border bg-card px-4 py-3 text-sm"
            >
              <p className="font-medium">{r.title}</p>
              <p className="text-xs text-muted-foreground">{r.due}</p>
            </li>
          ))}
        </ul>
      </HomeDataState>
    </>
  );
}
