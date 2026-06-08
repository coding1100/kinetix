"use client";

import Link from "next/link";
import { ArrowLeftIcon } from "lucide-react";
import type { Task } from "@/lib/types/task";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

export function TaskDetailView({
  task,
}: {
  task: Task;
}) {
  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <Button
          variant="ghost"
          size="icon-sm"
          nativeButton={false}
          render={<Link href="/home/all-tasks" aria-label="Back to tasks" />}
        >
          <ArrowLeftIcon className="size-4" />
        </Button>
        <Badge
          className="border-0 text-white"
          style={{ backgroundColor: task.statusColor }}
        >
          {task.status}
        </Badge>
        <h1 className="min-w-0 flex-1 truncate text-lg font-semibold">
          {task.name}
        </h1>
      </div>
      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-2xl space-y-6">
          <div className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <p className="text-xs text-muted-foreground">Space</p>
              <p className="font-medium">{task.space}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">List</p>
              <p className="font-medium">{task.list}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Assignees</p>
              <p className="font-medium">{task.assignees.join(", ")}</p>
            </div>
            {task.dueDate ? (
              <div>
                <p className="text-xs text-muted-foreground">Due date</p>
                <p
                  className={cn(
                    "font-medium",
                    task.overdue && "text-destructive"
                  )}
                >
                  {task.dueDate}
                </p>
              </div>
            ) : null}
          </div>
          <Separator />
          <section>
            <h2 className="mb-2 text-sm font-semibold">Description</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {task.description ??
                "No description yet. Add details for this task in your workspace."}
            </p>
          </section>
          <section>
            <h2 className="mb-3 text-sm font-semibold">Activity</h2>
            <ul className="space-y-3">
              {(task.comments ?? []).map((c) => (
                <li
                  key={c.id}
                  className="rounded-lg border border-border bg-card px-4 py-3"
                >
                  <p className="text-sm font-medium">{c.author}</p>
                  <p className="mt-1 text-sm">{c.body}</p>
                  <p className="mt-2 text-xs text-muted-foreground">{c.at}</p>
                </li>
              ))}
              {(task.comments ?? []).length === 0 ? (
                <li className="text-sm text-muted-foreground">
                  No comments yet.
                </li>
              ) : null}
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
