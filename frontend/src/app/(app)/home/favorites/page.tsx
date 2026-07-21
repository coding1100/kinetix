"use client";

import { useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/shared/PageHeader";
import { HomeDataState } from "@/components/home/HomeDataState";
import { EmptyState } from "@/components/shared/EmptyState";
import { deleteFavorite, fetchFavorites } from "@/lib/api/home";
import { useHomeQuery } from "@/hooks/use-home-query";
import { useWorkspaceApi } from "@/hooks/use-workspace-api";
import { Button } from "@/components/ui/button";
import { Trash2Icon } from "lucide-react";
import { toast } from "sonner";

export default function FavoritesPage() {
  const { accessToken, workspaceId, ready } = useWorkspaceApi();
  const { data: favorites, loading, error } = useHomeQuery((token, ws) =>
    fetchFavorites(token, ws).then((r) => r.data)
  );
  const [localFavorites, setLocalFavorites] = useState<
    { id: string; name: string; type: string; href: string }[] | null
  >(null);

  const list = localFavorites ?? favorites ?? [];

  async function handleDelete(id: string) {
    if (!ready || !accessToken || !workspaceId) return;
    try {
      await deleteFavorite(accessToken, workspaceId, id);
      setLocalFavorites(list.filter((f) => f.id !== id));
      toast.success("Removed from favorites");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not remove");
    }
  }

  if (!loading && !error && list.length === 0) {
    return (
      <>
        <PageHeader title="Favorites" />
        <EmptyState
          title="No favorites yet"
          description="Star a task from its detail drawer to pin it here."
        />
      </>
    );
  }

  return (
    <>
      <PageHeader title="Favorites" />
      <HomeDataState loading={loading} error={error}>
        <ul className="flex-1 overflow-y-auto p-4">
          {list.map((f) => (
            <li
              key={f.id}
              className="mb-2 flex items-center justify-between gap-2 rounded-lg border border-border bg-card px-4 py-3 hover:border-primary"
            >
              <Link href={f.href} className="min-w-0 flex-1">
                <p className="font-medium">{f.name}</p>
                <p className="text-xs text-muted-foreground">{f.type}</p>
              </Link>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Remove favorite"
                onClick={() => void handleDelete(f.id)}
              >
                <Trash2Icon className="size-4 text-muted-foreground" />
              </Button>
            </li>
          ))}
        </ul>
      </HomeDataState>
    </>
  );
}
