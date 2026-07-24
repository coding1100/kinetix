"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArchiveIcon,
  BellIcon,
  CalendarIcon,
  CheckCircle2Icon,
  ChevronDownIcon,
  CircleDashedIcon,
  CircleDotIcon,
  CircleIcon,
  Edit2Icon,
  FlagIcon,
  FlaskConicalIcon,
  LinkIcon,
  Loader2Icon,
  MoreHorizontalIcon,
  PaperclipIcon,
  PlusIcon,
  RocketIcon,
  SearchIcon,
  ShieldCheckIcon,
  SquareCheckBigIcon,
  Trash2Icon,
  Undo2Icon,
  UserMinusIcon,
  UserPlusIcon,
  WandSparklesIcon,
  XIcon,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { FEATURE_FLAGS } from "@/lib/feature-flags";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { CreateTaskListPicker } from "@/components/spaces/CreateTaskListPicker";
import { toast } from "sonner";
import { fetchWorkspaceMembers } from "@/lib/api/chat";
import { fetchRecents, type SpaceDto } from "@/lib/api/home";
import {
  addChecklist,
  addChecklistItem,
  addTaskDependency,
  createListTask,
  createSubtask,
  deleteChecklist,
  deleteChecklistItem,
  fetchListMeta,
  fetchSpacesTree,
  flattenListsFromSpaces,
  patchTask,
  updateChecklist,
  updateChecklistItem,
} from "@/lib/api/spaces";
import { uploadTaskAttachment } from "@/lib/tasks/upload-task-attachment";
import { TaskPickerDialog } from "@/components/spaces/TaskPickerDialog";
import type { ListStatus, Task, TaskDependencyType } from "@/lib/types/task";
import { useWorkspaceApi } from "@/hooks/use-workspace-api";
import { TASK_PRIORITIES, type TaskPriority } from "@/lib/task-priority";
import {
  avatarColorClassForKey,
  avatarInitialFromName,
} from "@/lib/user-display";
import { cn, PKT_TIME_ZONE } from "@/lib/utils";

type Member = { id: string; fullName: string; avatarUrl?: string | null };

type StagedAttachment = { id: string; file: File };

type StagedDependency = { id: string; type: TaskDependencyType; task: Task };

type StagedChecklistItem = {
  id: string;
  text: string;
  checked: boolean;
  assigneeId: string | null;
};

type StagedChecklist = {
  id: string;
  name: string;
  items: StagedChecklistItem[];
  draftItemText: string;
  draftItemAssigneeId: string | null;
};

type StagedSubtask = { id: string; name: string };

type CreateAction = "default" | "open" | "start-another" | "duplicate";

const DEPENDENCY_SECTIONS: {
  type: TaskDependencyType;
  label: string;
  addLabel: string;
}[] = [
  { type: "blocked_by", label: "Blocked by", addLabel: "Add blocked by task" },
  { type: "blocking", label: "Blocks", addLabel: "Add task that blocks" },
  { type: "linked", label: "Linked", addLabel: "Add linked task" },
];

const NO_PRIORITY = "__none__";

function toDueDateIso(input: string): string | undefined {
  if (!input) return undefined;
  return new Date(`${input}T12:00:00.000Z`).toISOString();
}

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

function priorityFlagClass(value: TaskPriority | typeof NO_PRIORITY) {
  switch (value) {
    case "urgent":
      return "text-red-500";
    case "high":
      return "text-yellow-500";
    case "normal":
      return "text-blue-500";
    case "low":
      return "text-gray-400";
    default:
      return "text-muted-foreground";
  }
}

