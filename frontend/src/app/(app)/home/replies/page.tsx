"use client";

import Link from "next/link";
import { PageHeader } from "@/components/shared/PageHeader";
import { HomeDataState } from "@/components/home/HomeDataState";
import { fetchReplies } from "@/lib/api/home";
import { useHomeQuery } from "@/hooks/use-home-query";

export default function RepliesPage() {
  const { data: replies, loading, error } = useHomeQuery((token, ws) =>
    fetchReplies(token, ws).then((r) => r.data)
  );

  return (
    <>
      <PageHeader title="Replies" />
      <HomeDataState
        loading={loading}
        error={error}
        empty={!loading && !error && replies?.length === 0}
      >
        <ul className="flex-1 overflow-y-auto p-4">
          {replies?.map((r) => (
            <li key={r.id}>
              <Link
                href={r.href}
                className="mb-2 flex rounded-lg border border-border bg-card px-4 py-3 hover:border-primary"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">#{r.channel}</p>
                  <p className="truncate text-sm text-muted-foreground">
                    {r.preview}
                  </p>
                </div>
                {r.unread && (
                  <span className="ml-2 size-2 shrink-0 self-center rounded-full bg-primary" />
                )}
              </Link>
            </li>
          ))}
        </ul>
      </HomeDataState>
    </>
  );
}
