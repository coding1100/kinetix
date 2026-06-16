"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArchiveIcon,
  CalendarIcon,
  CheckCircle2Icon,
  ChevronDownIcon,
  CircleDashedIcon,
  CircleDotIcon,
  CircleIcon,
  FlagIcon,
  FlaskConicalIcon,
  Loader2Icon,
  RocketIcon,
  SearchIcon,
  ShieldCheckIcon,
  SquareCheckBigIcon,
  Undo2Icon,
  UserPlusIcon,
  WandSparklesIcon,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CreateTaskListPicker } from "@/components/spaces/CreateTaskListPicker";
import { toast } from "sonner";
import { fetchWorkspaceMembers } from "@/lib/api/chat";
import { fetchRecents, type SpaceDto } from "@/lib/api/home";
import {
  createListTask,
  fetchListMeta,
  fetchSpacesTree,
  flattenListsFromSpaces,
  patchTask,
} from "@/lib/api/spaces";
import type { ListStatus, Task } from "@/lib/types/task";
import { useWorkspaceApi } from "@/hooks/use-workspace-api";
import { TASK_PRIORITIES, type TaskPriority } from "@/lib/task-priority";
import {
  avatarColorClassForKey,
  avatarInitialFromName,
} from "@/lib/user-display";
import { cn } from "@/lib/utils";

type Member = { id: string; fullName: string };

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

function formatDueChip(value: string) {
  if (!value) return "Due date";
  const date = new Date(`${value}T12:00:00.000Z`);
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export function CreateTaskDialog({
  open,
  onOpenChange,
  defaultListId,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultListId?: string;
  onCreated: (task: Task) => void;
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
  const [statusOpen, setStatusOpen] = useState(false);
  const [dueOpen, setDueOpen] = useState(false);
  const [priorityOpen, setPriorityOpen] = useState(false);
  const [spaces, setSpaces] = useState<SpaceDto[]>([]);
  const [recents, setRecents] = useState<
    { id: string; name: string; href: string; space: string }[]
  >([]);
  const [statuses, setStatuses] = useState<ListStatus[]>([]);
  const [members, setMembers] = useState<Member[]>([]);

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
          rows.find((s) => s.legacyKey === "TODO") ?? rows[0];
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
  }, [open, listId, ready, accessToken, workspaceId]);

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

  const canCreate = useMemo(
    () => Boolean(name.trim() && listId && !saving),
    [name, listId, saving]
  );

  function resetState() {
    setName("");
    setDescription("");
    setStatusId("");
    setPriority(NO_PRIORITY);
    setDueInput("");
    setAssigneeIds([]);
    setAssigneeSearch("");
  }

  function toggleAssignee(userId: string) {
    setAssigneeIds((ids) =>
      ids.includes(userId) ? ids.filter((id) => id !== userId) : [...ids, userId]
    );
  }

  async function handleCreate() {
    if (!canCreate || !ready || !accessToken || !workspaceId) return;
    setSaving(true);
    try {
      const created = await createListTask(accessToken, workspaceId, listId, {
        name: name.trim(),
        description: description.trim() || undefined,
      });
      const payload: Parameters<typeof patchTask>[3] = {};
      if (statusId) payload.statusId = statusId;
      if (priority !== NO_PRIORITY) payload.priority = priority;
      if (assigneeIds.length > 0) payload.assigneeIds = assigneeIds;
      const dueDate = toDueDateIso(dueInput);
      if (dueDate) payload.dueDate = dueDate;

      const shouldPatch = Object.keys(payload).length > 0;
      const finalTask = shouldPatch
        ? await patchTask(accessToken, workspaceId, created.id, payload)
        : created;

      toast.success("Task created");
      onCreated(finalTask);
      onOpenChange(false);
      resetState();
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
                    className="flex min-w-[140px] flex-1 items-center gap-2 rounded-md px-3 py-2 text-left text-xs font-bold tracking-wide text-white uppercase"
                    style={{
                      backgroundColor: selectedStatus?.color ?? "#87909e",
                    }}
                  >
                    <StatusIcon className="size-3.5 shrink-0" />
                    <span className="truncate">
                      {selectedStatus?.name ?? "Status"}
                    </span>
                    <ChevronDownIcon className="ml-auto size-3.5 opacity-80" />
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
                    className="h-9 gap-2 bg-muted/20"
                  >
                    {selectedAssignees.length > 0 ? (
                      <span className="flex items-center gap-1">
                        {selectedAssignees.slice(0, 2).map((m) => (
                          <Avatar key={m.id} className="size-5">
                            <AvatarFallback
                              className={cn(
                                "text-[9px] font-semibold",
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
                      <UserPlusIcon className="size-4 text-muted-foreground" />
                    )}
                    <span className="text-sm">
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
                    className="h-9 gap-2 bg-muted/20"
                  >
                    <CalendarIcon className="size-4 text-muted-foreground" />
                    <span className="text-sm">{formatDueChip(dueInput)}</span>
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
                    className="h-9 gap-2 bg-muted/20"
                  >
                    <FlagIcon className="size-4 text-muted-foreground" />
                    <span className="text-sm capitalize">
                      {priority === NO_PRIORITY
                        ? "Priority"
                        : TASK_PRIORITIES.find((p) => p.value === priority)
                            ?.label ?? priority}
                    </span>
                  </Button>
                }
              />
              <PopoverContent align="start" className="w-44 p-1">
                <button
                  type="button"
                  className="flex w-full rounded-md px-2 py-2 text-sm hover:bg-muted"
                  onClick={() => {
                    setPriority(NO_PRIORITY);
                    setPriorityOpen(false);
                  }}
                >
                  None
                </button>
                {TASK_PRIORITIES.map((p) => (
                  <button
                    key={p.value}
                    type="button"
                    className={cn(
                      "flex w-full rounded-md px-2 py-2 text-sm hover:bg-muted",
                      priority === p.value && "bg-muted"
                    )}
                    onClick={() => {
                      setPriority(p.value);
                      setPriorityOpen(false);
                    }}
                  >
                    {p.label}
                  </button>
                ))}
              </PopoverContent>
            </Popover>
          </div>
        </div>

        <DialogFooter className="flex-row items-center justify-between border-t border-border px-4 py-3 sm:justify-between">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-muted-foreground"
            onClick={() => toast("Templates — coming soon")}
          >
            Templates
          </Button>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => void handleCreate()}
              loading={saving}
              loadingText="Creating…"
              disabled={!canCreate}
            >
              Create Task
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
