"use client";

import { useEffect, useState } from "react";
import type { ListStatus, Task } from "@/lib/types/task";
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
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import {
  fetchTask,
  addToLineup,
  createFavorite,
  recordTaskRecent,
  removeFromLineup,
} from "@/lib/api/home";
import {
  addTaskComment,
  deleteTask,
  fetchListMeta,
  fetchSpacesTree,
  flattenListsFromSpaces,
  followTask,
  patchTask,
  unfollowTask,
} from "@/lib/api/spaces";
import { fetchWorkspaceMembers } from "@/lib/api/chat";
import { useWorkspaceApi } from "@/hooks/use-workspace-api";
import {
  TASK_STATUS_COLUMNS,
  taskStatusKeyFromLabel,
  taskStatusLabelFromKey,
  type TaskStatusKey,
} from "@/lib/task-status";
import {
  TASK_PRIORITIES,
  type TaskPriority,
} from "@/lib/task-priority";
import { toast } from "sonner";

type Member = {
  id: string;
  fullName: string;
};

const NO_PRIORITY = "__none__";

export function TaskDrawer({
  taskId,
  open,
  onOpenChange,
  onSaved,
  onDeleted,
}: {
  taskId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
  onDeleted?: () => void;
}) {
  const { accessToken, workspaceId, ready } = useWorkspaceApi();
  const [task, setTask] = useState<Task | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [commentBody, setCommentBody] = useState("");
  const [commenting, setCommenting] = useState(false);
  const [inLineup, setInLineup] = useState(false);
  const [lineupBusy, setLineupBusy] = useState(false);
  const [favoriteBusy, setFavoriteBusy] = useState(false);
  const [following, setFollowing] = useState(false);
  const [followBusy, setFollowBusy] = useState(false);
  const [listStatuses, setListStatuses] = useState<ListStatus[]>([]);

  const [name, setName] = useState("");
  const [statusId, setStatusId] = useState("");
  const [statusKey, setStatusKey] = useState<TaskStatusKey>("TODO");
  const [priority, setPriority] = useState<TaskPriority | typeof NO_PRIORITY>(
    NO_PRIORITY
  );
  const [dueInput, setDueInput] = useState("");
  const [description, setDescription] = useState("");
  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);
  const [listId, setListId] = useState("");
  const [listOptions, setListOptions] = useState<{ id: string; label: string }[]>(
    []
  );

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
      fetchSpacesTree(accessToken, workspaceId),
    ])
      .then(async ([t, m, spacesRes]) => {
        if (cancelled) return;
        setMembers(m.data);
        setListOptions(flattenListsFromSpaces(spacesRes.data));
        setTask(t);
        setName(t.name);
        setStatusKey(
          (t.statusKey as TaskStatusKey) || taskStatusKeyFromLabel(t.status)
        );
        setStatusId(t.statusId ?? "");
        setPriority(t.priority ?? NO_PRIORITY);
        setDescription(t.description ?? "");
        setAssigneeIds(t.assigneeIds ?? []);
        setListId(t.listId ?? "");
        setDueInput(t.dueDateIso ? t.dueDateIso.slice(0, 10) : "");
        setCommentBody("");
        setInLineup(Boolean(t.inLineup));
        setFollowing(Boolean(t.isFollowing));
        if (t.listId) {
          try {
            const meta = await fetchListMeta(accessToken, workspaceId, t.listId);
            if (!cancelled) setListStatuses(meta.statuses ?? []);
          } catch {
            if (!cancelled) setListStatuses([]);
          }
        } else {
          setListStatuses([]);
        }
        void recordTaskRecent(accessToken, workspaceId, t).catch(() => {});
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
        description,
        assigneeIds,
        priority: priority === NO_PRIORITY ? null : priority,
      };
      if (listStatuses.length > 0 && statusId) {
        payload.statusId = statusId;
      } else {
        payload.status = statusKey;
      }
      if (listId && listId !== task?.listId) {
        payload.listId = listId;
      }
      if (dueInput) {
        payload.dueDate = new Date(`${dueInput}T12:00:00.000Z`).toISOString();
      } else if (task?.dueDateIso) {
        payload.dueDate = "";
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

  async function handleAddComment() {
    const body = commentBody.trim();
    if (!taskId || !body || !ready || !accessToken || !workspaceId) return;
    setCommenting(true);
    try {
      const updated = await addTaskComment(
        accessToken,
        workspaceId,
        taskId,
        body
      );
      setTask(updated);
      setCommentBody("");
      onSaved();
      toast.success("Comment added");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not add comment");
    } finally {
      setCommenting(false);
    }
  }

  async function handleDelete() {
    if (!taskId || !ready || !accessToken || !workspaceId) return;
    setDeleting(true);
    try {
      await deleteTask(accessToken, workspaceId, taskId);
      setDeleteOpen(false);
      onOpenChange(false);
      onDeleted?.();
      onSaved();
      toast.success("Task deleted");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete task");
    } finally {
      setDeleting(false);
    }
  }

  function toggleAssignee(userId: string) {
    setAssigneeIds((ids) =>
      ids.includes(userId) ? ids.filter((id) => id !== userId) : [...ids, userId]
    );
  }

  async function handleToggleLineup() {
    if (!taskId || !ready || !accessToken || !workspaceId) return;
    setLineupBusy(true);
    try {
      if (inLineup) {
        await removeFromLineup(accessToken, workspaceId, taskId);
        setInLineup(false);
        toast.success("Removed from LineUp");
      } else {
        await addToLineup(accessToken, workspaceId, taskId);
        setInLineup(true);
        toast.success("Added to LineUp");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update LineUp");
    } finally {
      setLineupBusy(false);
    }
  }

  async function handleFavorite() {
    if (!task || !ready || !accessToken || !workspaceId) return;
    setFavoriteBusy(true);
    try {
      await createFavorite(accessToken, workspaceId, {
        name: task.name,
        itemType: "task",
        href: `/home/tasks/${task.id}`,
      });
      toast.success("Added to favorites");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not favorite");
    } finally {
      setFavoriteBusy(false);
    }
  }

  async function handleToggleFollow() {
    if (!taskId || !ready || !accessToken || !workspaceId) return;
    setFollowBusy(true);
    try {
      if (following) {
        await unfollowTask(accessToken, workspaceId, taskId);
        setFollowing(false);
        toast.success("Unfollowed task");
      } else {
        await followTask(accessToken, workspaceId, taskId);
        setFollowing(true);
        toast.success("Following task");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update follow");
    } finally {
      setFollowBusy(false);
    }
  }

  const statusColumns =
    listStatuses.length > 0
      ? [...listStatuses].sort((a, b) => a.sortOrder - b.sortOrder)
      : null;
  const selectedStatus = statusColumns?.find((s) => s.id === statusId);
  const badgeLabel = selectedStatus?.name ?? taskStatusLabelFromKey(statusKey);
  const badgeColor = selectedStatus?.color ?? task?.statusColor;

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-full gap-0 p-0 sm:max-w-md">
          <SheetHeader className="border-b border-border px-4 py-3">
            <SheetTitle className="sr-only">Task details</SheetTitle>
            {task ? (
              <div className="flex items-center gap-2 pr-8">
                <Badge
                  className="border-0 text-white"
                  style={{ backgroundColor: badgeColor }}
                >
                  {badgeLabel}
                </Badge>
                {priority !== NO_PRIORITY ? (
                  <Badge variant="outline" className="capitalize">
                    {priority}
                  </Badge>
                ) : null}
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
                  {statusColumns ? (
                    <Select
                      value={statusId}
                      onValueChange={(v) => {
                        setStatusId(v ?? "");
                        const row = statusColumns.find((s) => s.id === v);
                        if (row?.legacyKey) {
                          setStatusKey(row.legacyKey as TaskStatusKey);
                        }
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {statusColumns.map((col) => (
                          <SelectItem key={col.id} value={col.id}>
                            {col.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
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
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Priority</Label>
                  <Select
                    value={priority}
                    onValueChange={(v) =>
                      setPriority(v as TaskPriority | typeof NO_PRIORITY)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="None" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NO_PRIORITY}>None</SelectItem>
                      {TASK_PRIORITIES.map((p) => (
                        <SelectItem key={p.value} value={p.value}>
                          {p.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {listOptions.length > 0 ? (
                  <div className="space-y-2">
                    <Label>List</Label>
                    <Select
                      value={listId}
                      onValueChange={(v) => setListId(v ?? "")}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select list" />
                      </SelectTrigger>
                      <SelectContent>
                        {listOptions.map((opt) => (
                          <SelectItem key={opt.id} value={opt.id}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : null}
                <div className="space-y-2">
                  <Label htmlFor="task-due">Due date</Label>
                  <Input
                    id="task-due"
                    type="date"
                    value={dueInput}
                    onChange={(e) => setDueInput(e.target.value)}
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
                <Separator />
                <div className="space-y-3">
                  <p className="text-sm font-semibold">Comments</p>
                  {(task.comments ?? []).length > 0 ? (
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
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      No comments yet.
                    </p>
                  )}
                  <div className="flex gap-2">
                    <Input
                      value={commentBody}
                      onChange={(e) => setCommentBody(e.target.value)}
                      placeholder="Write a comment…"
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          void handleAddComment();
                        }
                      }}
                    />
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={!commentBody.trim()}
                      loading={commenting}
                      onClick={() => void handleAddComment()}
                    >
                      Post
                    </Button>
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-2 border-t border-border p-4">
            <Button
              type="button"
              variant="outline"
              size="sm"
              loading={lineupBusy}
              onClick={() => void handleToggleLineup()}
              disabled={!task}
            >
              {inLineup ? "Remove from LineUp" : "Add to LineUp"}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              loading={followBusy}
              onClick={() => void handleToggleFollow()}
              disabled={!task}
            >
              {following ? "Unfollow" : "Follow"}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              loading={favoriteBusy}
              onClick={() => void handleFavorite()}
              disabled={!task}
            >
              Favorite
            </Button>
            <Button
              type="button"
              variant="outline"
              className="text-destructive hover:text-destructive"
              onClick={() => setDeleteOpen(true)}
              disabled={!task}
            >
              Delete
            </Button>
            <Button
              className="ml-auto min-w-[100px] flex-1 sm:flex-none"
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

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete task?"
        description="This task will be permanently deleted. This cannot be undone."
        confirmLabel="Delete task"
        loading={deleting}
        onConfirm={() => void handleDelete()}
      />
    </>
  );
}
