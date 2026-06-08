"use client";

import { PageHeader } from "@/components/shared/PageHeader";
import { HomeDataState } from "@/components/home/HomeDataState";
import { fetchPosts } from "@/lib/api/home";
import { useHomeQuery } from "@/hooks/use-home-query";
import { NewPostButton } from "./NewPostButton";

export default function PostsPage() {
  const { data: posts, loading, error } = useHomeQuery((token, ws) =>
    fetchPosts(token, ws).then((r) => r.data)
  );

  return (
    <>
      <PageHeader title="Posts">
        <NewPostButton />
      </PageHeader>
      <HomeDataState
        loading={loading}
        error={error}
        empty={!loading && !error && posts?.length === 0}
      >
        <ul className="flex-1 overflow-y-auto p-4">
          {posts?.map((p) => (
            <li
              key={p.id}
              className="mb-3 rounded-lg border border-border bg-card p-4"
            >
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">{p.author}</span>
                <span className="text-muted-foreground">#{p.channel}</span>
              </div>
              <p className="mt-2 text-sm">{p.content}</p>
              <p className="mt-2 text-xs text-muted-foreground">
                {p.reactions} reactions
              </p>
            </li>
          ))}
        </ul>
      </HomeDataState>
    </>
  );
}
