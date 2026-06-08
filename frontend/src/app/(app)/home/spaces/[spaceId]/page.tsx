"use client";

import Link from "next/link";
import { use } from "react";
import {
  ChevronRightIcon,
  FolderIcon,
  LayoutListIcon,
} from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { HomeDataState } from "@/components/home/HomeDataState";
import { fetchSpace } from "@/lib/api/home";
import { useHomeQuery } from "@/hooks/use-home-query";

export default function SpaceDetailPage({
  params,
}: {
  params: Promise<{ spaceId: string }>;
}) {
  const { spaceId } = use(params);
  const { data: space, loading, error } = useHomeQuery(
    (token, ws) => fetchSpace(token, ws, spaceId),
    [spaceId]
  );

  return (
    <>
      <PageHeader title={space?.name ?? "Space"}>
        <Button
          variant="outline"
          size="sm"
          nativeButton={false}
          render={<Link href="/home/spaces" />}
        >
          All spaces
        </Button>
      </PageHeader>
      <HomeDataState loading={loading} error={error} empty={!space && !loading}>
        {space ? (
          <div className="flex-1 overflow-y-auto p-6">
            <div
              className="mb-4 h-1 w-16 rounded"
              style={{ backgroundColor: space.color }}
            />
            {space.description ? (
              <p className="mb-6 max-w-xl text-sm text-muted-foreground">
                {space.description}
              </p>
            ) : null}
            <p className="mb-4 text-xs text-muted-foreground">
              {space.memberCount} members · {space.listCount} lists
            </p>

            {space.folders?.map((folder) => (
              <section key={folder.id} className="mb-8">
                <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
                  <FolderIcon className="size-4 text-muted-foreground" />
                  {folder.name}
                </div>
                <ul className="space-y-1 border-l border-border pl-4">
                  {folder.lists.map((list) => (
                    <li key={list.id}>
                      <Link
                        href={`/spaces/l/${list.id}`}
                        className="flex items-center justify-between rounded-lg px-3 py-2 hover:bg-muted/50"
                      >
                        <span className="flex items-center gap-2 text-sm">
                          <LayoutListIcon className="size-4 text-muted-foreground" />
                          {list.name}
                        </span>
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          {list.taskCount} tasks
                          <ChevronRightIcon className="size-3.5" />
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ))}

            {space.standaloneLists && space.standaloneLists.length > 0 ? (
              <section>
                <p className="mb-2 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                  Lists
                </p>
                <ul className="space-y-1">
                  {space.standaloneLists.map((list) => (
                    <li key={list.id}>
                      <Link
                        href={`/spaces/l/${list.id}`}
                        className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3 hover:border-primary"
                      >
                        <span className="flex items-center gap-2 text-sm font-medium">
                          <LayoutListIcon className="size-4 text-muted-foreground" />
                          {list.name}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {list.taskCount} tasks
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </div>
        ) : null}
      </HomeDataState>
    </>
  );
}
