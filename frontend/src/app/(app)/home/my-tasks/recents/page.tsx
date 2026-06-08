"use client";

import Link from "next/link";
import { PageHeader } from "@/components/shared/PageHeader";
import { HomeDataState } from "@/components/home/HomeDataState";
import { fetchRecents } from "@/lib/api/home";
import { useHomeQuery } from "@/hooks/use-home-query";

export default function RecentsPage() {
  const { data: recents, loading, error } = useHomeQuery((token, ws) =>
    fetchRecents(token, ws).then((r) => r.data)
  );

  return (
    <>
      <PageHeader title="Recents" />
      <HomeDataState loading={loading} error={error}>
        <ul className="flex-1 overflow-y-auto p-4">
          {recents?.map((r) => (
            <li key={r.id}>
              <Link
                href={r.href}
                className="mb-2 block rounded-lg border border-border bg-card px-4 py-3 hover:border-primary"
              >
                <p className="font-medium">{r.name}</p>
                <p className="text-xs text-muted-foreground">
                  {r.type} · {r.space}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      </HomeDataState>
    </>
  );
}
