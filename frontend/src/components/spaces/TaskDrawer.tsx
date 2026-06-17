"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ListStatus, Task, TaskAttachment, TaskSubtask } from "@/lib/types/task";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { CreateTaskListPicker } from "@/components/spaces/CreateTaskListPicker";
import {
  fetchTask,
  addToLineup,
  createFavorite,
  fetchRecents,
  recordTaskRecent,
  removeFromLineup,
  type SpaceDto,
} from "@/lib/api/home";
import {
  addTaskComment,
  createSubtask,
  deleteTask,
  deleteTaskComment,
  fetchListMeta,
  fetchSpacesTree,
  followTask,
  patchTask,
  startTaskTimer,
  stopTaskTimer,
  unfollowTask,
  updateTaskComment,
} from "@/lib/api/spaces";
import { uploadTaskAttachment } from "@/lib/tasks/upload-task-attachment";
import { TaskCommentComposer } from "@/components/tasks/TaskCommentComposer";
import { TaskActivityComment } from "@/components/tasks/TaskActivityComment";
import { CommentAttachmentCard } from "@/components/tasks/CommentAttachmentCard";
import { TaskDatesField } from "@/components/tasks/TaskDatesField";
import { TaskTimeEstimateField } from "@/components/tasks/TaskTimeEstimateField";
import { TaskTimeTrackField } from "@/components/tasks/TaskTimeTrackField";
import { fetchWorkspaceMembers } from "@/lib/api/chat";
import { useWorkspaceApi } from "@/hooks/use-workspace-api";
import { useAuthStore } from "@/stores/auth-store";
import {
  taskStatusKeyFromLabel,
  type TaskStatusKey,
} from "@/lib/task-status";
import {
  TASK_PRIORITIES,
  type TaskPriority,
} from "@/lib/task-priority";
import {
  avatarColorClassForKey,
  avatarInitialFromName,
} from "@/lib/user-display";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  ArchiveIcon,
  BellIcon,
  CheckCircle2Icon,
  ChevronDownIcon,
  CircleDashedIcon,
  CircleDotIcon,
  CircleIcon,
  FlagIcon,
  FlaskConicalIcon,
  ListChecksIcon,
  Loader2Icon,
  MoreHorizontalIcon,
  PaperclipIcon,
  PlusIcon,
  RocketIcon,
  SearchIcon,
  ShieldCheckIcon,
  Share2Icon,
  SquareCheckBigIcon,
  StarIcon,
  Undo2Icon,
  UserPlusIcon,
  WandSparklesIcon,
} from "lucide-react";

type Member = { id: string; fullName: string; email: string; avatarUrl?: string | null };

const NO_PRIORITY = "__none__";

function statusGroupIcon(group: string) {
  switch (group) {
    case "ACTIVE":
      return CircleDotIcon;
    case "DONE":
      return CheckCircle2Icon;
    case "CLOSED":
      return ArchiveIcon;
    default:
      return CircleIcon;
  }
}

function statusIcon(status: Pick<ListStatus, "name" | "statusGroup">) {
  const name = status.name.trim().toLowerCase();
  if (name === "backlog") return CircleIcon;
  if (name === "grooming") return WandSparklesIcon;
  if (name === "todo") return CircleDashedIcon;
  if (name === "ready for development") return RocketIcon;
  if (name === "in progress") return Loader2Icon;
  if (name === "in ui integration ready") return SquareCheckBigIcon;
  if (name === "in qa ready") return FlaskConicalIcon;
  if (name === "in qa") return ShieldCheckIcon;
  if (name === "in qa sent back") return Undo2Icon;
  if (name === "done") return CheckCircle2Icon;
  if (name === "closed") return ArchiveIcon;
  return statusGroupIcon(status.statusGroup);
}

function statusSections(rows: ListStatus[]) {
  const active = rows.filter(
    (row) => row.statusGroup !== "DONE" && row.statusGroup !== "CLOSED"
  );
  const done = rows.filter((row) => row.statusGroup === "DONE");
  const closed = rows.filter((row) => row.statusGroup === "CLOSED");
  const sections: { title?: string; items: ListStatus[] }[] = [];
  if (active.length) sections.push({ items: active });
  if (done.length) sections.push({ title: "Done", items: done });
  if (closed.length) sections.push({ title: "Closed", items: closed });
  return sections;
}

