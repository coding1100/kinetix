"use client";

import { toast } from "sonner";
import { PageHeader } from "@/components/shared/PageHeader";
import { HomeDataState } from "@/components/home/HomeDataState";
import { fetchAssignedComments, resolveAssignedComment } from "@/lib/api/home";
import { useHomeQuery } from "@/hooks/use-home-query";
import { useWorkspaceApi } from "@/hooks/use-workspace-api";
import { ApiError } from "@/lib/api/client";

export default function AssignedCommentsPage() {
  const { accessToken, workspaceId, ready } = useWorkspaceApi();
  const { data: comments, loading, error } = useHomeQuery((token, ws) =>
    fetchAssignedComments(token, ws).then((r) => r.data)
  );

  const handleResolve = async (commentId: string) => {
    if (!ready) return;
    try {
      await resolveAssignedComment(accessToken, workspaceId, commentId);
      toast.success("Comment resolved");
      window.location.reload();
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Could not resolve comment"
      );
    }
  };

  return (
    <>
      <PageHeader title="Assigned Comments">
        <select className="rounded-lg border border-border px-2 py-1 text-sm">
          <option>All types</option>
          <option>Unresolved</option>
        </select>
      </PageHeader>
      <HomeDataState
        loading={loading}
        error={error}
        empty={!loading && !error && comments?.length === 0}
      >
        <ul className="flex-1 overflow-y-auto p-4">
          {comments?.map((c) => (
            <li
              key={c.id}
              className="group mb-2 rounded-lg border border-border bg-card px-4 py-3"
            >
              <p className="text-sm font-medium">{c.task}</p>
              <p className="text-sm text-muted-foreground">{c.comment}</p>
              <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                <span>{c.author}</span>
                <span>{c.due}</span>
              </div>
              <button
                type="button"
                className="mt-2 text-xs text-primary opacity-0 group-hover:opacity-100"
                onClick={() => handleResolve(c.id)}
              >
                Resolve
              </button>
            </li>
          ))}
        </ul>
      </HomeDataState>
    </>
  );
}
