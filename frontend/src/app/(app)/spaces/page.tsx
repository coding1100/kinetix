"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PageLoader } from "@/components/ui/page-loader";
import { fetchSpacesTree, firstListIdFromSpaces } from "@/lib/api/spaces";
import { useHomeQuery } from "@/hooks/use-home-query";
import { EmptySpacesState } from "@/components/spaces/EmptySpacesState";
import {
  SpacesHierarchyDialog,
  type HierarchyDialogMode,
} from "@/components/spaces/SpacesHierarchyDialog";
import { useSpacesStore } from "@/stores/spaces-store";

export default function SpacesIndexPage() {
  const router = useRouter();
  const refreshKey = useSpacesStore((s) => s.refreshKey);
  const [dialogMode, setDialogMode] = useState<HierarchyDialogMode | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const query = useHomeQuery(
    (token, ws) => fetchSpacesTree(token, ws).then((r) => r.data),
    [refreshKey]
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
    const firstSpace = query.data[0];

    return (
      <>
        <EmptySpacesState
          title="No lists available in workspace"
          description="Create your first space, folder, or list to start managing work."
          onCreateSpace={() => {
            setDialogMode({ type: "space" });
            setDialogOpen(true);
          }}
          onCreateFolder={
            firstSpace
              ? () => {
                  setDialogMode({ type: "folder", spaceId: firstSpace.id });
                  setDialogOpen(true);
                }
              : undefined
          }
          onCreateList={
            firstSpace
              ? () => {
                  setDialogMode({ type: "list", spaceId: firstSpace.id });
                  setDialogOpen(true);
                }
              : undefined
          }
        />

        <SpacesHierarchyDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          mode={dialogMode}
        />
      </>
    );
  }

  return <PageLoader label="Opening spaces…" />;
}

