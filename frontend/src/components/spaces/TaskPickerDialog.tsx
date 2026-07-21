"use client";

import { useEffect, useMemo, useState } from "react";
import { SearchIcon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { fetchTasks } from "@/lib/api/home";
import type { Task } from "@/lib/types/task";
import { useWorkspaceApi } from "@/hooks/use-workspace-api";
import { cn } from "@/lib/utils";

export function TaskPickerDialog({
  open,
  onOpenChange,
  title,
  excludeTaskIds = [],
  onSelect,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  excludeTaskIds?: string[];
  onSelect: (task: Task) => void;
}) {
  const { accessToken, workspaceId, ready } = useWorkspaceApi();
  const [search, setSearch] = useState("");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) {
      setSearch("");
      setTasks([]);
      return;
    }
    if (!ready || !accessToken || !workspaceId) return;
    let cancelled = false;
    setLoading(true);
    const timer = setTimeout(() => {
      fetchTasks(accessToken, workspaceId, undefined, search)
        .then((res) => {
          if (!cancelled) setTasks(res.data);
        })
        .catch(() => {
          if (!cancelled) setTasks([]);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [open, ready, accessToken, workspaceId, search]);

  const visibleTasks = useMemo(
    () => tasks.filter((t) => !excludeTaskIds.includes(t.id)).slice(0, 20),
    [tasks, excludeTaskIds]
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tasks…"
            className="h-9 pl-8"
            autoFocus
          />
        </div>
        <p className="pt-1 text-xs font-semibold text-muted-foreground">
          {search.trim() ? "Results" : "Recent"}
        </p>
        <ul className="max-h-72 space-y-0.5 overflow-y-auto">
          {loading ? (
            <li className="px-2 py-4 text-center text-xs text-muted-foreground">
              Searching…
            </li>
          ) : visibleTasks.length === 0 ? (
            <li className="px-2 py-4 text-center text-xs text-muted-foreground">
              No tasks found
            </li>
          ) : (
            visibleTasks.map((task) => (
              <li key={task.id}>
                <button
                  type="button"
                  className={cn(
                    "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted"
                  )}
                  onClick={() => {
                    onSelect(task);
                    onOpenChange(false);
                  }}
                >
                  <span
                    className="size-2 shrink-0 rounded-full"
                    style={{ backgroundColor: task.statusColor }}
                  />
                  <span className="min-w-0 flex-1 truncate">{task.name}</span>
                  <span className="shrink-0 truncate text-xs text-muted-foreground">
                    {task.list}
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
