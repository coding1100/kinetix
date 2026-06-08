"use client";

import { useEffect, useState } from "react";
import type { Task } from "@/lib/types/task";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { searchWorkspaceTasks, addTaskComment } from "@/lib/api/spaces";
import { useWorkspaceApi } from "@/hooks/use-workspace-api";
import { toast } from "sonner";

export function LinkTaskDialog({
  open,
  onOpenChange,
  messagePreview,
  chatHref,
  onLinked,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  messagePreview: string;
  chatHref: string;
  onLinked?: (task: Task) => void;
}) {
  const { accessToken, workspaceId, ready } = useWorkspaceApi();
  const [query, setQuery] = useState("");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const [linkingId, setLinkingId] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !ready || !accessToken || !workspaceId) return;
    const q = query.trim();
    if (q.length < 2) {
      setTasks([]);
      return;
    }
    const timer = setTimeout(() => {
      setLoading(true);
      searchWorkspaceTasks(accessToken, workspaceId, q)
        .then((r) => setTasks(r.data.slice(0, 12)))
        .catch(() => setTasks([]))
        .finally(() => setLoading(false));
    }, 300);
    return () => clearTimeout(timer);
  }, [open, query, ready, accessToken, workspaceId]);

  async function linkTask(task: Task) {
    if (!ready || !accessToken || !workspaceId) return;
    setLinkingId(task.id);
    try {
      const body = `Linked from chat:\n${messagePreview.slice(0, 500)}\n\n${chatHref}`;
      const updated = await addTaskComment(
        accessToken,
        workspaceId,
        task.id,
        body
      );
      toast.success(`Linked to “${task.name}”`);
      onLinked?.(updated);
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not link task");
    } finally {
      setLinkingId(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Link existing task</DialogTitle>
        </DialogHeader>
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search tasks by name…"
          autoFocus
        />
        <ul className="max-h-64 space-y-1 overflow-y-auto">
          {loading ? (
            <li className="py-4 text-center text-sm text-muted-foreground">
              Searching…
            </li>
          ) : query.trim().length < 2 ? (
            <li className="py-4 text-center text-sm text-muted-foreground">
              Type at least 2 characters
            </li>
          ) : tasks.length === 0 ? (
            <li className="py-4 text-center text-sm text-muted-foreground">
              No tasks found
            </li>
          ) : (
            tasks.map((t) => (
              <li key={t.id}>
                <Button
                  variant="ghost"
                  className="h-auto w-full justify-start py-2 text-left"
                  loading={linkingId === t.id}
                  onClick={() => void linkTask(t)}
                >
                  <span className="block truncate font-medium">{t.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {t.space} · {t.list}
                  </span>
                </Button>
              </li>
            ))
          )}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
