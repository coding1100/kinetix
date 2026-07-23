"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  ListStatus,
  Task,
  TaskActivityEvent,
  TaskAttachment,
  TaskChecklist,
  TaskComment,
  TaskSubtask,
} from "@/lib/types/task";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Switch } from "@/components/ui/switch";
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
  addChecklist,
  addChecklistItem,
  addTaskComment,
  createSubtask,
  deleteChecklist,
  deleteChecklistItem,
  deleteTask,
  deleteTaskComment,
  fetchListMeta,
  fetchSpacesTree,
  fetchTaskActivity,
  patchTask,
  updateChecklist,
  updateChecklistItem,
  updateTaskComment,
} from "@/lib/api/spaces";
import { uploadTaskAttachment } from "@/lib/tasks/upload-task-attachment";
import { TaskCommentComposer } from "@/components/tasks/TaskCommentComposer";
import { TaskActivityComment } from "@/components/tasks/TaskActivityComment";
import { CommentAttachmentCard } from "@/components/tasks/CommentAttachmentCard";
import { TaskDatesField } from "@/components/tasks/TaskDatesField";
import { TaskTimeEstimateField } from "@/components/tasks/TaskTimeEstimateField";
import { fetchWorkspaceMembers } from "@/lib/api/chat";
import { useWorkspaceApi } from "@/hooks/use-workspace-api";
import { useAuthStore } from "@/stores/auth-store";
import { UserAvatarWithPresence } from "@/components/shared/AvatarWithPresence";
import { useUserPresence } from "@/stores/presence-store";
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
import { appPath, cn } from "@/lib/utils";
import { FEATURE_FLAGS } from "@/lib/feature-flags";
import {
  ArchiveIcon,
  BellIcon,
  BellOffIcon,
  CalendarIcon,
  CheckIcon,
  CheckCircle2Icon,
  ChevronDownIcon,
  ChevronUpIcon,
  CircleDashedIcon,
  CircleDotIcon,
  CircleIcon,
  Edit2Icon,
  FlagIcon,
  FlaskConicalIcon,
  HourglassIcon,
  ListChecksIcon,
  LinkIcon,
  Loader2Icon,
  Maximize2Icon,
  MoreHorizontalIcon,
  PaperclipIcon,
  PlusIcon,
  RocketIcon,
  SearchIcon,
  ShieldCheckIcon,
  Share2Icon,
  SquareCheckBigIcon,
  StarIcon,
  Trash2Icon,
  Undo2Icon,
  UserMinusIcon,
  UserPlusIcon,
  UsersIcon,
  WandSparklesIcon,
} from "lucide-react";

type Member = { id: string; fullName: string; email: string; avatarUrl?: string | null; isDisabled?: boolean };

function FollowerAvatar({ member }: { member: Member }) {
  const livePresence = useUserPresence(member.id);
  const presence = member.isDisabled ? "offline" : livePresence;
  return (
    <UserAvatarWithPresence
      name={member.fullName}
      avatarUrl={member.avatarUrl}
      presence={presence}
      avatarClassName="size-6"
      dotSize="xs"
      fallbackClassName={cn("text-[10px] text-white", avatarColorClassForKey(member.id))}
      fallback={avatarInitialFromName(member.fullName)}
    />
  );
}

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

function PropertyLabel({
  icon: Icon,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <span className="flex items-center gap-1.5 pt-1 text-xs font-medium text-muted-foreground">
      <Icon className="size-3.5 shrink-0" />
      {children}
    </span>
  );
}

function PropertyValue({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "-mx-1.5 flex h-8 w-fit items-center rounded-md px-1.5 text-xs transition-colors hover:bg-muted/60",
        className
      )}
    >
      {children}
    </div>
  );
}