function formatDueChip(value: string) {
  if (!value) return "Due date";
  const date = new Date(`${value}T12:00:00.000Z`);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: PKT_TIME_ZONE,
  });
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function CreateTaskDialog({
  open,
  onOpenChange,
  defaultListId,
  defaultStatusId,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultListId?: string;
  defaultStatusId?: string;
  onCreated: (task: Task, options?: { open?: boolean }) => void;
}) {
  const { accessToken, workspaceId, ready } = useWorkspaceApi();
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [listId, setListId] = useState("");
  const [listName, setListName] = useState("");
  const [statusId, setStatusId] = useState("");
  const [priority, setPriority] = useState<TaskPriority | typeof NO_PRIORITY>(
    NO_PRIORITY
  );
  const [dueInput, setDueInput] = useState("");
  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);
  const [assigneeSearch, setAssigneeSearch] = useState("");
  const [assigneeOpen, setAssigneeOpen] = useState(false);
  const [followerIds, setFollowerIds] = useState<string[]>([]);
  const [followerSearch, setFollowerSearch] = useState("");
  const [followerOpen, setFollowerOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [dueOpen, setDueOpen] = useState(false);
  const [priorityOpen, setPriorityOpen] = useState(false);
  const [spaces, setSpaces] = useState<SpaceDto[]>([]);
  const [recents, setRecents] = useState<
    { id: string; name: string; href: string; space: string }[]
  >([]);
  const [statuses, setStatuses] = useState<ListStatus[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [pendingAttachments, setPendingAttachments] = useState<
    StagedAttachment[]
  >([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dependencies, setDependencies] = useState<StagedDependency[]>([]);
  const [dependenciesOpen, setDependenciesOpen] = useState(false);
  const [taskPickerFor, setTaskPickerFor] = useState<TaskDependencyType | null>(
    null
  );
  const [subtasks, setSubtasks] = useState<StagedSubtask[]>([]);
  const [subtasksOpen, setSubtasksOpen] = useState(false);
  const [draftSubtaskName, setDraftSubtaskName] = useState("");
  const [checklists, setChecklists] = useState<StagedChecklist[]>([]);
  const [checklistAssigneeOpen, setChecklistAssigneeOpen] = useState<string | null>(null);
  const [checklistAssigneeSearch, setChecklistAssigneeSearch] = useState("");
  const [checklistAssignAllOpen, setChecklistAssignAllOpen] = useState<string | null>(null);
  const [checklistAssignAllSearch, setChecklistAssignAllSearch] = useState("");
  const [renameTarget, setRenameTarget] = useState<
    | { type: "checklist"; checklistId: string }
    | { type: "item"; checklistId: string; itemId: string }
    | null
  >(null);
  const [renameValue, setRenameValue] = useState("");
  const [unassignAllChecklistId, setUnassignAllChecklistId] = useState<
    string | null
  >(null);

  useEffect(() => {
    if (!open || !ready || !accessToken || !workspaceId) return;
    let cancelled = false;
    Promise.all([
      fetchSpacesTree(accessToken, workspaceId),
      fetchWorkspaceMembers(accessToken, workspaceId),
      fetchRecents(accessToken, workspaceId),
    ])
      .then(([spacesRes, membersRes, recentsRes]) => {
        if (cancelled) return;
        const tree = spacesRes.data;
        const options = flattenListsFromSpaces(tree);
        setSpaces(tree);
        setRecents(recentsRes.data);
        setMembers(membersRes.data);
        const target =
          defaultListId && options.some((o) => o.id === defaultListId)
            ? defaultListId
            : options[0]?.id ?? "";
        setListId(target);
        const selected = options.find((o) => o.id === target);
        setListName(selected?.label.split(" / ").pop() ?? "");
      })
      .catch(() => {
        if (!cancelled) toast.error("Could not load create-task options");
      });
    return () => {
      cancelled = true;
    };
  }, [open, ready, accessToken, workspaceId, defaultListId]);

  useEffect(() => {
    if (!open || !listId || !ready || !accessToken || !workspaceId) {
      setStatuses([]);
      setStatusId("");
      setListName("");
      return;
    }
    let cancelled = false;
    fetchListMeta(accessToken, workspaceId, listId)
      .then((meta) => {
        if (cancelled) return;
        setListName(meta.name);
        const rows = [...(meta.statuses ?? [])].sort(
          (a, b) => a.sortOrder - b.sortOrder
        );
        setStatuses(rows);
        const defaultStatus =
          rows.find((s) => s.id === defaultStatusId) ??
          rows.find((s) => s.legacyKey === "TODO") ??
          rows[0];
        setStatusId(defaultStatus?.id ?? "");
      })
      .catch(() => {
        if (!cancelled) {
          setStatuses([]);
          setStatusId("");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [open, listId, ready, accessToken, workspaceId, defaultStatusId]);

  const selectedStatus = useMemo(
    () => statuses.find((s) => s.id === statusId) ?? statuses[0],
    [statuses, statusId]
  );
  const groupedStatusSections = useMemo(() => statusSections(statuses), [statuses]);

  const filteredMembers = useMemo(() => {
    const q = assigneeSearch.trim().toLowerCase();
    if (!q) return members;
    return members.filter((m) => m.fullName.toLowerCase().includes(q));
  }, [members, assigneeSearch]);

  const selectedAssignees = useMemo(
    () => members.filter((m) => assigneeIds.includes(m.id)),
    [members, assigneeIds]
  );

  const filteredFollowerMembers = useMemo(() => {
    const q = followerSearch.trim().toLowerCase();
    if (!q) return members;
    return members.filter((m) => m.fullName.toLowerCase().includes(q));
  }, [members, followerSearch]);

  const filteredChecklistAssigneeMembers = useMemo(() => {
    const q = checklistAssigneeSearch.trim().toLowerCase();
    if (!q) return members;
    return members.filter((m) => m.fullName.toLowerCase().includes(q));
  }, [members, checklistAssigneeSearch]);

  const canCreate = useMemo(
    () => Boolean(name.trim() && listId && !saving),
    [name, listId, saving]
  );

  function resetState() {
    setName("");
    setDescription("");
    setPriority(NO_PRIORITY);
    setDueInput("");
    setAssigneeIds([]);
    setAssigneeSearch("");
    setFollowerIds([]);
    setFollowerSearch("");
    setPendingAttachments([]);
    setDependencies([]);
    setSubtasks([]);
    setSubtasksOpen(false);
    setDraftSubtaskName("");
    setChecklists([]);
  }

  function toggleAssignee(userId: string) {
    setAssigneeIds((ids) =>
      ids.includes(userId) ? ids.filter((id) => id !== userId) : [...ids, userId]
    );
  }

  function toggleFollower(userId: string) {
    setFollowerIds((ids) =>
      ids.includes(userId) ? ids.filter((id) => id !== userId) : [...ids, userId]
    );
  }

  function addDependency(type: TaskDependencyType, task: Task) {
    setDependencies((prev) => [...prev, { id: crypto.randomUUID(), type, task }]);
  }

  function removeDependency(id: string) {
    setDependencies((prev) => prev.filter((d) => d.id !== id));
  }

  function focusSubtaskComposer() {
    setSubtasksOpen(true);
    setTimeout(() => {
      document.getElementById("subtask-draft-input")?.focus();
    }, 0);
  }

  function stageSubtask() {
    const name = draftSubtaskName.trim();
    if (!name) return;
    setSubtasks((prev) => [...prev, { id: crypto.randomUUID(), name }]);
    setDraftSubtaskName("");
  }

  function removeSubtask(id: string) {
    setSubtasks((prev) => prev.filter((s) => s.id !== id));
  }

  function stageChecklist() {
    setChecklists((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        name: `Checklist ${prev.length + 1}`,
        items: [],
        draftItemText: "",
        draftItemAssigneeId: null,
      },
    ]);
  }

  function focusChecklistComposer(checklistId: string) {
    setTimeout(() => {
      document
        .getElementById(`checklist-draft-input-${checklistId}`)
        ?.focus();
    }, 0);
  }

  function stageChecklistItem(checklistId: string) {
    setChecklists((prev) =>
      prev.map((c) => {
        if (c.id !== checklistId) return c;
        const text = c.draftItemText.trim();
        if (!text) return c;
        return {
          ...c,
          items: [
            ...c.items,
            {
              id: crypto.randomUUID(),
              text,
              checked: false,
              assigneeId: c.draftItemAssigneeId,
            },
          ],
          draftItemText: "",
          draftItemAssigneeId: null,
        };
      })
    );
  }

  function toggleChecklistItemChecked(checklistId: string, itemId: string) {
    setChecklists((prev) =>
      prev.map((c) =>
        c.id === checklistId
          ? {
              ...c,
              items: c.items.map((i) =>
                i.id === itemId ? { ...i, checked: !i.checked } : i
              ),
            }
          : c
      )
    );
  }

  function removeChecklistItem(checklistId: string, itemId: string) {
    setChecklists((prev) =>
      prev.map((c) =>
        c.id === checklistId ? { ...c, items: c.items.filter((i) => i.id !== itemId) } : c
      )
    );
  }

  function setChecklistDraftAssignee(checklistId: string, assigneeId: string | null) {
    setChecklists((prev) =>
      prev.map((c) => (c.id === checklistId ? { ...c, draftItemAssigneeId: assigneeId } : c))
    );
  }

  function pickChecklistDraftAssignee(checklistId: string, userId: string) {
    setChecklists((prev) =>
      prev.map((c) =>
        c.id === checklistId
          ? { ...c, draftItemAssigneeId: c.draftItemAssigneeId === userId ? null : userId }
          : c
      )
    );
    setChecklistAssigneeOpen(null);
    setChecklistAssigneeSearch("");
  }

  function renameChecklist(checklistId: string, newName: string) {
    setChecklists((prev) =>
      prev.map((c) => (c.id === checklistId ? { ...c, name: newName } : c))
    );
  }

  function removeChecklist(checklistId: string) {
    setChecklists((prev) => prev.filter((c) => c.id !== checklistId));
  }

  function updateChecklistItemText(
    checklistId: string,
    itemId: string,
    text: string
  ) {
    setChecklists((prev) =>
      prev.map((c) =>
        c.id === checklistId
          ? {
              ...c,
              items: c.items.map((i) => (i.id === itemId ? { ...i, text } : i)),
            }
          : c
      )
    );
  }

  function updateChecklistDraftText(checklistId: string, text: string) {
    setChecklists((prev) =>
      prev.map((c) => (c.id === checklistId ? { ...c, draftItemText: text } : c))
    );
  }

  function checkAllInChecklist(checklistId: string) {
    setChecklists((prev) =>
      prev.map((c) =>
        c.id === checklistId
          ? {
              ...c,
              items: c.items.map((i) => ({ ...i, checked: true })),
            }
          : c
      )
    );
  }

  function uncheckAllInChecklist(checklistId: string) {
    setChecklists((prev) =>
      prev.map((c) =>
        c.id === checklistId
          ? {
              ...c,
              items: c.items.map((i) => ({ ...i, checked: false })),
            }
          : c
      )
    );
  }

  function assignAllChecklistItemsInChecklist(checklistId: string, userId: string) {
    setChecklists((prev) =>
      prev.map((c) =>
        c.id === checklistId
          ? {
              ...c,
              items: c.items.map((i) => ({ ...i, assigneeId: userId })),
            }
          : c
      )
    );
  }

  function unassignAllChecklistItemsInChecklist(checklistId: string) {
    setChecklists((prev) =>
      prev.map((c) =>
        c.id === checklistId
          ? {
              ...c,
              items: c.items.map((i) => ({ ...i, assigneeId: null })),
            }
          : c
      )
    );
  }

  function handleUnassignAll(checklistId: string) {
    const checklist = checklists.find((c) => c.id === checklistId);
    if (!checklist || checklist.items.length === 0) return;
    setUnassignAllChecklistId(checklistId);
  }

  function confirmUnassignAll() {
    if (unassignAllChecklistId) {
      unassignAllChecklistItemsInChecklist(unassignAllChecklistId);
    }
    setUnassignAllChecklistId(null);
  }

  function openRenameChecklist(checklistId: string, currentName: string) {
    setRenameTarget({ type: "checklist", checklistId });
    setRenameValue(currentName);
  }

  function openRenameItem(checklistId: string, itemId: string, currentText: string) {
    setRenameTarget({ type: "item", checklistId, itemId });
    setRenameValue(currentText);
  }

  function submitRename(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = renameValue.trim();
    if (!trimmed || !renameTarget) return;
    if (renameTarget.type === "checklist") {
      renameChecklist(renameTarget.checklistId, trimmed);
    } else {
      updateChecklistItemText(renameTarget.checklistId, renameTarget.itemId, trimmed);
    }
    setRenameTarget(null);
    setRenameValue("");
  }

  function pickAttachment() {
    fileInputRef.current?.click();
  }

  function onAttachmentInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files ? Array.from(e.target.files) : [];
    e.target.value = "";
    if (files.length === 0) return;
    setPendingAttachments((prev) => [
      ...prev,
      ...files.map((file) => ({ id: crypto.randomUUID(), file })),
    ]);
  }

  function removeAttachment(id: string) {
    setPendingAttachments((prev) => prev.filter((a) => a.id !== id));
  }

  async function createOneTask(): Promise<Task> {
    const created = await createListTask(accessToken!, workspaceId!, listId, {
      name: name.trim(),
      description: description.trim() || undefined,
    });
    const payload: Parameters<typeof patchTask>[3] = {};
    if (statusId) payload.statusId = statusId;
    if (priority !== NO_PRIORITY) payload.priority = priority;
    if (assigneeIds.length > 0) payload.assigneeIds = assigneeIds;
    if (followerIds.length > 0) payload.followerIds = followerIds;
    const dueDate = toDueDateIso(dueInput);
    if (dueDate) payload.dueDate = dueDate;

    const shouldPatch = Object.keys(payload).length > 0;
    return shouldPatch
      ? await patchTask(accessToken!, workspaceId!, created.id, payload)
      : created;
  }

  async function attachStagedExtras(task: Task, accessToken: string, workspaceId: string) {
    for (const { file } of pendingAttachments) {
      try {
        await uploadTaskAttachment(accessToken, workspaceId, task.id, file);
      } catch (e) {
        toast.error(
          e instanceof Error
            ? `Failed to attach ${file.name}: ${e.message}`
            : `Failed to attach ${file.name}`
        );
      }
    }

    for (const dep of dependencies) {
      try {
        await addTaskDependency(accessToken, workspaceId, task.id, {
          relatedTaskId: dep.task.id,
          type: dep.type,
        });
      } catch (e) {
        toast.error(
          e instanceof Error
            ? `Failed to link ${dep.task.name}: ${e.message}`
            : `Failed to link ${dep.task.name}`
        );
      }
    }

    for (const subtask of subtasks) {
      try {
        await createSubtask(accessToken, workspaceId, task.id, subtask.name);
      } catch (e) {
        toast.error(
          e instanceof Error
            ? `Failed to add subtask "${subtask.name}": ${e.message}`
            : `Failed to add subtask "${subtask.name}"`
        );
      }
    }

    for (const checklist of checklists) {
      try {
        const createdChecklist = await addChecklist(
          accessToken,
          workspaceId,
          task.id,
          { name: checklist.name }
        );
        for (const item of checklist.items) {
          try {
            await addChecklistItem(
              accessToken,
              workspaceId,
              task.id,
              createdChecklist.id,
              {
                text: item.text,
                assigneeId: item.assigneeId,
                isChecked: item.checked,
              }
            );
          } catch (e) {
            toast.error(
              e instanceof Error
                ? `Failed to add item "${item.text}": ${e.message}`
                : `Failed to add item "${item.text}"`
            );
          }
        }
      } catch (e) {
        toast.error(
          e instanceof Error
            ? `Failed to create checklist "${checklist.name}": ${e.message}`
            : `Failed to create checklist "${checklist.name}"`
        );
      }
    }
  }

  async function handleCreate(action: CreateAction = "default") {
    if (!canCreate || !ready || !accessToken || !workspaceId) return;
    setSaving(true);
    try {
      const finalTask = await createOneTask();
      await attachStagedExtras(finalTask, accessToken, workspaceId);

      if (action === "duplicate") {
        const duplicateTask = await createOneTask();
        await attachStagedExtras(duplicateTask, accessToken, workspaceId);
        onCreated(duplicateTask);
        toast.success("Task created and duplicated");
      } else {
        toast.success("Task created");
      }

      onCreated(finalTask, { open: action === "open" });

      if (action === "start-another") {
        resetState();
        const defaultStatus =
          statuses.find((s) => s.legacyKey === "TODO") ?? statuses[0];
        setStatusId(defaultStatus?.id ?? "");
      } else if (action === "duplicate") {
        // Keep the modal open with its current fields so another
        // "Create and duplicate" (or a tweak-then-duplicate) can follow -
        // unlike the other actions, this one shouldn't clear the form.
      } else {
        onOpenChange(false);
        resetState();
        setStatusId("");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not create task");
    } finally {
      setSaving(false);
    }
  }

  const StatusIcon = selectedStatus ? statusIcon(selectedStatus) : CircleIcon;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-2xl">
        <DialogHeader className="border-b border-border px-4 py-3 text-left">
          <DialogTitle className="sr-only">Create task</DialogTitle>
          <div className="flex flex-wrap items-center gap-2">
            <CreateTaskListPicker
              spaces={spaces}
              recents={recents}
              listId={listId}
              listName={listName}
              onSelect={(id, name) => {
                setListId(id);
                setListName(name);
              }}
            />
            <Badge variant="secondary" className="gap-1.5 font-medium">
              <SquareCheckBigIcon className="size-3.5" />
              Task
            </Badge>
          </div>
        </DialogHeader>

        <div className="space-y-1 px-4 py-3">
          <Input
            id="create-task-name"
            value={name}
            placeholder="Task Name"
            onChange={(e) => setName(e.target.value)}
            className="h-auto border-0 px-0 text-lg font-medium shadow-none focus-visible:ring-0"
          />
          <textarea
            id="create-task-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="Write or type '/' for commands"
            className="min-h-[72px] w-full resize-none border-0 bg-transparent px-0 py-1 text-sm text-muted-foreground outline-none placeholder:text-muted-foreground/80"
          />

          <div className="flex flex-wrap items-center gap-2 pt-2">
            <Popover open={statusOpen} onOpenChange={setStatusOpen}>
              <PopoverTrigger
                render={
                  <button
                    type="button"
                    className="flex w-fit max-w-[140px] items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-xs font-bold tracking-wide text-white uppercase"
                    style={{
                      backgroundColor: selectedStatus?.color ?? "#87909e",
                    }}
                  >
                    <StatusIcon className="size-3 shrink-0" />
                    <span className="truncate">
                      {selectedStatus?.name ?? "Status"}
                    </span>
                    <ChevronDownIcon className="ml-auto size-3 shrink-0 opacity-80" />
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
                      const active = status.id === statusId;
                      return (
                        <button
                          key={status.id}
                          type="button"
                          className={cn(
                            "flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-muted",
                            active && "bg-muted"
                          )}
                          onClick={() => {
                            setStatusId(status.id);
                            setStatusOpen(false);
                          }}
                        >
                          <span
                            className="flex size-5 items-center justify-center rounded-full text-white"
                            style={{ backgroundColor: status.color }}
                          >
                            <Icon className="size-3" />
                          </span>
                          <span className="flex-1 truncate text-left uppercase">
                            {status.name}
                          </span>
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

            <Popover
              open={assigneeOpen}
              onOpenChange={(next) => {
                setAssigneeOpen(next);
                if (!next) setAssigneeSearch("");
              }}
            >
              <PopoverTrigger
                render={
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 gap-1.5 bg-muted/20 px-2"
                  >
                    {selectedAssignees.length > 0 ? (
                      <span className="flex items-center gap-1">
                        {selectedAssignees.slice(0, 2).map((m) => (
                          <Avatar key={m.id} className="size-4">
                            {m.avatarUrl ? (
                              <AvatarImage src={m.avatarUrl} alt={m.fullName} />
                            ) : null}
                            <AvatarFallback
                              className={cn(
                                "text-[8px] font-semibold",
                                avatarColorClassForKey(m.id, m.fullName)
                              )}
                            >
                              {avatarInitialFromName(m.fullName)}
                            </AvatarFallback>
                          </Avatar>
                        ))}
                        {selectedAssignees.length > 2 ? (
                          <span className="text-xs text-muted-foreground">
                            +{selectedAssignees.length - 2}
                          </span>
                        ) : null}
                      </span>
                    ) : (
                      <UserPlusIcon className="size-3.5 text-muted-foreground" />
                    )}
                    <span className="text-xs">
                      {selectedAssignees.length === 1
                        ? selectedAssignees[0].fullName.split(" ")[0]
                        : selectedAssignees.length > 1
                          ? `${selectedAssignees.length} assignees`
                          : "Assignee"}
                    </span>
                  </Button>
                }
              />
              <PopoverContent align="start" className="w-72 p-2">
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
                  {filteredMembers.length === 0 ? (
                    <li className="px-2 py-3 text-center text-xs text-muted-foreground">
                      No people found
                    </li>
                  ) : (
                    filteredMembers.map((m) => {
                      const checked = assigneeIds.includes(m.id);
                      return (
                        <li key={m.id}>
                          <button
                            type="button"
                            className={cn(
                              "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted",
                              checked && "bg-primary/5"
                            )}
                            onClick={() => toggleAssignee(m.id)}
                          >
                            <Avatar className="size-6">
                              {m.avatarUrl ? (
                                <AvatarImage src={m.avatarUrl} alt={m.fullName} />
                              ) : null}
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
                            {checked ? (
                              <CheckCircle2Icon className="size-4 text-primary" />
                            ) : null}
                          </button>
                        </li>
                      );
                    })
                  )}
                </ul>
              </PopoverContent>
            </Popover>

            <Popover open={dueOpen} onOpenChange={setDueOpen}>
              <PopoverTrigger
                render={
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 gap-1.5 bg-muted/20 px-2"
                  >
                    <CalendarIcon className="size-3.5 text-muted-foreground" />
                    <span className="text-xs">{formatDueChip(dueInput)}</span>
                  </Button>
                }
              />
              <PopoverContent align="start" className="w-auto space-y-2 p-3">
                <Input
                  type="date"
                  value={dueInput}
                  onChange={(e) => setDueInput(e.target.value)}
                />
                {dueInput ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="w-full"
                    onClick={() => setDueInput("")}
                  >
                    Clear due date
                  </Button>
                ) : null}
              </PopoverContent>
            </Popover>

            <Popover open={priorityOpen} onOpenChange={setPriorityOpen}>
              <PopoverTrigger
                render={
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 gap-1.5 bg-muted/20 px-2"
                  >
                    <FlagIcon
                      className={cn("size-3.5", priorityFlagClass(priority))}
                    />
                    <span className="text-xs capitalize">
                      {priority === NO_PRIORITY
                        ? "Priority"
                        : TASK_PRIORITIES.find((p) => p.value === priority)
                            ?.label ?? priority}
                    </span>
                  </Button>
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
                    onClick={() => {
                      setPriority(p.value);
                      setPriorityOpen(false);
                    }}
                  >
                    <FlagIcon className={cn("size-3.5", priorityFlagClass(p.value))} />
                    {p.label}
                  </button>
                ))}
              </PopoverContent>
            </Popover>

            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    type="button"
                    variant="outline"
                    size="icon-sm"
                    aria-label="More options"
                  >
                    <MoreHorizontalIcon className="size-3.5" />
                  </Button>
                }
              />
              <DropdownMenuContent align="start">
                {FEATURE_FLAGS.subtasks ? (
                  <DropdownMenuItem onClick={() => focusSubtaskComposer()}>
                    Subtasks
                  </DropdownMenuItem>
                ) : null}
                <DropdownMenuItem onClick={() => stageChecklist()}>
                  Checklist
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setDependenciesOpen(true)}>
                  Dependencies
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {FEATURE_FLAGS.subtasks && (subtasksOpen || subtasks.length > 0) ? (
            <div className="pt-3 space-y-2">
              <p className="text-xs font-semibold text-muted-foreground">
                Subtasks
              </p>
              <div className="divide-y divide-border rounded-md border border-border overflow-hidden">
                {subtasks.map((subtask) => (
                  <div
                    key={subtask.id}
                    className="group flex items-center gap-2 px-3 py-2 hover:bg-muted/30"
                  >
                    <SquareCheckBigIcon className="size-4 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1 truncate text-sm">
                      {subtask.name}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeSubtask(subtask.id)}
                      className="shrink-0 rounded p-1 text-muted-foreground opacity-0 hover:bg-muted hover:text-foreground group-hover:opacity-100"
                      aria-label="Remove subtask"
                    >
                      <Trash2Icon className="size-3.5" />
                    </button>
                  </div>
                ))}
                <div className="flex items-center gap-2 px-3 py-2">
                  <button
                    type="button"
                    onClick={() => stageSubtask()}
                    disabled={!draftSubtaskName.trim()}
                    className="shrink-0 rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
                    aria-label="Add subtask"
                  >
                    <PlusIcon className="size-3.5" />
                  </button>
                  <Input
                    id="subtask-draft-input"
                    value={draftSubtaskName}
                    onChange={(e) => setDraftSubtaskName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        stageSubtask();
                      }
                    }}
                    placeholder="Add subtask"
                    className="h-7 flex-1 border-0 bg-transparent px-0 text-sm shadow-none focus-visible:ring-0"
                  />
                </div>
              </div>
            </div>
          ) : null}

          {checklists.length > 0 ? (
            <div className="pt-3 space-y-3">
              <p className="text-xs font-semibold text-muted-foreground">
                Checklist
              </p>
              {checklists.map((checklist) => {
                const checkedCount = checklist.items.filter((i) => i.checked).length;
                return (
                  <div key={checklist.id} className="border border-border rounded-md overflow-hidden">
                    <div className="flex items-center justify-between bg-muted/40 px-3 py-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-foreground">
                          {checklist.name}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {checkedCount} of {checklist.items.length}
                        </span>
                      </div>
                      <div className="relative">
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            render={
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-6 px-1"
                                aria-label="Checklist options"
                              >
                                <MoreHorizontalIcon className="size-3.5" />
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
                            <DropdownMenuSeparator className="my-1" />
                            <DropdownMenuItem
                              onClick={() => setChecklistAssignAllOpen(checklist.id)}
                              disabled={checklist.items.length === 0}
                              className="text-xs gap-2 whitespace-nowrap"
                            >
                              <UserPlusIcon className="size-3.5 shrink-0" />
                              Assign all to
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleUnassignAll(checklist.id)}
                              disabled={checklist.items.length === 0}
                              className="text-xs gap-2 whitespace-nowrap"
                            >
                              <UserMinusIcon className="size-3.5 shrink-0" />
                              Unassign all
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => checkAllInChecklist(checklist.id)}
                              disabled={checklist.items.length === 0}
                              className="text-xs gap-2 whitespace-nowrap"
                            >
                              <CheckCircle2Icon className="size-3.5 shrink-0" />
                              Check All
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => uncheckAllInChecklist(checklist.id)}
                              disabled={checklist.items.length === 0}
                              className="text-xs gap-2 whitespace-nowrap"
                            >
                              <CircleIcon className="size-3.5 shrink-0" />
                              Uncheck All
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => removeChecklist(checklist.id)}
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
                              {filteredChecklistAssigneeMembers
                                .filter((m) =>
                                  m.fullName
                                    .toLowerCase()
                                    .includes(checklistAssignAllSearch.toLowerCase())
                                ).length === 0 ? (
                                <li className="px-2 py-3 text-center text-xs text-muted-foreground">
                                  No people found
                                </li>
                              ) : (
                                filteredChecklistAssigneeMembers
                                  .filter((m) =>
                                    m.fullName
                                      .toLowerCase()
                                      .includes(checklistAssignAllSearch.toLowerCase())
                                  )
                                  .map((m) => (
                                    <li key={m.id}>
                                      <button
                                        type="button"
                                        className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-muted"
                                        onClick={() => {
                                          assignAllChecklistItemsInChecklist(
                                            checklist.id,
                                            m.id
                                          );
                                          setChecklistAssignAllOpen(null);
                                          setChecklistAssignAllSearch("");
                                        }}
                                      >
                                        <Avatar className="size-6">
                                          {m.avatarUrl ? (
                                            <AvatarImage src={m.avatarUrl} alt={m.fullName} />
                                          ) : null}
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
                                      </button>
                                    </li>
                                  ))
                              )}
                            </ul>
                          </PopoverContent>
                        </Popover>
                      </div>
                    </div>
                    <div className="divide-y divide-border">
                      {checklist.items.map((item, itemIndex) => {
                        const assignee = members.find((m) => m.id === item.assigneeId);
                        return (
                          <div
                            key={item.id}
                            className="group flex items-center gap-2 px-3 py-2 hover:bg-muted/30"
                          >
                            <button
                              type="button"
                              onClick={() =>
                                toggleChecklistItemChecked(checklist.id, item.id)
                              }
                              className="shrink-0 text-muted-foreground hover:text-foreground"
                              aria-label={
                                item.checked ? "Mark incomplete" : "Mark complete"
                              }
                            >
                              {item.checked ? (
                                <CheckCircle2Icon className="size-4 text-primary" />
                              ) : (
                                <CircleIcon className="size-4" />
                              )}
                            </button>
                            <span
                              className={cn(
                                "min-w-0 flex-1 truncate text-sm",
                                item.checked && "line-through text-muted-foreground"
                              )}
                            >
                              {item.text}
                            </span>
                            {assignee && (
                              <Avatar className="size-5 shrink-0">
                                {assignee.avatarUrl ? (
                                  <AvatarImage
                                    src={assignee.avatarUrl}
                                    alt={assignee.fullName}
                                  />
                                ) : null}
                                <AvatarFallback
                                  className={cn(
                                    "text-[9px] font-semibold",
                                    avatarColorClassForKey(
                                      assignee.id,
                                      assignee.fullName
                                    )
                                  )}
                                >
                                  {avatarInitialFromName(assignee.fullName)}
                                </AvatarFallback>
                              </Avatar>
                            )}
                            <DropdownMenu>
                              <DropdownMenuTrigger
                                render={
                                  <button
                                    type="button"
                                    className="shrink-0 rounded p-1 text-muted-foreground opacity-0 hover:bg-muted hover:text-foreground group-hover:opacity-100"
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
                                    openRenameItem(checklist.id, item.id, item.text)
                                  }
                                  className="text-xs gap-2 whitespace-nowrap"
                                >
                                  <Edit2Icon className="size-3.5 shrink-0" />
                                  Rename
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() =>
                                    setChecklistAssigneeOpen(item.id)
                                  }
                                  className="text-xs gap-2 whitespace-nowrap"
                                >
                                  <UserPlusIcon className="size-3.5 shrink-0" />
                                  Assign to
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() =>
                                    removeChecklistItem(checklist.id, item.id)
                                  }
                                  className="text-xs gap-2 whitespace-nowrap text-destructive"
                                >
                                  <Trash2Icon className="size-3.5 shrink-0" />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        );
                      })}
                      <div className="flex items-center gap-2 px-3 py-2">
                        <button
                          type="button"
                          onClick={() => stageChecklistItem(checklist.id)}
                          disabled={!checklist.draftItemText.trim()}
                          className="shrink-0 rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
                          aria-label="Add item"
                        >
                          <PlusIcon className="size-3.5" />
                        </button>
                        <Input
                          id={`checklist-draft-input-${checklist.id}`}
                          value={checklist.draftItemText}
                          onChange={(e) =>
                            updateChecklistDraftText(checklist.id, e.target.value)
                          }
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              stageChecklistItem(checklist.id);
                            }
                          }}
                          placeholder="Add item"
                          className="h-7 flex-1 border-0 bg-transparent px-0 text-sm shadow-none focus-visible:ring-0"
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
                                onClick={() =>
                                  setChecklistAssigneeOpen(checklist.id)
                                }
                              >
                                {checklist.draftItemAssigneeId ? (
                                  (() => {
                                    const draftAssignee = members.find(
                                      (m) => m.id === checklist.draftItemAssigneeId
                                    );
                                    return draftAssignee ? (
                                      <Avatar className="size-5">
                                        {draftAssignee.avatarUrl ? (
                                          <AvatarImage
                                            src={draftAssignee.avatarUrl}
                                            alt={draftAssignee.fullName}
                                          />
                                        ) : null}
                                        <AvatarFallback
                                          className={cn(
                                            "text-[9px] font-semibold",
                                            avatarColorClassForKey(
                                              draftAssignee.id,
                                              draftAssignee.fullName
                                            )
                                          )}
                                        >
                                          {avatarInitialFromName(
                                            draftAssignee.fullName
                                          )}
                                        </AvatarFallback>
                                      </Avatar>
                                    ) : (
                                      <UserPlusIcon className="size-3.5" />
                                    );
                                  })()
                                ) : (
                                  <UserPlusIcon className="size-3.5" />
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
                                    checklist.draftItemAssigneeId === m.id;
                                  return (
                                    <li key={m.id}>
                                      <button
                                        type="button"
                                        className={cn(
                                          "flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-muted",
                                          checked && "bg-primary/5"
                                        )}
                                        onClick={() => {
                                          pickChecklistDraftAssignee(
                                            checklist.id,
                                            m.id
                                          );
                                        }}
                                      >
                                        <Avatar className="size-6">
                                          {m.avatarUrl ? (
                                            <AvatarImage src={m.avatarUrl} alt={m.fullName} />
                                          ) : null}
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
                    </div>
                  </div>
                );
              })}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => stageChecklist()}
                className="w-full"
              >
                <PlusIcon className="size-3.5 mr-1.5" />
                Add Checklist
              </Button>
            </div>
          ) : null}

          {dependencies.length > 0 ? (
            <div className="pt-3">
              <p className="pb-1.5 text-xs font-semibold text-muted-foreground">
                Dependencies
              </p>
              <div className="divide-y divide-border rounded-md border border-border">
                {DEPENDENCY_SECTIONS.filter((section) =>
                  dependencies.some((d) => d.type === section.type)
                ).map((section) => (
                  <div key={section.type} className="px-2.5 py-1.5">
                    <p className="pb-1 text-xs text-muted-foreground">
                      {section.label}
                    </p>
                    {dependencies
                      .filter((d) => d.type === section.type)
                      .map((d) => (
                        <div
                          key={d.id}
                          className="flex items-center gap-2 py-1"
                        >
                          <LinkIcon className="size-3.5 shrink-0 text-muted-foreground" />
                          <span className="min-w-0 flex-1 truncate text-sm">
                            {d.task.name}
                          </span>
                          <button
                            type="button"
                            onClick={() => removeDependency(d.id)}
                            className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                            aria-label={`Remove ${d.task.name}`}
                          >
                            <XIcon className="size-3.5" />
                          </button>
                        </div>
                      ))}
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {pendingAttachments.length > 0 ? (
            <div className="pt-3">
              <p className="pb-1.5 text-xs font-semibold text-muted-foreground">
                Attachments
              </p>
              <div className="divide-y divide-border rounded-md border border-border">
                {pendingAttachments.map(({ id, file }) => (
                  <div key={id} className="flex items-center gap-2 px-2.5 py-1.5">
                    <span className="min-w-0 flex-1 truncate text-sm">
                      {file.name}
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {formatBytes(file.size)}
                    </span>
                    {saving ? (
                      <Spinner size="sm" label={`Uploading ${file.name}`} />
                    ) : (
                      <button
                        type="button"
                        onClick={() => removeAttachment(id)}
                        className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                        aria-label={`Remove ${file.name}`}
                      >
                        <XIcon className="size-3.5" />
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={pickAttachment}
                  className="flex w-full items-center gap-1 px-2.5 py-2 text-foreground hover:bg-muted/40"
                >
                  <span className="text-xs">Add</span>
                  <span className="text-sm underline underline-offset-2">
                    attachment
                  </span>
                </button>
              </div>
            </div>
          ) : null}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={onAttachmentInputChange}
        />

        <DialogFooter className="flex-row items-center justify-end border-t border-border px-4 py-3 sm:justify-end">
          <div className="flex items-center gap-2">
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    type="button"
                    variant="outline"
                    size="icon-sm"
                    onClick={pickAttachment}
                    aria-label="Add attachment"
                  >
                    <PaperclipIcon className="size-3.5" />
                  </Button>
                }
              />
              <TooltipContent side="top">Attachments</TooltipContent>
            </Tooltip>

            <Tooltip>
              <Popover
                open={followerOpen}
                onOpenChange={(next) => {
                  setFollowerOpen(next);
                  if (!next) setFollowerSearch("");
                }}
              >
                <PopoverTrigger
                  render={
                    <TooltipTrigger
                      render={
                        <Button
                          type="button"
                          variant="outline"
                          size="icon-sm"
                          className={cn(
                            followerIds.length > 0 && "w-auto gap-1 px-1.5"
                          )}
                          aria-label="Followers"
                        >
                          <BellIcon className="size-3.5" />
                          {followerIds.length > 0 ? (
                            <span className="text-xs font-medium">
                              {followerIds.length}
                            </span>
                          ) : null}
                        </Button>
                      }
                    />
                  }
                />
              <PopoverContent align="end" className="w-72 p-2">
                <p className="px-1 pb-2 text-xs font-semibold text-muted-foreground">
                  Followers
                </p>
                <div className="relative mb-2">
                  <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={followerSearch}
                    onChange={(e) => setFollowerSearch(e.target.value)}
                    placeholder="Search people…"
                    className="h-8 pl-8"
                  />
                </div>
                <ul className="max-h-48 space-y-0.5 overflow-y-auto">
                  {filteredFollowerMembers.length === 0 ? (
                    <li className="px-2 py-3 text-center text-xs text-muted-foreground">
                      No people found
                    </li>
                  ) : (
                    filteredFollowerMembers.map((m) => {
                      const checked = followerIds.includes(m.id);
                      return (
                        <li key={m.id}>
                          <button
                            type="button"
                            className={cn(
                              "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted",
                              checked && "bg-primary/5"
                            )}
                            onClick={() => toggleFollower(m.id)}
                          >
                            <Avatar className="size-6">
                              {m.avatarUrl ? (
                                <AvatarImage src={m.avatarUrl} alt={m.fullName} />
                              ) : null}
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
                            {checked ? (
                              <CheckCircle2Icon className="size-4 text-primary" />
                            ) : null}
                          </button>
                        </li>
                      );
                    })
                  )}
                </ul>
              </PopoverContent>
              </Popover>
              <TooltipContent side="top">Followers</TooltipContent>
            </Tooltip>

            <div className="flex items-center">
              <Button
                type="button"
                onClick={() => void handleCreate("default")}
                loading={saving}
                loadingText="Creating…"
                disabled={!canCreate}
                className="rounded-r-none"
              >
                Create Task
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button
                      type="button"
                      disabled={!canCreate || saving}
                      aria-label="More create options"
                      className="rounded-l-none border-l border-primary-foreground/20 px-1.5"
                    >
                      <ChevronDownIcon className="size-3.5" />
                    </Button>
                  }
                />
                <DropdownMenuContent align="end" className="min-w-64 whitespace-nowrap">
                  <DropdownMenuItem onClick={() => void handleCreate("open")}>
                    Create and open
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => void handleCreate("start-another")}
                  >
                    Create and start another
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => void handleCreate("duplicate")}
                  >
                    Create and duplicate
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>

      <Dialog open={dependenciesOpen} onOpenChange={setDependenciesOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Dependencies</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {DEPENDENCY_SECTIONS.map((section) => (
              <div key={section.type}>
                <p className="pb-1.5 text-xs font-semibold text-muted-foreground">
                  {section.label}
                </p>
                <div className="space-y-1">
                  {dependencies
                    .filter((d) => d.type === section.type)
                    .map((d) => (
                      <div
                        key={d.id}
                        className="flex items-center gap-2 rounded-md border border-border px-2.5 py-1.5"
                      >
                        <LinkIcon className="size-3.5 shrink-0 text-muted-foreground" />
                        <span className="min-w-0 flex-1 truncate text-sm">
                          {d.task.name}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeDependency(d.id)}
                          className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                          aria-label={`Remove ${d.task.name}`}
                        >
                          <XIcon className="size-3.5" />
                        </button>
                      </div>
                    ))}
                  <button
                    type="button"
                    onClick={() => setTaskPickerFor(section.type)}
                    className="flex items-center gap-1 py-1 text-xs text-primary hover:underline"
                  >
                    <PlusIcon className="size-3" />
                    {section.addLabel}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <TaskPickerDialog
        open={taskPickerFor !== null}
        onOpenChange={(next) => {
          if (!next) setTaskPickerFor(null);
        }}
        title={
          DEPENDENCY_SECTIONS.find((s) => s.type === taskPickerFor)?.addLabel ??
          "Add task"
        }
        excludeTaskIds={dependencies
          .filter((d) => d.type === taskPickerFor)
          .map((d) => d.task.id)}
        onSelect={(task) => {
          if (taskPickerFor) addDependency(taskPickerFor, task);
        }}
      />

      <Dialog
        open={renameTarget !== null}
        onOpenChange={(next) => {
          if (!next) {
            setRenameTarget(null);
            setRenameValue("");
          }
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {renameTarget?.type === "checklist"
                ? "Rename checklist"
                : "Rename item"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={submitRename} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="rename-checklist-value">Name</Label>
              <Input
                id="rename-checklist-value"
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                placeholder="Name"
                autoFocus
              />
            </div>
            <Button type="submit" className="w-full" disabled={!renameValue.trim()}>
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
        onConfirm={confirmUnassignAll}
      />
    </Dialog>
  );
}