function priorityFlagClass(priority: TaskPriority) {
  switch (priority) {
    case "urgent":
      return "text-red-500";
    case "high":
      return "text-amber-500";
    case "normal":
      return "text-blue-500";
    case "low":
      return "text-muted-foreground";
    default:
      return "text-muted-foreground";
  }
}

function PropertyLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="pt-1 text-sm font-medium text-muted-foreground">
      {children}
    </span>
  );
}

export function TaskDrawer({
  taskId,
  open,
  onOpenChange,
  onSaved,
  onDeleted,
  onTaskNavigate,
}: {
  taskId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
  onDeleted?: () => void;
  onTaskNavigate?: (taskId: string) => void;
}) {
  const { accessToken, workspaceId, ready } = useWorkspaceApi();
  const currentUserId = useAuthStore((s) => s.user?.id ?? null);
  const [task, setTask] = useState<Task | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [spaces, setSpaces] = useState<SpaceDto[]>([]);
  const [recents, setRecents] = useState<
    { id: string; name: string; href: string; space: string }[]
  >([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [commenting, setCommenting] = useState(false);
  const [replyingToCommentId, setReplyingToCommentId] = useState<string | null>(null);
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
  const [startInput, setStartInput] = useState("");
  const [timeEstimateMinutes, setTimeEstimateMinutes] = useState<number | null>(null);
  const [timeTrackedSeconds, setTimeTrackedSeconds] = useState(0);
  const [timeTrackingActive, setTimeTrackingActive] = useState(false);
  const [timeTrackingStartedAt, setTimeTrackingStartedAt] = useState<string | null>(null);
  const [timerBusy, setTimerBusy] = useState(false);
  const [description, setDescription] = useState("");
  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);
  const [listId, setListId] = useState("");
  const [listName, setListName] = useState("");

  const [statusOpen, setStatusOpen] = useState(false);
  const [assigneeOpen, setAssigneeOpen] = useState(false);
  const [assigneeSearch, setAssigneeSearch] = useState("");
  const [priorityOpen, setPriorityOpen] = useState(false);
  const [subtasks, setSubtasks] = useState<TaskSubtask[]>([]);
  const [attachments, setAttachments] = useState<TaskAttachment[]>([]);
  const [subtaskInput, setSubtaskInput] = useState("");
  const [subtaskOpen, setSubtaskOpen] = useState(false);
  const [subtaskBusy, setSubtaskBusy] = useState(false);
  const [attachBusy, setAttachBusy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const persistPatch = useCallback(
    async (patch: Parameters<typeof patchTask>[3]) => {
      if (!taskId || !ready || !accessToken || !workspaceId) return null;
      setSaving(true);
      try {
        const updated = await patchTask(
          accessToken,
          workspaceId,
          taskId,
          patch
        );
        setTask(updated);
        setTimeEstimateMinutes(updated.timeEstimateMinutes ?? null);
        setTimeTrackedSeconds(updated.timeTrackedSeconds ?? 0);
        setTimeTrackingActive(Boolean(updated.timeTracking?.active));
        setTimeTrackingStartedAt(updated.timeTracking?.startedAt ?? null);
        if (updated.startDateIso !== undefined) {
          setStartInput(updated.startDateIso ? updated.startDateIso.slice(0, 10) : "");
        }
        if (updated.dueDateIso !== undefined) {
          setDueInput(updated.dueDateIso ? updated.dueDateIso.slice(0, 10) : "");
        }
        onSaved();
        return updated;
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not save task");
        return null;
      } finally {
        setSaving(false);
      }
    },
    [taskId, ready, accessToken, workspaceId, onSaved]
  );

  const reloadTask = useCallback(async () => {
    if (!taskId || !ready || !accessToken || !workspaceId) return;
    try {
      const refreshed = await fetchTask(accessToken, workspaceId, taskId);
      setTask(refreshed);
      setSubtasks(refreshed.subtasks ?? []);
      setAttachments(refreshed.attachments ?? []);
      setTimeEstimateMinutes(refreshed.timeEstimateMinutes ?? null);
      setTimeTrackedSeconds(refreshed.timeTrackedSeconds ?? 0);
      setTimeTrackingActive(Boolean(refreshed.timeTracking?.active));
      setTimeTrackingStartedAt(refreshed.timeTracking?.startedAt ?? null);
      setStartInput(refreshed.startDateIso ? refreshed.startDateIso.slice(0, 10) : "");
      setDueInput(refreshed.dueDateIso ? refreshed.dueDateIso.slice(0, 10) : "");
      setName(refreshed.name);
      setDescription(refreshed.description ?? "");
      onSaved();
    } catch {
      toast.error("Could not refresh task");
    }
  }, [taskId, ready, accessToken, workspaceId, onSaved]);

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
      fetchRecents(accessToken, workspaceId),
    ])
      .then(async ([t, m, spacesRes, recentsRes]) => {
        if (cancelled) return;
        setMembers(m.data);
        setSpaces(spacesRes.data);
        setRecents(recentsRes.data);
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
        setListName(t.list ?? "");
        setDueInput(t.dueDateIso ? t.dueDateIso.slice(0, 10) : "");
        setStartInput(t.startDateIso ? t.startDateIso.slice(0, 10) : "");
        setTimeEstimateMinutes(t.timeEstimateMinutes ?? null);
        setTimeTrackedSeconds(t.timeTrackedSeconds ?? 0);
        setTimeTrackingActive(Boolean(t.timeTracking?.active));
        setTimeTrackingStartedAt(t.timeTracking?.startedAt ?? null);
        setInLineup(Boolean(t.inLineup));
        setFollowing(Boolean(t.isFollowing));
        setSubtasks(t.subtasks ?? []);
        setAttachments(t.attachments ?? []);
        setSubtaskInput("");
        setSubtaskOpen(false);
        setReplyingToCommentId(null);
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

  const statusColumns = useMemo(
    () =>
      listStatuses.length > 0
        ? [...listStatuses].sort((a, b) => a.sortOrder - b.sortOrder)
        : null,
    [listStatuses]
  );
  const groupedStatusSections = useMemo(
    () => statusSections(statusColumns ?? []),
    [statusColumns]
  );

  const selectedStatus = statusColumns?.find((s) => s.id === statusId);
  const StatusIcon = selectedStatus ? statusIcon(selectedStatus) : CircleIcon;

  const filteredMembers = useMemo(() => {
    const q = assigneeSearch.trim().toLowerCase();
    if (!q) return members;
    return members.filter((m) => m.fullName.toLowerCase().includes(q));
  }, [members, assigneeSearch]);

  const selectedAssignees = useMemo(
    () => members.filter((m) => assigneeIds.includes(m.id)),
    [members, assigneeIds]
  );

  async function handleDescriptionSave() {
    if (description === (task?.description ?? "")) return;
    const updated = await persistPatch({ description });
    if (updated) toast.success("Description saved");
  }

  async function handleDescriptionKeyDown(
    e: React.KeyboardEvent<HTMLTextAreaElement>
  ) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      await handleDescriptionSave();
    }
  }

  async function handleAddSubtask() {
    const name = subtaskInput.trim();
    if (!taskId || !name || !ready || !accessToken || !workspaceId) return;
    setSubtaskBusy(true);
    try {
      const created = await createSubtask(
        accessToken,
        workspaceId,
        taskId,
        name
      );
      setSubtasks((rows) => [...rows, created]);
      setSubtaskInput("");
      setSubtaskOpen(false);
      onSaved();
      toast.success("Subtask added");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not add subtask");
    } finally {
      setSubtaskBusy(false);
    }
  }

  async function toggleSubtaskDone(subtask: TaskSubtask) {
    if (!ready || !accessToken || !workspaceId) return;
    const doneStatus = statusColumns?.find(
      (s) => s.legacyKey === "DONE" || s.statusGroup === "DONE"
    );
    const todoStatus = statusColumns?.find(
      (s) => s.legacyKey === "TODO" || s.legacyKey === "OPEN"
    );
    const isDone =
      subtask.statusKey === "DONE" ||
      subtask.status.toLowerCase() === "done";
    try {
      if (statusColumns?.length) {
        const target = isDone ? todoStatus : doneStatus;
        if (!target) return;
        await patchTask(accessToken, workspaceId, subtask.id, {
          statusId: target.id,
        });
      } else {
        await patchTask(accessToken, workspaceId, subtask.id, {
          status: isDone ? "TODO" : "DONE",
        });
      }
      setSubtasks((rows) =>
        rows.map((row) =>
          row.id === subtask.id
            ? {
                ...row,
                status: isDone
                  ? todoStatus?.name ?? "Open"
                  : doneStatus?.name ?? "Done",
                statusKey: isDone ? "TODO" : "DONE",
                statusColor: isDone
                  ? todoStatus?.color ?? row.statusColor
                  : doneStatus?.color ?? row.statusColor,
              }
            : row
        )
      );
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update subtask");
    }
  }

  async function handleAttachFiles(fileList: FileList | null) {
    if (!fileList?.length || !taskId || !ready || !accessToken || !workspaceId) {
      return;
    }
    setAttachBusy(true);
    try {
      for (const file of Array.from(fileList)) {
        await uploadTaskAttachment(accessToken, workspaceId, taskId, file);
      }
      await reloadTask();
      toast.success(
        fileList.length === 1 ? "File attached" : `${fileList.length} files attached`
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not attach file");
    } finally {
      setAttachBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleNameBlur() {
    const trimmed = name.trim();
    if (!trimmed || trimmed === task?.name) return;
    await persistPatch({ name: trimmed });
  }

  async function handleDescriptionBlur() {
    await handleDescriptionSave();
  }

  async function handleStatusChange(nextStatusId: string) {
    const row = statusColumns?.find((s) => s.id === nextStatusId);
    setStatusId(nextStatusId);
    if (row?.legacyKey) setStatusKey(row.legacyKey as TaskStatusKey);
    setStatusOpen(false);
    if (statusColumns?.length) {
      await persistPatch({ statusId: nextStatusId });
    } else {
      await persistPatch({ status: row?.legacyKey as TaskStatusKey ?? statusKey });
    }
  }

  async function handlePriorityChange(
    next: TaskPriority | typeof NO_PRIORITY
  ) {
    setPriority(next);
    setPriorityOpen(false);
    await persistPatch({
      priority: next === NO_PRIORITY ? null : next,
    });
  }

  async function handleDueChange(value: string) {
    setDueInput(value);
    if (value) {
      await persistPatch({
        dueDate: new Date(`${value}T12:00:00.000Z`).toISOString(),
      });
    } else if (task?.dueDateIso) {
      await persistPatch({ dueDate: "" });
    }
  }

  async function handleStartChange(value: string) {
    setStartInput(value);
    if (value) {
      await persistPatch({
        startDate: new Date(`${value}T12:00:00.000Z`).toISOString(),
      });
    } else if (task?.startDateIso) {
      await persistPatch({ startDate: "" });
    }
  }

  async function handleTimeEstimateChange(minutes: number | null) {
    setTimeEstimateMinutes(minutes);
    await persistPatch({ timeEstimateMinutes: minutes });
  }

  function applyTaskResponse(updated: Task) {
    setTask((prev) => ({
      ...updated,
      subtasks: prev?.subtasks ?? updated.subtasks ?? [],
      attachments: prev?.attachments ?? updated.attachments ?? [],
    }));
    setTimeEstimateMinutes(updated.timeEstimateMinutes ?? null);
    setTimeTrackedSeconds(updated.timeTrackedSeconds ?? 0);
    setTimeTrackingActive(Boolean(updated.timeTracking?.active));
    setTimeTrackingStartedAt(updated.timeTracking?.startedAt ?? null);
    if (updated.dueDateIso !== undefined) {
      setDueInput(updated.dueDateIso ? updated.dueDateIso.slice(0, 10) : "");
    }
    if (updated.startDateIso !== undefined) {
      setStartInput(updated.startDateIso ? updated.startDateIso.slice(0, 10) : "");
    }
  }

  async function handleStartTimer() {
    if (!taskId || !ready || !accessToken || !workspaceId) return;
    setTimerBusy(true);
    try {
      const updated = await startTaskTimer(accessToken, workspaceId, taskId);
      applyTaskResponse(updated);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not start timer");
    } finally {
      setTimerBusy(false);
    }
  }

  async function handleStopTimer() {
    if (!taskId || !ready || !accessToken || !workspaceId) return;
    setTimerBusy(true);
    try {
      const updated = await stopTaskTimer(accessToken, workspaceId, taskId);
      applyTaskResponse(updated);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not stop timer");
    } finally {
      setTimerBusy(false);
    }
  }

  async function handleEditComment(commentId: string, body: string) {
    if (!taskId || !body.trim() || !ready || !accessToken || !workspaceId) return;
    setCommenting(true);
    try {
      const updated = await updateTaskComment(
        accessToken,
        workspaceId,
        taskId,
        commentId,
        body
      );
      applyTaskResponse(updated);
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update comment");
    } finally {
      setCommenting(false);
    }
  }

  async function handleDeleteComment(commentId: string) {
    if (!taskId || !ready || !accessToken || !workspaceId) return;
    setCommenting(true);
    try {
      const updated = await deleteTaskComment(
        accessToken,
        workspaceId,
        taskId,
        commentId
      );
      applyTaskResponse(updated);
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete comment");
    } finally {
      setCommenting(false);
    }
  }

  async function handleListChange(id: string, label: string) {
    if (id === listId) return;
    setListId(id);
    setListName(label);
    const updated = await persistPatch({ listId: id });
    if (updated?.listId && ready && accessToken && workspaceId) {
      try {
        const meta = await fetchListMeta(accessToken, workspaceId, updated.listId);
        setListStatuses(meta.statuses ?? []);
        const defaultStatus = meta.statuses?.find((s) => s.legacyKey === "TODO") ?? meta.statuses?.[0];
        if (defaultStatus) {
          setStatusId(defaultStatus.id);
        }
      } catch {
        setListStatuses([]);
      }
    }
  }

  async function toggleAssignee(userId: string) {
    const next = assigneeIds.includes(userId)
      ? assigneeIds.filter((id) => id !== userId)
      : [...assigneeIds, userId];
    setAssigneeIds(next);
    await persistPatch({ assigneeIds: next });
  }

  async function handleAddComment(
    body: string,
    attachmentIds: string[],
    parentCommentId?: string
  ) {
    if (!taskId || (!body.trim() && attachmentIds.length === 0) || !ready || !accessToken || !workspaceId) return;
    setCommenting(true);
    try {
      const updated = await addTaskComment(
        accessToken,
        workspaceId,
        taskId,
        body,
        attachmentIds,
        parentCommentId
      );
      applyTaskResponse(updated);
      setReplyingToCommentId(null);
      onSaved();
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
        href: task.listId
          ? `/spaces/l/${task.listId}?task=${task.id}`
          : `/home/tasks/${task.id}`,
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

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          showCloseButton
          className="flex h-[min(94vh,960px)] max-h-[94vh] w-[min(96vw,1440px)] max-w-[min(96vw,1440px)] flex-col gap-0 overflow-hidden p-0 sm:max-w-[min(96vw,1440px)]"
        >
          <DialogTitle className="sr-only">
            {task?.name ?? "Task"}
          </DialogTitle>

          <div className="flex items-center gap-3 border-b border-border px-6 py-3">
            <button
              type="button"
              className="flex items-center gap-1 rounded-md px-2 py-1 text-sm font-medium hover:bg-muted"
            >
              <SquareCheckBigIcon className="size-4 text-muted-foreground" />
              Task
              <ChevronDownIcon className="size-3.5 text-muted-foreground" />
            </button>
            {task ? (
              <div className="flex min-w-0 flex-1 items-center justify-center gap-1.5 text-sm text-muted-foreground">
                <span className="truncate">{task.space}</span>
                <span>/</span>
                <span className="truncate">{task.list}</span>
              </div>
            ) : (
              <div className="flex-1" />
            )}
            <div className="ml-auto flex items-center gap-0.5">
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button variant="ghost" size="icon-sm" aria-label="Share">
                      <Share2Icon className="size-4" />
                    </Button>
                  }
                />
                <TooltipContent side="bottom">Share</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Favorite"
                      loading={favoriteBusy}
                      onClick={() => void handleFavorite()}
                      disabled={!task}
                    >
                      <StarIcon className="size-4" />
                    </Button>
                  }
                />
                <TooltipContent side="bottom">Favorite</TooltipContent>
              </Tooltip>
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Tooltip>
                      <TooltipTrigger
                        render={
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label="More actions"
                          >
                            <MoreHorizontalIcon className="size-4" />
                          </Button>
                        }
                      />
                      <TooltipContent side="bottom">More actions</TooltipContent>
                    </Tooltip>
                  }
                />
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem
                    disabled={lineupBusy || !task}
                    onClick={() => void handleToggleLineup()}
                  >
                    {inLineup ? "Remove from LineUp" : "Add to LineUp"}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    disabled={followBusy || !task}
                    onClick={() => void handleToggleFollow()}
                  >
                    {following ? "Unfollow" : "Follow"}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={() => setDeleteOpen(true)}
                    disabled={!task}
                  >
                    Delete task
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {loading ? (
            <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
              Loading…
            </div>
          ) : task ? (
            <div className="flex min-h-0 flex-1">
              <div className="min-w-0 flex-[1.4] overflow-y-auto px-8 py-6">
                <div className="mb-5 flex items-start gap-3">
                  <CreateTaskListPicker
                    spaces={spaces}
                    recents={recents}
                    listId={listId}
                    listName={listName}
                    triggerClassName="max-w-[320px]"
                    onSelect={(id, label) => void handleListChange(id, label)}
                  />
                  {saving ? (
                    <span className="text-xs text-muted-foreground">Saving…</span>
                  ) : null}
                </div>

                <textarea
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onBlur={() => void handleNameBlur()}
                  rows={2}
                  className="mb-6 w-full resize-none border-0 bg-transparent text-3xl leading-snug font-semibold outline-none placeholder:text-muted-foreground"
                  placeholder="Task name"
                />

                <div className="grid grid-cols-[minmax(7rem,9rem)_1fr_minmax(7rem,9rem)_1fr] gap-x-8 gap-y-5 text-sm">
                  <PropertyLabel>Status</PropertyLabel>
                  <div>
                    {statusColumns ? (
                      <Popover open={statusOpen} onOpenChange={setStatusOpen}>
                        <PopoverTrigger
                          render={
                            <button
                              type="button"
                              className="inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-bold tracking-wide text-white uppercase"
                              style={{
                                backgroundColor:
                                  selectedStatus?.color ?? task.statusColor,
                              }}
                            >
                              <StatusIcon className="size-3.5" />
                              {selectedStatus?.name ?? task.status}
                              <ChevronDownIcon className="size-3 opacity-80" />
                            </button>
                          }
                        />
                        <PopoverContent align="start" className="w-72 p-1">
                          {groupedStatusSections.map((section, sectionIndex) => (
                            <div key={section.title ?? `section-${sectionIndex}`}>
                              {section.title ? (
                                <div className="px-2 py-2 text-xs font-semibold text-muted-foreground">
                                  {section.title}
                                </div>
                              ) : null}
                              {section.items.map((status) => {
                                const Icon = statusIcon(status);
                                return (
                                  <button
                                    key={status.id}
                                    type="button"
                                    className={cn(
                                      "flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-muted",
                                      status.id === statusId && "bg-muted"
                                    )}
                                    onClick={() => void handleStatusChange(status.id)}
                                  >
                                    <span
                                      className="flex size-5 items-center justify-center rounded-full text-white"
                                      style={{ backgroundColor: status.color }}
                                    >
                                      <Icon className="size-3" />
                                    </span>
                                    <span className="uppercase">{status.name}</span>
                                  </button>
                                );
                              })}
                              {sectionIndex < groupedStatusSections.length - 1 ? (
                                <div className="my-1 border-t border-border" />
                              ) : null}
                            </div>
                          ))}
                        </PopoverContent>
                      </Popover>
                    ) : (
                      <span
                        className="inline-flex rounded-md px-3 py-1.5 text-xs font-bold text-white uppercase"
                        style={{ backgroundColor: task.statusColor }}
                      >
                        {task.status}
                      </span>
                    )}
                  </div>

                  <PropertyLabel>Assignees</PropertyLabel>
                  <div>
                    <Popover
                      open={assigneeOpen}
                      onOpenChange={(next) => {
                        setAssigneeOpen(next);
                        if (!next) setAssigneeSearch("");
                      }}
                    >
                      <PopoverTrigger
                        render={
                          <button
                            type="button"
                            className="flex min-h-8 flex-wrap items-center gap-1.5 rounded-md border border-dashed border-border px-2 py-1 hover:bg-muted/50"
                          >
                            {selectedAssignees.length === 0 ? (
                              <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                                <UserPlusIcon className="size-4" />
                                Empty
                              </span>
                            ) : (
                              selectedAssignees.map((m) => (
                                <span
                                  key={m.id}
                                  className="flex items-center gap-1.5 rounded-full bg-muted px-2 py-0.5 text-xs font-medium"
                                >
                                  <Avatar className="size-5">
                                    <AvatarFallback
                                      className={cn(
                                        "text-[10px] text-white",
                                        avatarColorClassForKey(m.id)
                                      )}
                                    >
                                      {avatarInitialFromName(m.fullName)}
                                    </AvatarFallback>
                                  </Avatar>
                                  {m.fullName}
                                </span>
                              ))
                            )}
                          </button>
                        }
                      />
                      <PopoverContent align="start" className="w-64 p-2">
                        <div className="relative mb-2">
                          <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
                          <Input
                            value={assigneeSearch}
                            onChange={(e) => setAssigneeSearch(e.target.value)}
                            placeholder="Search people…"
                            className="h-8 pl-8"
                          />
                        </div>
                        <ul className="max-h-48 space-y-0.5 overflow-y-auto">
                          {filteredMembers.map((m) => {
                            const checked = assigneeIds.includes(m.id);
                            return (
                              <li key={m.id}>
                                <button
                                  type="button"
                                  className={cn(
                                    "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted",
                                    checked && "bg-muted"
                                  )}
                                  onClick={() => void toggleAssignee(m.id)}
                                >
                                  <Avatar className="size-6">
                                    <AvatarFallback
                                      className={cn(
                                        "text-[10px] text-white",
                                        avatarColorClassForKey(m.id)
                                      )}
                                    >
                                      {avatarInitialFromName(m.fullName)}
                                    </AvatarFallback>
                                  </Avatar>
                                  <span className="flex-1 truncate text-left">
                                    {m.fullName}
                                  </span>
                                </button>
                              </li>
                            );
                          })}
                        </ul>
                      </PopoverContent>
                    </Popover>
                  </div>

                  <PropertyLabel>Dates</PropertyLabel>
                  <div>
                    <TaskDatesField
                      startDateIso={task?.startDateIso}
                      dueDateIso={task?.dueDateIso}
                      onStartChange={handleStartChange}
                      onDueChange={handleDueChange}
                    />
                  </div>

                  <PropertyLabel>Priority</PropertyLabel>
                  <div>
                    <Popover open={priorityOpen} onOpenChange={setPriorityOpen}>
                      <PopoverTrigger
                        render={
                          <button
                            type="button"
                            className="inline-flex items-center gap-1.5 rounded-md border border-dashed border-border px-2.5 py-1 text-sm hover:bg-muted/50"
                          >
                            {priority === NO_PRIORITY ? (
                              <span className="text-muted-foreground">Empty</span>
                            ) : (
                              <>
                                <FlagIcon
                                  className={cn(
                                    "size-3.5",
                                    priorityFlagClass(priority)
                                  )}
                                />
                                <span className="capitalize">{priority}</span>
                              </>
                            )}
                          </button>
                        }
                      />
                      <PopoverContent align="start" className="w-44 p-1">
                        <button
                          type="button"
                          className="flex w-full rounded-md px-2 py-2 text-sm hover:bg-muted"
                          onClick={() => void handlePriorityChange(NO_PRIORITY)}
                        >
                          Empty
                        </button>
                        {TASK_PRIORITIES.map((p) => (
                          <button
                            key={p.value}
                            type="button"
                            className={cn(
                              "flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-muted",
                              priority === p.value && "bg-muted"
                            )}
                            onClick={() => void handlePriorityChange(p.value)}
                          >
                            <FlagIcon
                              className={cn(
                                "size-3.5",
                                priorityFlagClass(p.value)
                              )}
                            />
                            {p.label}
                          </button>
                        ))}
                      </PopoverContent>
                    </Popover>
                  </div>

                  <PropertyLabel>Time estimate</PropertyLabel>
                  <div>
                    <TaskTimeEstimateField
                      minutes={timeEstimateMinutes}
                      onChange={handleTimeEstimateChange}
                    />
                  </div>

                  <PropertyLabel>Track time</PropertyLabel>
                  <div>
                    <TaskTimeTrackField
                      trackedSeconds={timeTrackedSeconds}
                      active={timeTrackingActive}
                      startedAt={timeTrackingStartedAt}
                      busy={timerBusy}
                      onStart={handleStartTimer}
                      onStop={handleStopTimer}
                    />
                  </div>

                  <PropertyLabel>Tags</PropertyLabel>
                  <button
                    type="button"
                    className="col-span-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
                  >
                    Empty
                  </button>
                </div>

                <div className="mt-8 border-t border-border pt-6">
                  <div className="mb-3 flex items-center gap-2 text-sm font-medium">
                    <ListChecksIcon className="size-4 text-muted-foreground" />
                    Description
                  </div>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    onBlur={() => void handleDescriptionBlur()}
                    onKeyDown={(e) => void handleDescriptionKeyDown(e)}
                    rows={5}
                    placeholder="Add description"
                    className="min-h-[120px] w-full resize-y rounded-lg border border-transparent bg-muted/30 px-4 py-3 text-sm leading-relaxed outline-none focus:border-border"
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    Press Enter to save · Shift+Enter for new line
                  </p>
                </div>

                {(subtasks.length > 0 || subtaskOpen) && (
                  <div className="mt-6 border-t border-border pt-4">
                    <p className="mb-2 text-sm font-medium">Subtasks</p>
                    <ul className="space-y-1">
                      {subtasks.map((subtask) => {
                        const isDone =
                          subtask.statusKey === "DONE" ||
                          subtask.status.toLowerCase() === "done";
                        return (
                          <li
                            key={subtask.id}
                            className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted/50"
                          >
                            <input
                              type="checkbox"
                              checked={isDone}
                              onChange={() => void toggleSubtaskDone(subtask)}
                              className="size-4 rounded border-border"
                              aria-label={`Mark ${subtask.name} complete`}
                            />
                            <button
                              type="button"
                              className={cn(
                                "min-w-0 flex-1 truncate text-left text-sm",
                                isDone && "text-muted-foreground line-through"
                              )}
                              onClick={() => onTaskNavigate?.(subtask.id)}
                            >
                              {subtask.name}
                            </button>
                            <Badge
                              className="shrink-0 border-0 text-[10px] text-white"
                              style={{ backgroundColor: subtask.statusColor }}
                            >
                              {subtask.status}
                            </Badge>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}

                {subtaskOpen ? (
                  <div className="mt-3 flex gap-2">
                    <Input
                      value={subtaskInput}
                      onChange={(e) => setSubtaskInput(e.target.value)}
                      placeholder="Subtask name"
                      className="h-8"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          void handleAddSubtask();
                        }
                        if (e.key === "Escape") {
                          setSubtaskOpen(false);
                          setSubtaskInput("");
                        }
                      }}
                    />
                    <Button
                      type="button"
                      size="sm"
                      loading={subtaskBusy}
                      disabled={!subtaskInput.trim()}
                      onClick={() => void handleAddSubtask()}
                    >
                      Add
                    </Button>
                  </div>
                ) : null}

                {attachments.length > 0 ? (
                  <div className="mt-4 flex flex-wrap gap-3">
                    {attachments.map((file) => (
                      <CommentAttachmentCard key={file.id} attachment={file} />
                    ))}
                  </div>
                ) : null}

                <ul className="mt-4 space-y-1 text-sm text-muted-foreground">
                  <li>
                    <button
                      type="button"
                      className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted hover:text-foreground"
                      onClick={() => setSubtaskOpen(true)}
                    >
                      <PlusIcon className="size-4" />
                      Add subtask
                    </button>
                  </li>
                  <li>
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      className="hidden"
                      onChange={(e) => void handleAttachFiles(e.target.files)}
                    />
                    <button
                      type="button"
                      className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted hover:text-foreground"
                      disabled={attachBusy}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <PaperclipIcon className="size-4" />
                      {attachBusy ? "Uploading…" : "Attach file"}
                    </button>
                  </li>
                </ul>
              </div>

              <div className="flex w-[min(42%,520px)] min-w-[400px] shrink-0 flex-col border-l border-border bg-muted/20">
                <div className="flex items-center justify-between border-b border-border px-6 py-3.5">
                  <span className="text-sm font-semibold">Activity</span>
                  <div className="flex items-center gap-0.5">
                    <Tooltip>
                      <TooltipTrigger
                        render={
                          <Button variant="ghost" size="icon-sm" aria-label="Search activity">
                            <SearchIcon className="size-4" />
                          </Button>
                        }
                      />
                      <TooltipContent side="bottom">Search activity</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger
                        render={
                          <Button variant="ghost" size="icon-sm" aria-label="Notifications">
                            <BellIcon className="size-4" />
                          </Button>
                        }
                      />
                      <TooltipContent side="bottom">Notifications</TooltipContent>
                    </Tooltip>
                  </div>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
                  <p className="mb-4 text-xs text-muted-foreground">
                    You opened this task
                  </p>
                  {(task.comments ?? []).map((c) => (
                    <TaskActivityComment
                      key={c.id}
                      comment={c}
                      taskId={taskId ?? null}
                      workspaceMembers={members}
                      currentUserId={currentUserId}
                      replyingToId={replyingToCommentId}
                      sending={commenting}
                      onStartReply={setReplyingToCommentId}
                      onCancelReply={() => setReplyingToCommentId(null)}
                      onSubmitReply={(parentId, body, attachmentIds) =>
                        handleAddComment(body, attachmentIds, parentId)
                      }
                      onEditComment={handleEditComment}
                      onDeleteComment={handleDeleteComment}
                    />
                  ))}
                </div>

                <div className="border-t border-border p-4">
                  <TaskCommentComposer
                    taskId={taskId ?? null}
                    workspaceMembers={members}
                    sending={commenting}
                    onSubmit={(body, attachmentIds) =>
                      handleAddComment(body, attachmentIds)
                    }
                  />
                </div>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

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
