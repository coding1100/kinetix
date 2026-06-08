"use client";

import Link from "next/link";
import { PageHeader } from "@/components/shared/PageHeader";
import { HomeDataState } from "@/components/home/HomeDataState";
import { EmptyState } from "@/components/shared/EmptyState";
import { fetchFavorites } from "@/lib/api/home";
import { useHomeQuery } from "@/hooks/use-home-query";

export default function FavoritesPage() {
  const { data: favorites, loading, error } = useHomeQuery((token, ws) =>
    fetchFavorites(token, ws).then((r) => r.data)
  );

  if (!loading && !error && favorites?.length === 0) {
    return (
      <>
        <PageHeader title="Favorites" />
        <EmptyState
          title="No favorites yet"
          description="Pin items from Customize Home Sidebar"
        />
      </>
    );
  }

  return (
    <>
      <PageHeader title="Favorites" />
      <HomeDataState loading={loading} error={error}>
        <ul className="flex-1 overflow-y-auto p-4">
          {favorites?.map((f) => (
            <li key={f.id}>
              <Link
                href={f.href}
                className="mb-2 block rounded-lg border border-border bg-card px-4 py-3 hover:border-primary"
              >
                <p className="font-medium">{f.name}</p>
                <p className="text-xs text-muted-foreground">{f.type}</p>
              </Link>
            </li>
          ))}
        </ul>
      </HomeDataState>
    </>
  );
}
