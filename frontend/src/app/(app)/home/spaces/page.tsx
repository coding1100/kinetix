"use client";

import Link from "next/link";
import { PageHeader } from "@/components/shared/PageHeader";
import { HomeDataState } from "@/components/home/HomeDataState";
import { fetchSpaces } from "@/lib/api/home";
import { useHomeQuery } from "@/hooks/use-home-query";

export default function AllSpacesPage() {
  const { data: spaces, loading, error } = useHomeQuery((token, ws) =>
    fetchSpaces(token, ws).then((r) => r.data)
  );

  return (
    <>
      <PageHeader title="All Spaces" />
      <HomeDataState
        loading={loading}
        error={error}
        empty={!loading && !error && spaces?.length === 0}
      >
        <div className="grid flex-1 gap-4 overflow-y-auto p-4 sm:grid-cols-2 lg:grid-cols-3">
          {spaces?.map((s) => (
            <Link
              key={s.id}
              href={`/home/spaces/${s.id}`}
              className="rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary"
            >
              <div
                className="mb-2 h-2 w-12 rounded"
                style={{ backgroundColor: s.color }}
              />
              <h3 className="font-semibold">{s.name}</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {s.memberCount} members · {s.listCount} lists
              </p>
              <p className="mt-3 text-xs text-primary">Open space →</p>
            </Link>
          ))}
        </div>
      </HomeDataState>
    </>
  );
}