function formatCreatedLabel(iso: string | null | undefined) {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

function formatActivityTime(iso: string | null | undefined) {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function ActivityEventRow({ event }: { event: TaskActivityEvent }) {
  return (
    <div className="flex items-start gap-2 py-1 text-xs">
      <span className="mt-1.5 size-1 shrink-0 rounded-full bg-muted-foreground/60" />
      <span className="flex-1 text-muted-foreground">{event.preview || event.title}</span>
      <span className="shrink-0 whitespace-nowrap text-muted-foreground">
        {formatActivityTime(event.createdAt)}
      </span>
    </div>
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
  const [followerSearch, setFollowerSearch] = useState("");
  const [archiveBusy, setArchiveBusy] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareSearch, setShareSearch] = useState("");
  const [publicShareEnabled, setPublicShareEnabled] = useState(false);
  const [sharePerms, setSharePerms] = useState<Record<string, "view" | "comment" | "edit">>({});
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
  const [activityEvents, setActivityEvents] = useState<TaskActivityEvent[]>([]);
  const [feedExpanded, setFeedExpanded] = useState(false);
  const [activitySearchOpen, setActivitySearchOpen] = useState(false);
  const [activitySearch, setActivitySearch] = useState("");
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [subtaskInput, setSubtaskInput] = useState("");
  const [subtaskOpen, setSubtaskOpen] = useState(false);
  const [subtaskBusy, setSubtaskBusy] = useState(false);
  const [attachBusy, setAttachBusy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [checklists, setChecklists] = useState<TaskChecklist[]>([]);
  const [checklistBusy, setChecklistBusy] = useState(false);
  const [checklistItemInput, setChecklistItemInput] = useState<
    Record<string, string>
  >({});
  const [checklistDraftAssignee, setChecklistDraftAssignee] = useState<
    Record<string, string | null>
  >({});
  const [checklistAssigneeOpen, setChecklistAssigneeOpen] = useState<
    string | null
  >(null);
  const [checklistAssigneeSearch, setChecklistAssigneeSearch] = useState("");
  const [checklistAssignAllOpen, setChecklistAssignAllOpen] = useState<
    string | null
  >(null);
  const [checklistAssignAllSearch, setChecklistAssignAllSearch] = useState("");
  const [checklistRenameTarget, setChecklistRenameTarget] = useState<
    | { type: "checklist"; checklistId: string }
    | { type: "item"; checklistId: string; itemId: string }
    | null
  >(null);
  const [checklistRenameValue, setChecklistRenameValue] = useState("");
  const [unassignAllChecklistId, setUnassignAllChecklistId] = useState<
    string | null
  >(null);
  const [checklistsSectionOpen, setChecklistsSectionOpen] = useState(true);
  const [checklistItemsExpanded, setChecklistItemsExpanded] = useState(true);
  const [galleryExpanded, setGalleryExpanded] = useState(false);

  const refreshActivity = useCallback(async () => {
    if (!taskId || !ready || !accessToken || !workspaceId) return;
    try {
      const activity = await fetchTaskActivity(accessToken, workspaceId, taskId);
      setActivityEvents(activity.data ?? []);
    } catch {
      // Keep existing activity list if refresh fails.
    }
  }, [taskId, ready, accessToken, workspaceId]);

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
        if (updated.startDateIso !== undefined) {
          setStartInput(updated.startDateIso ? updated.startDateIso.slice(0, 10) : "");
        }
        if (updated.dueDateIso !== undefined) {
          setDueInput(updated.dueDateIso ? updated.dueDateIso.slice(0, 10) : "");
        }
        void refreshActivity();
        onSaved();
        return updated;
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not save task");
        return null;
      } finally {
        setSaving(false);
      }
    },
    [taskId, ready, accessToken, workspaceId, onSaved, refreshActivity]
  );

  const reloadTask = useCallback(async () => {
    if (!taskId || !ready || !accessToken || !workspaceId) return;
    try {
      const refreshed = await fetchTask(accessToken, workspaceId, taskId);
      setTask(refreshed);
      setSubtasks(refreshed.subtasks ?? []);
      setAttachments(refreshed.attachments ?? []);
      setChecklists(refreshed.checklists ?? []);
      setTimeEstimateMinutes(refreshed.timeEstimateMinutes ?? null);
      setStartInput(refreshed.startDateIso ? refreshed.startDateIso.slice(0, 10) : "");
      setDueInput(refreshed.dueDateIso ? refreshed.dueDateIso.slice(0, 10) : "");
      setName(refreshed.name);
      setDescription(refreshed.description ?? "");
      await refreshActivity();
      onSaved();
    } catch {
      toast.error("Could not refresh task");
    }
  }, [taskId, ready, accessToken, workspaceId, onSaved, refreshActivity]);

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
      fetchTaskActivity(accessToken, workspaceId, taskId),
    ])
      .then(async ([t, m, spacesRes, recentsRes, activityRes]) => {
        if (cancelled) return;
        setMembers(m.data);
        setSpaces(spacesRes.data);
        setRecents(recentsRes.data);
        setActivityEvents(activityRes.data ?? []);
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
        setInLineup(Boolean(t.inLineup));
        setSubtasks(t.subtasks ?? []);
        setAttachments(t.attachments ?? []);
        setChecklists(t.checklists ?? []);
        setSubtaskInput("");
        setSubtaskOpen(false);
        setGalleryExpanded(false);
        setChecklistItemInput({});
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

  const filteredActivityEvents = useMemo(() => {
    const query = activitySearch.trim().toLowerCase();
    if (!query) return activityEvents;
    return activityEvents.filter((event) =>
      [event.title, event.preview, event.source, event.activityKind]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query))
    );
  }, [activityEvents, activitySearch]);

  const filteredComments = useMemo(() => {
    const query = activitySearch.trim().toLowerCase();
    const comments = task?.comments ?? [];
    if (!query) return comments;
    return comments.filter((comment) =>
      [comment.author, comment.body]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(query))
    );
  }, [task?.comments, activitySearch]);

  const activityFeed = useMemo(() => {
    type FeedItem =
      | { kind: "event"; ts: number; event: TaskActivityEvent }
      | { kind: "comment"; ts: number; comment: TaskComment };
    const events: FeedItem[] = filteredActivityEvents.map((event) => ({
      kind: "event",
      ts: event.createdAt ? new Date(event.createdAt).getTime() : 0,
      event,
    }));
    const comments: FeedItem[] = filteredComments.map((comment) => ({
      kind: "comment",
      ts: comment.createdAt ? new Date(comment.createdAt).getTime() : 0,
      comment,
    }));
    return [...events, ...comments].sort((a, b) => a.ts - b.ts);
  }, [filteredActivityEvents, filteredComments]);

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
  const isArchived = Boolean(
    selectedStatus?.statusGroup === "CLOSED" ||
      task?.status?.trim().toLowerCase() === "closed"
  );

  const filteredMembers = useMemo(() => {
    const q = assigneeSearch.trim().toLowerCase();
    if (!q) return members;
    return members.filter((m) => m.fullName.toLowerCase().includes(q));
  }, [members, assigneeSearch]);

  const selectedAssignees = useMemo(
    () => members.filter((m) => assigneeIds.includes(m.id)),
    [members, assigneeIds]
  );

  const followerIds = task?.followerIds ?? [];
  const following = Boolean(currentUserId && followerIds.includes(currentUserId));
  const followerMembers = useMemo(() => {
    const q = followerSearch.trim().toLowerCase();
    return members.filter(
      (m) => followerIds.includes(m.id) && (!q || m.fullName.toLowerCase().includes(q))
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [members, task?.followerIds, followerSearch]);
  const nonFollowerMembers = useMemo(() => {
    const q = followerSearch.trim().toLowerCase();
    return members.filter(
      (m) => !followerIds.includes(m.id) && (!q || m.fullName.toLowerCase().includes(q))
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [members, task?.followerIds, followerSearch]);
  const filteredChecklistAssigneeMembers = useMemo(() => {
    const q = checklistAssigneeSearch.trim().toLowerCase();
    if (!q) return members;
    return members.filter((m) => m.fullName.toLowerCase().includes(q));
  }, [members, checklistAssigneeSearch]);

  const filteredChecklistAssignAllMembers = useMemo(() => {
    const q = checklistAssignAllSearch.trim().toLowerCase();
    if (!q) return members;
    return members.filter((m) => m.fullName.toLowerCase().includes(q));
  }, [members, checklistAssignAllSearch]);

  const checklistTotals = useMemo(() => {
    const totalItems = checklists.reduce((sum, c) => sum + c.itemCount, 0);
    const totalChecked = checklists.reduce((sum, c) => sum + c.checkedCount, 0);
    return {
      totalItems,
      totalChecked,
      open: totalItems - totalChecked,
      pct: totalItems > 0 ? (totalChecked / totalItems) * 100 : 0,
    };
  }, [checklists]);

  const imageAttachments = useMemo(
    () => attachments.filter((a) => a.mimeType?.startsWith("image/")),
    [attachments]
  );
  const fileAttachments = useMemo(
    () => attachments.filter((a) => !a.mimeType?.startsWith("image/")),
    [attachments]
  );
  const shareCandidates = useMemo(() => {
    const q = shareSearch.trim().toLowerCase();
    if (!q) return members;
    return members.filter(
      (m) =>
        m.fullName.toLowerCase().includes(q) ||
        m.email.toLowerCase().includes(q)
    );
  }, [members, shareSearch]);

  async function handleDescriptionSave() {
    if (description === (task?.description ?? "")) return;
    const updated = await persistPatch({ description });
    if (updated) toast.success("Description saved");
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
      await refreshActivity();
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
      await refreshActivity();
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

  async function handleCreateChecklist() {
    if (!taskId || !ready || !accessToken || !workspaceId) return;
    setChecklistBusy(true);
    try {
      const created = await addChecklist(accessToken, workspaceId, taskId, {
        name: `Checklist ${checklists.length + 1}`,
      });
      setChecklists((rows) => [...rows, created]);
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not create checklist");
    } finally {
      setChecklistBusy(false);
    }
  }

  async function handleRemoveChecklist(checklistId: string) {
    if (!taskId || !ready || !accessToken || !workspaceId) return;
    try {
      await deleteChecklist(accessToken, workspaceId, taskId, checklistId);
      setChecklists((rows) => rows.filter((c) => c.id !== checklistId));
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete checklist");
    }
  }

  async function handleAddChecklistItem(checklistId: string) {
    const text = (checklistItemInput[checklistId] ?? "").trim();
    if (!text || !taskId || !ready || !accessToken || !workspaceId) return;
    try {
      const item = await addChecklistItem(
        accessToken,
        workspaceId,
        taskId,
        checklistId,
        { text, assigneeId: checklistDraftAssignee[checklistId] ?? null }
      );
      setChecklists((rows) =>
        rows.map((c) =>
          c.id === checklistId
            ? {
                ...c,
                items: [...c.items, item],
                itemCount: c.itemCount + 1,
              }
            : c
        )
      );
      setChecklistItemInput((prev) => ({ ...prev, [checklistId]: "" }));
      setChecklistDraftAssignee((prev) => ({ ...prev, [checklistId]: null }));
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not add item");
    }
  }

  async function handleAssignChecklistItem(
    checklistId: string,
    itemId: string,
    userId: string | null
  ) {
    if (!taskId || !ready || !accessToken || !workspaceId) return;
    const assignee = userId ? members.find((m) => m.id === userId) : undefined;
    try {
      await updateChecklistItem(
        accessToken,
        workspaceId,
        taskId,
        checklistId,
        itemId,
        { assigneeId: userId }
      );
      setChecklists((rows) =>
        rows.map((c) =>
          c.id === checklistId
            ? {
                ...c,
                items: c.items.map((i) =>
                  i.id === itemId
                    ? {
                        ...i,
                        assigneeId: userId,
                        assigneeName: assignee?.fullName ?? null,
                      }
                    : i
                ),
              }
            : c
        )
      );
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not assign item");
    } finally {
      setChecklistAssigneeOpen(null);
      setChecklistAssigneeSearch("");
    }
  }

  function pickChecklistDraftAssignee(checklistId: string, userId: string) {
    setChecklistDraftAssignee((prev) => ({
      ...prev,
      [checklistId]: prev[checklistId] === userId ? null : userId,
    }));
    setChecklistAssigneeOpen(null);
    setChecklistAssigneeSearch("");
  }

  function focusChecklistComposer(checklistId: string) {
    setTimeout(() => {
      document
        .getElementById(`task-checklist-draft-input-${checklistId}`)
        ?.focus();
    }, 0);
  }

  function openRenameChecklist(checklistId: string, currentName: string) {
    setChecklistRenameTarget({ type: "checklist", checklistId });
    setChecklistRenameValue(currentName);
  }

  function openRenameChecklistItem(
    checklistId: string,
    itemId: string,
    currentText: string
  ) {
    setChecklistRenameTarget({ type: "item", checklistId, itemId });
    setChecklistRenameValue(currentText);
  }

  async function submitChecklistRename(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = checklistRenameValue.trim();
    const target = checklistRenameTarget;
    if (!trimmed || !target || !taskId || !ready || !accessToken || !workspaceId) return;
    try {
      if (target.type === "checklist") {
        await updateChecklist(accessToken, workspaceId, taskId, target.checklistId, {
          name: trimmed,
        });
        setChecklists((rows) =>
          rows.map((c) =>
            c.id === target.checklistId ? { ...c, name: trimmed } : c
          )
        );
      } else {
        await updateChecklistItem(
          accessToken,
          workspaceId,
          taskId,
          target.checklistId,
          target.itemId,
          { text: trimmed }
        );
        setChecklists((rows) =>
          rows.map((c) =>
            c.id === target.checklistId
              ? {
                  ...c,
                  items: c.items.map((i) =>
                    i.id === target.itemId ? { ...i, text: trimmed } : i
                  ),
                }
              : c
          )
        );
      }
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not rename");
    } finally {
      setChecklistRenameTarget(null);
      setChecklistRenameValue("");
    }
  }

  async function handleCheckAllChecklist(checklistId: string) {
    if (!taskId || !ready || !accessToken || !workspaceId) return;
    const checklist = checklists.find((c) => c.id === checklistId);
    if (!checklist || checklist.items.length === 0) return;
    try {
      await Promise.all(
        checklist.items
          .filter((i) => !i.isChecked)
          .map((i) =>
            updateChecklistItem(accessToken, workspaceId, taskId, checklistId, i.id, {
              isChecked: true,
            })
          )
      );
      setChecklists((rows) =>
        rows.map((c) =>
          c.id === checklistId
            ? {
                ...c,
                checkedCount: c.items.length,
                items: c.items.map((i) => ({ ...i, isChecked: true })),
              }
            : c
        )
      );
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not check all items");
    }
  }

  async function handleUncheckAllChecklist(checklistId: string) {
    if (!taskId || !ready || !accessToken || !workspaceId) return;
    const checklist = checklists.find((c) => c.id === checklistId);
    if (!checklist || checklist.items.length === 0) return;
    try {
      await Promise.all(
        checklist.items
          .filter((i) => i.isChecked)
          .map((i) =>
            updateChecklistItem(accessToken, workspaceId, taskId, checklistId, i.id, {
              isChecked: false,
            })
          )
      );
      setChecklists((rows) =>
        rows.map((c) =>
          c.id === checklistId
            ? {
                ...c,
                checkedCount: 0,
                items: c.items.map((i) => ({ ...i, isChecked: false })),
              }
            : c
        )
      );
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not uncheck all items");
    }
  }

  async function handleAssignAllChecklist(checklistId: string, userId: string) {
    if (!taskId || !ready || !accessToken || !workspaceId) return;
    const checklist = checklists.find((c) => c.id === checklistId);
    if (!checklist || checklist.items.length === 0) return;
    const assignee = members.find((m) => m.id === userId);
    try {
      await Promise.all(
        checklist.items.map((i) =>
          updateChecklistItem(accessToken, workspaceId, taskId, checklistId, i.id, {
            assigneeId: userId,
          })
        )
      );
      setChecklists((rows) =>
        rows.map((c) =>
          c.id === checklistId
            ? {
                ...c,
                items: c.items.map((i) => ({
                  ...i,
                  assigneeId: userId,
                  assigneeName: assignee?.fullName ?? i.assigneeName,
                })),
              }
            : c
        )
      );
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not assign all items");
    } finally {
      setChecklistAssignAllOpen(null);
      setChecklistAssignAllSearch("");
    }
  }

  function handleUnassignAllChecklist(checklistId: string) {
    const checklist = checklists.find((c) => c.id === checklistId);
    if (!checklist || checklist.items.length === 0) return;
    setUnassignAllChecklistId(checklistId);
  }

  async function confirmUnassignAllChecklist() {
    const checklistId = unassignAllChecklistId;
    setUnassignAllChecklistId(null);
    if (!checklistId || !taskId || !ready || !accessToken || !workspaceId) return;
    const checklist = checklists.find((c) => c.id === checklistId);
    if (!checklist) return;
    try {
      await Promise.all(
        checklist.items.map((i) =>
          updateChecklistItem(accessToken, workspaceId, taskId, checklistId, i.id, {
            assigneeId: null,
          })
        )
      );
      setChecklists((rows) =>
        rows.map((c) =>
          c.id === checklistId
            ? {
                ...c,
                items: c.items.map((i) => ({
                  ...i,
                  assigneeId: null,
                  assigneeName: null,
                })),
              }
            : c
        )
      );
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not unassign all items");
    }
  }

  async function handleToggleChecklistItem(
    checklistId: string,
    itemId: string,
    isChecked: boolean
  ) {
    if (!taskId || !ready || !accessToken || !workspaceId) return;
    try {
      await updateChecklistItem(
        accessToken,
        workspaceId,
        taskId,
        checklistId,
        itemId,
        { isChecked }
      );
      setChecklists((rows) =>
        rows.map((c) =>
          c.id === checklistId
            ? {
                ...c,
                checkedCount: c.checkedCount + (isChecked ? 1 : -1),
                items: c.items.map((i) =>
                  i.id === itemId ? { ...i, isChecked } : i
                ),
              }
            : c
        )
      );
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update item");
    }
  }

  async function handleRemoveChecklistItem(checklistId: string, itemId: string) {
    if (!taskId || !ready || !accessToken || !workspaceId) return;
    try {
      await deleteChecklistItem(accessToken, workspaceId, taskId, checklistId, itemId);
      setChecklists((rows) =>
        rows.map((c) =>
          c.id === checklistId
            ? {
                ...c,
                itemCount: c.itemCount - 1,
                items: c.items.filter((i) => i.id !== itemId),
              }
            : c
        )
      );
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not remove item");
    }
  }

  async function handleNameBlur() {
    const trimmed = name.trim();
    if (!trimmed || trimmed === task?.name) return;
    await persistPatch({ name: trimmed });
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
      ...(prev ?? {}),
      ...updated,
      comments: updated.comments ?? prev?.comments ?? [],
      subtasks: updated.subtasks ?? prev?.subtasks ?? [],
      attachments: updated.attachments ?? prev?.attachments ?? [],
    }));
    setTimeEstimateMinutes(updated.timeEstimateMinutes ?? null);
    if (updated.dueDateIso !== undefined) {
      setDueInput(updated.dueDateIso ? updated.dueDateIso.slice(0, 10) : "");
    }
    if (updated.startDateIso !== undefined) {
      setStartInput(updated.startDateIso ? updated.startDateIso.slice(0, 10) : "");
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

  async function toggleFollower(userId: string) {
    if (!userId) return;
    const current = task?.followerIds ?? [];
    const isFollower = current.includes(userId);
    const next = isFollower
      ? current.filter((id) => id !== userId)
      : [...current, userId];
    const updated = await persistPatch({ followerIds: next });
    if (!updated) return;
    if (userId === currentUserId) {
      toast.success(isFollower ? "Unfollowed task" : "Following task");
    } else {
      toast.success(isFollower ? "Removed follower" : "Added follower");
    }
  }

  async function handleToggleArchive() {
    if (!taskId || !ready || !accessToken || !workspaceId) return;
    setArchiveBusy(true);
    try {
      if (statusColumns?.length) {
        const archiveStatus = statusColumns.find(
          (s) =>
            s.statusGroup === "CLOSED" ||
            (s.legacyKey ?? "").toUpperCase() === "CLOSED"
        );
        const activeStatus =
          statusColumns.find(
            (s) =>
              (s.legacyKey ?? "").toUpperCase() === "TODO" ||
              (s.legacyKey ?? "").toUpperCase() === "OPEN"
          ) ??
          statusColumns.find((s) => s.statusGroup === "ACTIVE") ??
          statusColumns.find((s) => s.statusGroup !== "CLOSED");
        const target = isArchived ? activeStatus : archiveStatus;
        if (!target) {
          toast.error(
            isArchived
              ? "No active status configured for this list"
              : "No archived/closed status configured for this list"
          );
          return;
        }
        setStatusId(target.id);
        if (target.legacyKey) setStatusKey(target.legacyKey as TaskStatusKey);
        await persistPatch({ statusId: target.id });
      } else {
        await persistPatch({ status: isArchived ? "TODO" : "DONE" });
      }
      toast.success(isArchived ? "Task unarchived" : "Task archived");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update archive state");
    } finally {
      setArchiveBusy(false);
    }
  }

  function buildTaskShareUrl(isPublic = false) {
    if (!taskId || typeof window === "undefined") return "";
    const origin = window.location.origin;
    if (isPublic) {
      return `${origin}${appPath(`/home/tasks/${taskId}?share=public`)}`;
    }
    if (task?.listId) {
      return `${origin}${appPath(`/spaces/l/${task.listId}?task=${taskId}`)}`;
    }
    return `${origin}${appPath(`/home/tasks/${taskId}`)}`;
  }

  async function handleCopyTaskLink(isPublic = false) {
    const href = buildTaskShareUrl(isPublic);
    if (!href) return;
    try {
      await navigator.clipboard.writeText(href);
      toast.success(isPublic ? "Public link copied" : "Task link copied");
    } catch {
      toast.error("Could not copy link");
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
            <div className="ml-auto flex items-center gap-1 mr-3">
              {task?.createdAt ? (
                <span className="mr-2 text-xs text-muted-foreground">
                  Created {formatCreatedLabel(task.createdAt)}
                </span>
              ) : null}
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Share"
                      onClick={() => setShareOpen(true)}
                    >
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
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>Task actions</DropdownMenuLabel>
                  <DropdownMenuItem
                    disabled={archiveBusy || !task}
                    onClick={() => void handleToggleArchive()}
                  >
                    <ArchiveIcon className="mr-2 size-4" />
                    {isArchived ? "Unarchive task" : "Archive task"}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={() => setDeleteOpen(true)}
                    disabled={!task}
                  >
                    <Trash2Icon className="mr-2 size-4" />
                    Delete task
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    disabled={lineupBusy || !task}
                    onClick={() => void handleToggleLineup()}
                  >
                    {inLineup ? "Remove from LineUp" : "Add to LineUp"}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    disabled={saving || !task || !currentUserId}
                    onClick={() => void toggleFollower(currentUserId ?? "")}
                  >
                    {following ? "Unfollow" : "Follow"}
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
                <div className="mb-5 flex items-start gap-1">
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
                  className="mb-2 w-full resize-none border-0 bg-transparent text-3xl leading-snug font-semibold outline-none placeholder:text-muted-foreground"
                  placeholder="Task name"
                />

                <div className="grid grid-cols-[minmax(6rem,8rem)_1fr_minmax(6rem,8rem)_1fr] gap-x-4 gap-y-1 text-xs">
                  <PropertyLabel icon={StatusIcon}>Status</PropertyLabel>
                  <PropertyValue>
                    {statusColumns ? (
                      <Popover open={statusOpen} onOpenChange={setStatusOpen}>
                        <PopoverTrigger
                          render={
                            <button
                              type="button"
                              className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-bold tracking-wide text-white uppercase"
                              style={{
                                backgroundColor:
                                  selectedStatus?.color ?? task.statusColor,
                              }}
                            >
                              <StatusIcon className="size-3" />
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
                        className="inline-flex rounded-md px-2 py-1 text-[11px] font-bold text-white uppercase"
                        style={{ backgroundColor: task.statusColor }}
                      >
                        {task.status}
                      </span>
                    )}
                  </PropertyValue>

                  <PropertyLabel icon={UsersIcon}>Assignees</PropertyLabel>
                  <PropertyValue className="h-auto min-h-8 w-full">
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
                            className="flex min-h-7 w-full flex-wrap items-center gap-1.5"
                          >
                            {selectedAssignees.length === 0 ? (
                              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                <UserPlusIcon className="size-3.5" />
                                Empty
                              </span>
                            ) : (
                              selectedAssignees.map((m) => {
                                const isDeactivated =
                                  task?.disabledAssigneeIds?.includes(m.id);
                                return (
                                  <span
                                    key={m.id}
                                    className="flex items-center gap-1.5 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium"
                                  >
                                    <Avatar
                                      className={cn(
                                        "size-5",
                                        isDeactivated && "opacity-50"
                                      )}
                                    >
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
                                    {isDeactivated && (
                                      <span className="text-destructive">
                                        (deactivated)
                                      </span>
                                    )}
                                  </span>
                                );
                              })
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
                                    {m.isDisabled ? (
                                      <span className="text-destructive"> (deactivated)</span>
                                    ) : null}
                                  </span>
                                </button>
                              </li>
                            );
                          })}
                        </ul>
                      </PopoverContent>
                    </Popover>
                  </PropertyValue>

                  <PropertyLabel icon={CalendarIcon}>Dates</PropertyLabel>
                  <PropertyValue>
                    <TaskDatesField
                      startDateIso={task?.startDateIso}
                      dueDateIso={task?.dueDateIso}
                      onStartChange={handleStartChange}
                      onDueChange={handleDueChange}
                    />
                  </PropertyValue>

                  <PropertyLabel icon={FlagIcon}>Priority</PropertyLabel>
                  <PropertyValue>
                    <Popover open={priorityOpen} onOpenChange={setPriorityOpen}>
                      <PopoverTrigger
                        render={
                          <button
                            type="button"
                            className="inline-flex items-center gap-1.5 text-xs"
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
                  </PropertyValue>

                  <PropertyLabel icon={HourglassIcon}>Time estimate</PropertyLabel>
                  <PropertyValue>
                    <TaskTimeEstimateField
                      minutes={timeEstimateMinutes}
                      onChange={handleTimeEstimateChange}
                    />
                  </PropertyValue>

                </div>

                <div className="mt-8 border-t border-border pt-6">
                  <div className="mb-3 flex items-center gap-2 text-sm font-medium">
                    <ListChecksIcon className="size-4 text-muted-foreground" />
                    Description
                  </div>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={5}
                    placeholder="Add description"
                    className="min-h-[120px] w-full resize-y rounded-lg border border-transparent bg-muted/30 px-4 py-3 text-sm leading-relaxed outline-none focus:border-border"
                  />
                  <div className="mt-2 flex justify-end">
                    <Button
                      type="button"
                      size="sm"
                      loading={saving}
                      disabled={description === (task?.description ?? "")}
                      onClick={() => void handleDescriptionSave()}
                    >
                      Save
                    </Button>
                  </div>
                </div>

                {attachments.length > 0 ? (
                  <div className="mt-6 border-t border-border pt-4">
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-sm font-medium">Attachments</p>
                      <button
                        type="button"
                        className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-60"
                        disabled={attachBusy}
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <PaperclipIcon className="size-3.5" />
                        {attachBusy ? "Uploading…" : "Attach"}
                      </button>
                      <input
                        ref={fileInputRef}
                        type="file"
                        multiple
                        className="hidden"
                        onChange={(e) => void handleAttachFiles(e.target.files)}
                      />
                    </div>

                    {imageAttachments.length > 0 ? (
                      <div className="mb-3">
                        {galleryExpanded || imageAttachments.length === 1 ? (
                          <div className="flex flex-wrap gap-3">
                            {imageAttachments.map((file) => (
                              <CommentAttachmentCard key={file.id} attachment={file} />
                            ))}
                          </div>
                        ) : (
                          <div className="relative w-full max-w-sm overflow-hidden rounded-lg border border-border">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={imageAttachments[0].downloadUrl ?? ""}
                              alt={imageAttachments[0].fileName}
                              className="aspect-video w-full object-cover"
                            />
                            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-black/70 to-transparent" />
                            <button
                              type="button"
                              onClick={() => setGalleryExpanded(true)}
                              className="absolute bottom-2 right-2 flex items-center gap-1 rounded-md bg-black/50 px-2 py-1 text-xs font-medium text-white backdrop-blur-sm hover:bg-black/70"
                            >
                              1/{imageAttachments.length}
                              <ChevronDownIcon className="size-3.5" />
                            </button>
                          </div>
                        )}
                        {galleryExpanded && imageAttachments.length > 1 ? (
                          <button
                            type="button"
                            onClick={() => setGalleryExpanded(false)}
                            className="mt-2 flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
                          >
                            <ChevronUpIcon className="size-3.5" />
                            Collapse
                          </button>
                        ) : null}
                      </div>
                    ) : null}

                    {fileAttachments.length > 0 ? (
                      <div className="flex flex-wrap gap-3">
                        {fileAttachments.map((file) => (
                          <CommentAttachmentCard key={file.id} attachment={file} />
                        ))}
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    className="hidden"
                    onChange={(e) => void handleAttachFiles(e.target.files)}
                  />
                )}

                {FEATURE_FLAGS.subtasks && (subtasks.length > 0 || subtaskOpen) && (
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

                {FEATURE_FLAGS.subtasks && subtaskOpen ? (
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

                {checklists.length > 0 ? (
                  <div className="mt-6 border-t border-border pt-4">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setChecklistsSectionOpen((o) => !o)}
                        className="shrink-0 text-muted-foreground hover:text-foreground"
                        aria-label={
                          checklistsSectionOpen ? "Collapse checklists" : "Expand checklists"
                        }
                      >
                        <ChevronDownIcon
                          className={cn(
                            "size-3.5 transition-transform",
                            !checklistsSectionOpen && "-rotate-90"
                          )}
                        />
                      </button>
                      <span className="text-sm font-semibold">Checklists</span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {checklistTotals.open} open
                      </span>
                      <div className="h-1 flex-1 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-muted-foreground/50"
                          style={{ width: `${checklistTotals.pct}%` }}
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => void handleCreateChecklist()}
                        disabled={checklistBusy}
                        className="shrink-0 rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-60"
                        aria-label="Add checklist"
                      >
                        <PlusIcon className="size-3.5" />
                      </button>
                    </div>

                    {checklistsSectionOpen ? (
                      <div className="mt-3 space-y-3">
                        {checklists.map((checklist) => (
                          <div
                            key={checklist.id}
                            className="overflow-hidden rounded-md border border-border"
                          >
                            <div className="group flex items-center justify-between px-4 py-1.5">
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs font-semibold text-foreground">
                                  {checklist.name}
                                </span>
                                <span className="text-[11px] text-muted-foreground">
                                  {checklist.checkedCount} of {checklist.itemCount}
                                </span>
                              </div>
                              <div className="relative opacity-0 group-hover:opacity-100">
                                <DropdownMenu>
                              <DropdownMenuTrigger
                                render={
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="h-5 px-1"
                                    aria-label="Checklist options"
                                  >
                                    <MoreHorizontalIcon className="size-3" />
                                  </Button>
                                }
                              />
                              <DropdownMenuContent align="end" className="min-w-48">
                                <DropdownMenuItem
                                  onClick={() => focusChecklistComposer(checklist.id)}
                                  className="text-xs gap-2 whitespace-nowrap"
                                >
                                  <PlusIcon className="size-3.5 shrink-0" />
                                  Add Item
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() =>
                                    openRenameChecklist(checklist.id, checklist.name)
                                  }
                                  className="text-xs gap-2 whitespace-nowrap"
                                >
                                  <Edit2Icon className="size-3.5 shrink-0" />
                                  Rename checklist
                                </DropdownMenuItem>
                                {checklist.items.length > 0 ? (
                                  <>
                                    <DropdownMenuSeparator className="my-1" />
                                    <DropdownMenuItem
                                      onClick={() =>
                                        setChecklistAssignAllOpen(checklist.id)
                                      }
                                      className="text-xs gap-2 whitespace-nowrap"
                                    >
                                      <UserPlusIcon className="size-3.5 shrink-0" />
                                      Assign all to
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      onClick={() =>
                                        handleUnassignAllChecklist(checklist.id)
                                      }
                                      className="text-xs gap-2 whitespace-nowrap"
                                    >
                                      <UserMinusIcon className="size-3.5 shrink-0" />
                                      Unassign all
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      onClick={() =>
                                        void handleCheckAllChecklist(checklist.id)
                                      }
                                      className="text-xs gap-2 whitespace-nowrap"
                                    >
                                      <CheckCircle2Icon className="size-3.5 shrink-0" />
                                      Check All
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      onClick={() =>
                                        void handleUncheckAllChecklist(checklist.id)
                                      }
                                      className="text-xs gap-2 whitespace-nowrap"
                                    >
                                      <CircleIcon className="size-3.5 shrink-0" />
                                      Uncheck All
                                    </DropdownMenuItem>
                                  </>
                                ) : null}
                                <DropdownMenuSeparator className="my-1" />
                                <DropdownMenuItem
                                  onClick={() => void handleRemoveChecklist(checklist.id)}
                                  className="text-xs gap-2 whitespace-nowrap text-destructive"
                                >
                                  <Trash2Icon className="size-3.5 shrink-0" />
                                  Delete checklist
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                            <Popover
                              open={checklistAssignAllOpen === checklist.id}
                              onOpenChange={(open) => {
                                if (!open) {
                                  setChecklistAssignAllOpen(null);
                                  setChecklistAssignAllSearch("");
                                }
                              }}
                            >
                              <PopoverTrigger
                                render={
                                  <span className="absolute right-0 top-full h-0 w-0" />
                                }
                              />
                              <PopoverContent align="end" className="w-64 p-2">
                                <div className="relative mb-2">
                                  <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
                                  <Input
                                    value={checklistAssignAllSearch}
                                    onChange={(e) =>
                                      setChecklistAssignAllSearch(e.target.value)
                                    }
                                    placeholder="Search people…"
                                    className="h-8 pl-8"
                                    autoFocus
                                  />
                                </div>
                                <ul className="max-h-48 space-y-0.5 overflow-y-auto">
                                  {filteredChecklistAssignAllMembers.length === 0 ? (
                                    <li className="px-2 py-3 text-center text-xs text-muted-foreground">
                                      No people found
                                    </li>
                                  ) : (
                                    filteredChecklistAssignAllMembers.map((m) => (
                                      <li key={m.id}>
                                        <button
                                          type="button"
                                          className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-muted"
                                          onClick={() =>
                                            void handleAssignAllChecklist(checklist.id, m.id)
                                          }
                                        >
                                          <Avatar className="size-6">
                                            <AvatarFallback
                                              className={cn(
                                                "text-[10px] font-semibold",
                                                avatarColorClassForKey(m.id, m.fullName)
                                              )}
                                            >
                                              {avatarInitialFromName(m.fullName)}
                                            </AvatarFallback>
                                          </Avatar>
                                          <span className="min-w-0 flex-1 truncate">
                                            {m.fullName}
                                          </span>
                                        </button>
                                      </li>
                                    ))
                                  )}
                                </ul>
                              </PopoverContent>
                            </Popover>
                          </div>
                        </div>
                        <div>
                          {checklistItemsExpanded
                            ? checklist.items.map((item) => {
                                const assignee = members.find(
                                  (m) => m.id === item.assigneeId
                                );
                                return (
                                  <div
                                    key={item.id}
                                    className="group flex items-center gap-1.5 px-4 py-1.5 hover:bg-muted/30"
                                  >
                                    <button
                                      type="button"
                                      onClick={() =>
                                        void handleToggleChecklistItem(
                                          checklist.id,
                                          item.id,
                                          !item.isChecked
                                        )
                                      }
                                      className="shrink-0 text-muted-foreground hover:text-foreground"
                                      aria-label={
                                        item.isChecked ? "Mark incomplete" : "Mark complete"
                                      }
                                    >
                                      {item.isChecked ? (
                                        <CheckCircle2Icon className="size-3.5 text-primary" />
                                      ) : (
                                        <CircleIcon className="size-3.5" />
                                      )}
                                    </button>
                                    <span
                                      className={cn(
                                        "min-w-0 flex-1 truncate text-xs",
                                        item.isChecked && "line-through text-muted-foreground"
                                      )}
                                    >
                                      {item.text}
                                    </span>
                                    <DropdownMenu>
                                      <DropdownMenuTrigger
                                        render={
                                          <button
                                            type="button"
                                            className="shrink-0 rounded p-0.5 text-muted-foreground opacity-0 hover:bg-muted hover:text-foreground group-hover:opacity-100"
                                            aria-label="Item options"
                                          >
                                            <MoreHorizontalIcon className="size-3" />
                                          </button>
                                        }
                                      />
                                      <DropdownMenuContent align="end" className="min-w-48">
                                        <DropdownMenuItem
                                          onClick={() => focusChecklistComposer(checklist.id)}
                                          className="text-xs gap-2 whitespace-nowrap"
                                        >
                                          <PlusIcon className="size-3.5 shrink-0" />
                                          Add Item
                                        </DropdownMenuItem>
                                        <DropdownMenuItem
                                          onClick={() =>
                                            openRenameChecklistItem(
                                              checklist.id,
                                              item.id,
                                              item.text
                                            )
                                          }
                                          className="text-xs gap-2 whitespace-nowrap"
                                        >
                                          <Edit2Icon className="size-3.5 shrink-0" />
                                          Rename
                                        </DropdownMenuItem>
                                        <DropdownMenuItem
                                          onClick={() =>
                                            void handleRemoveChecklistItem(checklist.id, item.id)
                                          }
                                          className="text-xs gap-2 whitespace-nowrap text-destructive"
                                        >
                                          <Trash2Icon className="size-3.5 shrink-0" />
                                          Delete
                                        </DropdownMenuItem>
                                      </DropdownMenuContent>
                                    </DropdownMenu>
                                    <Popover
                                      open={checklistAssigneeOpen === item.id}
                                      onOpenChange={(open) => {
                                        if (!open) {
                                          setChecklistAssigneeOpen(null);
                                          setChecklistAssigneeSearch("");
                                        }
                                      }}
                                    >
                                      <PopoverTrigger
                                        render={
                                          <button
                                            type="button"
                                            className="shrink-0 rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                                            aria-label="Assign to"
                                            onClick={() => setChecklistAssigneeOpen(item.id)}
                                          >
                                            {assignee ? (
                                              <Avatar className="size-4">
                                                <AvatarFallback
                                                  className={cn(
                                                    "text-[8px] font-semibold",
                                                    avatarColorClassForKey(
                                                      assignee.id,
                                                      assignee.fullName
                                                    )
                                                  )}
                                                >
                                                  {avatarInitialFromName(assignee.fullName)}
                                                </AvatarFallback>
                                              </Avatar>
                                            ) : (
                                              <UserPlusIcon className="size-3" />
                                            )}
                                          </button>
                                        }
                                      />
                                      <PopoverContent align="end" className="w-64 p-2">
                                        <div className="relative mb-2">
                                          <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
                                          <Input
                                            value={checklistAssigneeSearch}
                                            onChange={(e) =>
                                              setChecklistAssigneeSearch(e.target.value)
                                            }
                                            placeholder="Search people…"
                                            className="h-8 pl-8"
                                            autoFocus
                                          />
                                        </div>
                                        <ul className="max-h-48 space-y-0.5 overflow-y-auto">
                                          {filteredChecklistAssigneeMembers.length === 0 ? (
                                            <li className="px-2 py-3 text-center text-xs text-muted-foreground">
                                              No people found
                                            </li>
                                          ) : (
                                            filteredChecklistAssigneeMembers.map((m) => {
                                              const checked = item.assigneeId === m.id;
                                              return (
                                                <li key={m.id}>
                                                  <button
                                                    type="button"
                                                    className={cn(
                                                      "flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-muted",
                                                      checked && "bg-primary/5"
                                                    )}
                                                    onClick={() =>
                                                      void handleAssignChecklistItem(
                                                        checklist.id,
                                                        item.id,
                                                        checked ? null : m.id
                                                      )
                                                    }
                                                  >
                                                    <Avatar className="size-6">
                                                      <AvatarFallback
                                                        className={cn(
                                                          "text-[10px] font-semibold",
                                                          avatarColorClassForKey(
                                                            m.id,
                                                            m.fullName
                                                          )
                                                        )}
                                                      >
                                                        {avatarInitialFromName(m.fullName)}
                                                      </AvatarFallback>
                                                    </Avatar>
                                                    <span className="min-w-0 flex-1 truncate">
                                                      {m.fullName}
                                                    </span>
                                                    {checked && (
                                                      <CheckCircle2Icon className="size-4 text-primary" />
                                                    )}
                                                  </button>
                                                </li>
                                              );
                                            })
                                          )}
                                        </ul>
                                      </PopoverContent>
                                    </Popover>
                                  </div>
                                );
                              })
                            : null}
                          <div className="flex items-center gap-1 px-4 py-1.5 hover:bg-muted/30">
                            <button
                              type="button"
                              onClick={() => void handleAddChecklistItem(checklist.id)}
                              disabled={!(checklistItemInput[checklist.id] ?? "").trim()}
                              className="shrink-0 text-muted-foreground hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
                              aria-label="Add item"
                            >
                              <PlusIcon className="size-3.5" />
                            </button>
                            <Input
                              id={`task-checklist-draft-input-${checklist.id}`}
                              value={checklistItemInput[checklist.id] ?? ""}
                              onChange={(e) =>
                                setChecklistItemInput((prev) => ({
                                  ...prev,
                                  [checklist.id]: e.target.value,
                                }))
                              }
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  void handleAddChecklistItem(checklist.id);
                                }
                              }}
                              placeholder="Add item"
                              className="h-7 flex-1 border-0 bg-transparent px-0 text-xs shadow-none placeholder:text-xs focus-visible:ring-0 dark:bg-transparent"
                            />
                            <Popover
                              open={checklistAssigneeOpen === checklist.id}
                              onOpenChange={(open) => {
                                if (!open) {
                                  setChecklistAssigneeOpen(null);
                                  setChecklistAssigneeSearch("");
                                }
                              }}
                            >
                              <PopoverTrigger
                                render={
                                  <button
                                    type="button"
                                    className="shrink-0 rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                                    aria-label="Pick assignee"
                                    onClick={() => setChecklistAssigneeOpen(checklist.id)}
                                  >
                                    {checklistDraftAssignee[checklist.id] ? (
                                      (() => {
                                        const draftAssignee = members.find(
                                          (m) => m.id === checklistDraftAssignee[checklist.id]
                                        );
                                        return draftAssignee ? (
                                          <Avatar className="size-3.5">
                                            <AvatarFallback
                                              className={cn(
                                                "text-[7px] font-semibold",
                                                avatarColorClassForKey(
                                                  draftAssignee.id,
                                                  draftAssignee.fullName
                                                )
                                              )}
                                            >
                                              {avatarInitialFromName(draftAssignee.fullName)}
                                            </AvatarFallback>
                                          </Avatar>
                                        ) : (
                                          <UserPlusIcon className="size-3" />
                                        );
                                      })()
                                    ) : (
                                      <UserPlusIcon className="size-3" />
                                    )}
                                  </button>
                                }
                              />
                              <PopoverContent align="end" className="w-64 p-2">
                                <div className="relative mb-2">
                                  <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
                                  <Input
                                    value={checklistAssigneeSearch}
                                    onChange={(e) =>
                                      setChecklistAssigneeSearch(e.target.value)
                                    }
                                    placeholder="Search people…"
                                    className="h-8 pl-8"
                                    autoFocus
                                  />
                                </div>
                                <ul className="max-h-48 space-y-0.5 overflow-y-auto">
                                  {filteredChecklistAssigneeMembers.length === 0 ? (
                                    <li className="px-2 py-3 text-center text-xs text-muted-foreground">
                                      No people found
                                    </li>
                                  ) : (
                                    filteredChecklistAssigneeMembers.map((m) => {
                                      const checked =
                                        checklistDraftAssignee[checklist.id] === m.id;
                                      return (
                                        <li key={m.id}>
                                          <button
                                            type="button"
                                            className={cn(
                                              "flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-muted",
                                              checked && "bg-primary/5"
                                            )}
                                            onClick={() =>
                                              pickChecklistDraftAssignee(checklist.id, m.id)
                                            }
                                          >
                                            <Avatar className="size-6">
                                              <AvatarFallback
                                                className={cn(
                                                  "text-[10px] font-semibold",
                                                  avatarColorClassForKey(m.id, m.fullName)
                                                )}
                                              >
                                                {avatarInitialFromName(m.fullName)}
                                              </AvatarFallback>
                                            </Avatar>
                                            <span className="min-w-0 flex-1 truncate">
                                              {m.fullName}
                                            </span>
                                            {checked && (
                                              <CheckCircle2Icon className="size-4 text-primary" />
                                            )}
                                          </button>
                                        </li>
                                      );
                                    })
                                  )}
                                </ul>
                              </PopoverContent>
                            </Popover>
                          </div>
                        </div>
                      </div>
                    ))}
                        <button
                          type="button"
                          onClick={() => void handleCreateChecklist()}
                          disabled={checklistBusy}
                          className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-60"
                        >
                          <PlusIcon className="size-3.5" />
                          Add checklist
                        </button>
                      </div>
                    ) : null}
                  </div>
                ) : null}

                <div className="mt-4 space-y-0.5">
                  {FEATURE_FLAGS.subtasks ? (
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
                      onClick={() => setSubtaskOpen(true)}
                    >
                      <PlusIcon className="size-4" />
                      Add subtask
                    </button>
                  ) : null}
                  {checklists.length === 0 ? (
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-60"
                      disabled={checklistBusy}
                      onClick={() => void handleCreateChecklist()}
                    >
                      <ListChecksIcon className="size-4" />
                      Create checklist
                    </button>
                  ) : null}
                </div>
              </div>

              <div className="flex w-[min(42%,520px)] min-w-[400px] shrink-0 flex-col border-l border-border bg-muted/20">
                <div className="flex items-center justify-between border-b border-border px-6 py-3.5">
                  <span className="text-sm font-semibold">Activity</span>
                  <div className="flex items-center gap-2">
                    {activitySearchOpen ? (
                      <Input
                        autoFocus
                        value={activitySearch}
                        onChange={(event) => setActivitySearch(event.target.value)}
                        placeholder="Search activity..."
                        className="h-8 w-[220px]"
                      />
                    ) : null}
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Search activity"
                      onClick={() => {
                        setActivitySearchOpen((prev) => {
                          const next = !prev;
                          if (!next) setActivitySearch("");
                          return next;
                        });
                      }}
                    >
                      <SearchIcon className="size-4" />
                    </Button>
                    <Popover
                      open={notificationsOpen}
                      onOpenChange={(next) => {
                        setNotificationsOpen(next);
                        if (!next) setFollowerSearch("");
                      }}
                    >
                      <PopoverTrigger
                        render={
                          <button
                            type="button"
                            aria-label="Followers"
                            className={cn(
                              "flex h-7 items-center gap-1 rounded-md px-1.5 text-xs font-medium transition-colors",
                              followerIds.length > 0
                                ? "bg-primary/15 text-primary hover:bg-primary/20"
                                : "text-muted-foreground hover:bg-muted"
                            )}
                          >
                            <BellIcon className="size-4" />
                            {followerIds.length > 0 ? followerIds.length : null}
                          </button>
                        }
                      />
                      <PopoverContent
                        align="end"
                        className="max-h-[420px] w-[320px] overflow-y-auto p-0"
                      >
                        <div className="p-1.5">
                          <button
                            type="button"
                            disabled={saving || !task}
                            className="flex w-full items-start gap-2.5 rounded-md px-2 py-2 text-left hover:bg-muted/60 disabled:opacity-60"
                            onClick={() => {
                              if (!following) void toggleFollower(currentUserId ?? "");
                            }}
                          >
                            <BellIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                            <span className="flex-1">
                              <span className="block text-sm font-medium">Follow</span>
                              <span className="block text-xs text-muted-foreground">
                                Notify me on all activity for this task.
                              </span>
                            </span>
                            {following ? (
                              <CheckIcon className="mt-0.5 size-4 shrink-0 text-primary" />
                            ) : null}
                          </button>
                          <button
                            type="button"
                            disabled={saving || !task}
                            className="flex w-full items-start gap-2.5 rounded-md px-2 py-2 text-left hover:bg-muted/60 disabled:opacity-60"
                            onClick={() => {
                              if (following) void toggleFollower(currentUserId ?? "");
                            }}
                          >
                            <BellOffIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                            <span className="flex-1">
                              <span className="block text-sm font-medium">Unfollow</span>
                              <span className="block text-xs text-muted-foreground">
                                Notify me only on @mentions or assignment.
                              </span>
                            </span>
                            {!following ? (
                              <CheckIcon className="mt-0.5 size-4 shrink-0 text-primary" />
                            ) : null}
                          </button>
                        </div>

                        <div className="border-t border-border p-2">
                          <div className="relative">
                            <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                              value={followerSearch}
                              onChange={(e) => setFollowerSearch(e.target.value)}
                              placeholder="Search Followers..."
                              className="h-8 pl-8"
                            />
                          </div>
                        </div>

                        <div className="px-2 pb-2">
                          <p className="px-1 pb-1 text-xs font-medium text-muted-foreground">
                            {followerMembers.length}{" "}
                            {followerMembers.length === 1 ? "follower" : "followers"}
                          </p>
                          {followerMembers.map((m) => (
                            <button
                              key={m.id}
                              type="button"
                              className="group/follower flex w-full items-center gap-2 rounded-md px-1.5 py-1.5 text-left hover:bg-muted/60"
                              onClick={() => void toggleFollower(m.id)}
                            >
                              <FollowerAvatar member={m} />
                              <span className="flex-1 truncate text-sm">
                                {m.id === currentUserId ? "Me" : m.fullName}
                                {m.id !== currentUserId && m.isDisabled ? (
                                  <span className="text-destructive"> (deactivated)</span>
                                ) : null}
                              </span>
                              <UserMinusIcon className="size-3.5 shrink-0 text-muted-foreground opacity-0 group-hover/follower:opacity-100" />
                            </button>
                          ))}
                        </div>

                        {nonFollowerMembers.length > 0 ? (
                          <div className="border-t border-border px-2 py-2">
                            <p className="px-1 pb-1 text-xs font-medium text-muted-foreground">
                              People
                            </p>
                            {nonFollowerMembers.map((m) => (
                              <button
                                key={m.id}
                                type="button"
                                className="flex w-full items-center gap-2 rounded-md px-1.5 py-1.5 text-left hover:bg-muted/60"
                                onClick={() => void toggleFollower(m.id)}
                              >
                                <FollowerAvatar member={m} />
                                <span className="flex-1 truncate text-sm">
                                  {m.fullName}
                                  {m.isDisabled ? (
                                    <span className="text-destructive"> (deactivated)</span>
                                  ) : null}
                                </span>
                                <UserPlusIcon className="size-3.5 shrink-0 text-muted-foreground" />
                              </button>
                            ))}
                          </div>
                        ) : null}
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
                  {(() => {
                    const hasHidden = activityFeed.length > 6;
                    const visible =
                      feedExpanded || !hasHidden
                        ? activityFeed
                        : activityFeed.slice(-6);
                    return (
                      <>
                        {hasHidden ? (
                          <button
                            type="button"
                            className="mb-1 flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
                            onClick={() => setFeedExpanded((v) => !v)}
                          >
                            {feedExpanded ? (
                              <ChevronUpIcon className="size-3.5" />
                            ) : (
                              <ChevronDownIcon className="size-3.5" />
                            )}
                            {feedExpanded
                              ? "Hide"
                              : `Show ${activityFeed.length - 6} earlier`}
                          </button>
                        ) : null}
                        {visible.map((item) =>
                          item.kind === "event" ? (
                            <ActivityEventRow key={item.event.id} event={item.event} />
                          ) : (
                            <TaskActivityComment
                              key={item.comment.id}
                              comment={item.comment}
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
                          )
                        )}
                      </>
                    );
                  })()}
                  {!activityFeed.length ? (
                    <p className="text-xs text-muted-foreground">No matching activity.</p>
                  ) : null}
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

      <Dialog
        open={checklistRenameTarget !== null}
        onOpenChange={(next) => {
          if (!next) {
            setChecklistRenameTarget(null);
            setChecklistRenameValue("");
          }
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {checklistRenameTarget?.type === "checklist"
                ? "Rename checklist"
                : "Rename item"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={submitChecklistRename} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="rename-task-checklist-value">Name</Label>
              <Input
                id="rename-task-checklist-value"
                value={checklistRenameValue}
                onChange={(e) => setChecklistRenameValue(e.target.value)}
                placeholder="Name"
                autoFocus
              />
            </div>
            <Button
              type="submit"
              className="w-full"
              disabled={!checklistRenameValue.trim()}
            >
              Save
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={unassignAllChecklistId !== null}
        onOpenChange={(next) => {
          if (!next) setUnassignAllChecklistId(null);
        }}
        title="Unassign all"
        description="Remove the assignee from every item in this checklist?"
        confirmLabel="Unassign all"
        confirmVariant="destructive"
        onConfirm={() => void confirmUnassignAllChecklist()}
      />

      <Dialog open={shareOpen} onOpenChange={setShareOpen}>
        <DialogContent className="min-w-[600px] gap-0 p-0" showCloseButton>
          <div className="border-b border-border px-5 py-4">
            <DialogTitle>Share task</DialogTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              Invite people and manage who can access this task.
            </p>
          </div>

          <div className="space-y-4 px-5 py-4">
            <div className="rounded-lg border border-border p-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-medium">Private link</p>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-8"
                  onClick={() => void handleCopyTaskLink(false)}
                >
                  <LinkIcon className="mr-1 size-3.5" />
                  Copy
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                People in your workspace with access can open this link.
              </p>
            </div>

            <div className="rounded-lg border border-border p-3">
              <div className="mb-2 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">Public sharing</p>
                  <p className="text-xs text-muted-foreground">
                    Anyone with the link can view this task.
                  </p>
                </div>
                <Switch
                  checked={publicShareEnabled}
                  onCheckedChange={(checked) =>
                    setPublicShareEnabled(Boolean(checked))
                  }
                />
              </div>
              <div className="flex justify-end">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-8"
                  disabled={!publicShareEnabled}
                  onClick={() => void handleCopyTaskLink(true)}
                >
                  <LinkIcon className="mr-1 size-3.5" />
                  Copy public link
                </Button>
              </div>
            </div>

            <div className="space-y-2 rounded-lg border border-border p-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">Invite people</p>
                <p className="text-xs text-muted-foreground">
                  {assigneeIds.length} shared
                </p>
              </div>
              <Input
                value={shareSearch}
                onChange={(e) => setShareSearch(e.target.value)}
                placeholder="Invite members by name or email..."
                className="h-9"
              />
              <div className="max-h-56 space-y-1 overflow-y-auto">
                {shareCandidates.map((member) => {
                  const shared = assigneeIds.includes(member.id);
                  const perm = sharePerms[member.id] ?? "edit";
                  return (
                    <div
                      key={member.id}
                      className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted/60"
                    >
                      <Avatar className="size-7">
                        <AvatarFallback
                          className={cn(
                            "text-[10px] text-white",
                            avatarColorClassForKey(member.id)
                          )}
                        >
                          {avatarInitialFromName(member.fullName)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {member.fullName}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {member.email}
                        </p>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          render={
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              className="h-7 px-2 text-xs capitalize"
                            >
                              {perm}
                              <ChevronDownIcon className="ml-1 size-3.5" />
                            </Button>
                          }
                        />
                        <DropdownMenuContent align="end">
                          {(["view", "comment", "edit"] as const).map((level) => (
                            <DropdownMenuItem
                              key={level}
                              onClick={() =>
                                setSharePerms((prev) => ({
                                  ...prev,
                                  [member.id]: level,
                                }))
                              }
                              className="capitalize"
                            >
                              {level}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                      <Button
                        type="button"
                        size="sm"
                        variant={shared ? "secondary" : "outline"}
                        className="h-7 px-2 text-xs"
                        onClick={() => void toggleAssignee(member.id)}
                      >
                        {shared ? "Shared" : "Share"}
                      </Button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
          <div className="border-t border-border px-5 py-3">
            <div className="flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShareOpen(false)}
              >
                Done
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
