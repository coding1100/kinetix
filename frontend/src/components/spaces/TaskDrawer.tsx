"use client";

import { useEffect, useState } from "react";
import type { Task } from "@/lib/types/task";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { fetchTask } from "@/lib/api/home";
import { patchTask } from "@/lib/api/spaces";
import { fetchWorkspaceMembers } from "@/lib/api/chat";
import { useWorkspaceApi } from "@/hooks/use-workspace-api";
import {
  TASK_STATUS_COLUMNS,
  taskStatusKeyFromLabel,
  taskStatusLabelFromKey,
  type TaskStatusKey,
} from "@/lib/task-status";
import { toast } from "sonner";

type Member = {
  id: string;
  fullName: string;
};

export function TaskDrawer({
  taskId,
  open,
  onOpenChange,
  onSaved,
}: {
  taskId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const { accessToken, workspaceId, ready } = useWorkspaceApi();
  const [task, setTask] = useState<Task | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("");
  const [statusKey, setStatusKey] = useState<TaskStatusKey>("TODO");
  const [dueInput, setDueInput] = useState("");
  const [description, setDescription] = useState("");
  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);

  useEffect(() => {
    if (!open || !taskId || !ready || !accessToken || !workspaceId) {
      setTask(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    Promise.all([
      fetchTask(accessToken, workspaceId, taskId),
      fetchWorkspaceMembers(accessToken, workspaceId),
    ])
      .then(([t, m]) => {
        if (cancelled) return;
        setTask(t);
        setMembers(m.data);
        setName(t.name);
        setStatusKey(
          (t.statusKey as TaskStatusKey) || taskStatusKeyFromLabel(t.status)
        );
        setDescription(t.description ?? "");
        setAssigneeIds(t.assigneeIds ?? []);
        setDueInput("");
      })
      .catch(() => {
        if (!cancelled) toast.error("Could not load task");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, taskId, ready, accessToken, workspaceId]);

  async function handleSave() {
    if (!taskId || !ready || !accessToken || !workspaceId) return;
    setSaving(true);
    try {
      const payload: Parameters<typeof patchTask>[3] = {
        name: name.trim(),
        status: statusKey,
        description,
        assigneeIds,
      };
      if (dueInput) {
        payload.dueDate = new Date(`${dueInput}T12:00:00.000Z`).toISOString();
      }
      const updated = await patchTask(
        accessToken,
        workspaceId,
        taskId,
        payload
      );
      setTask(updated);
      onSaved();
      toast.success("Task saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save task");
    } finally {
      setSaving(false);
    }
  }

  function toggleAssignee(userId: string) {
    setAssigneeIds((ids) =>
      ids.includes(userId) ? ids.filter((id) => id !== userId) : [...ids, userId]
    );
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full gap-0 p-0 sm:max-w-md">
        <SheetHeader className="border-b border-border px-4 py-3">
          <SheetTitle className="sr-only">Task details</SheetTitle>
          {task ? (
            <div className="flex items-center gap-2 pr-8">
              <Badge
                className="border-0 text-white"
                style={{ backgroundColor: task.statusColor }}
              >
                {taskStatusLabelFromKey(statusKey)}
              </Badge>
              <span className="truncate text-sm text-muted-foreground">
                {task.space} · {task.list}
              </span>
            </div>
          ) : null}
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : task ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="task-name">Name</Label>
                <Input
                  id="task-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={statusKey}
                  onValueChange={(v) => setStatusKey(v as TaskStatusKey)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TASK_STATUS_COLUMNS.map((col) => (
                      <SelectItem key={col.key} value={col.key}>
                        {col.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="task-due">Due date</Label>
                <Input
                  id="task-due"
                  type="date"
                  value={dueInput}
                  onChange={(e) => setDueInput(e.target.value)}
                  placeholder={task.dueDate ?? "Not set"}
                />
                {task.dueDate && !dueInput ? (
                  <p className="text-xs text-muted-foreground">
                    Current: {task.dueDate}
                  </p>
                ) : null}
              </div>
              <div className="space-y-2">
                <Label>Assignees</Label>
                <ul className="space-y-1 rounded-lg border border-border p-2">
                  {members.map((m) => (
                    <li key={m.id}>
                      <label className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted">
                        <input
                          type="checkbox"
                          checked={assigneeIds.includes(m.id)}
                          onChange={() => toggleAssignee(m.id)}
                          className="size-4 rounded border-border"
                        />
                        {m.fullName}
                      </label>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="space-y-2">
                <Label htmlFor="task-desc">Description</Label>
                <textarea
                  id="task-desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                  className="w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm"
                />
              </div>
              {(task.comments ?? []).length > 0 ? (
                <>
                  <Separator />
                  <div>
                    <p className="mb-2 text-sm font-semibold">Comments</p>
                    <ul className="space-y-2">
                      {task.comments!.map((c) => (
                        <li
                          key={c.id}
                          className="rounded-lg border border-border px-3 py-2 text-sm"
                        >
                          <p className="font-medium">{c.author}</p>
                          <p className="text-muted-foreground">{c.body}</p>
                        </li>
                      ))}
                    </ul>
                  </div>
                </>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="flex gap-2 border-t border-border p-4">
          <Button
            className="flex-1"
            disabled={!name.trim()}
            loading={saving}
            loadingText="Saving…"
            onClick={() => void handleSave()}
          >
            Save
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
