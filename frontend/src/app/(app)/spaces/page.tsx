"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { PageLoader } from "@/components/ui/page-loader";
import { fetchSpacesTree, firstListIdFromSpaces } from "@/lib/api/spaces";
import { useHomeQuery } from "@/hooks/use-home-query";

export default function SpacesIndexPage() {
  const router = useRouter();
  const query = useHomeQuery((token, ws) =>
    fetchSpacesTree(token, ws).then((r) => r.data)
  );

  useEffect(() => {
    if (query.loading || query.error || !query.data) return;
    const listId = firstListIdFromSpaces(query.data);
    if (listId) {
      router.replace(`/spaces/l/${listId}`);
    }
  }, [query.loading, query.error, query.data, router]);

  if (query.error) {
    return (
      <div className="flex flex-1 items-center justify-center p-6 text-sm text-destructive">
        {query.error}
      </div>
    );
  }

  if (!query.loading && query.data && !firstListIdFromSpaces(query.data)) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center">
        <p className="text-sm font-medium">No lists in this workspace</p>
        <p className="text-sm text-muted-foreground">
          Seed the database or create a space and list to get started.
        </p>
      </div>
    );
  }

  return <PageLoader label="Opening spaces…" />;
}
