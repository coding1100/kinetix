"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  XIcon,
  ChevronDownIcon,
  MessageCircleIcon,
  PalmtreeIcon,
  MailIcon,
  ClockIcon,
  UserLockIcon,
  UsersIcon,
  PlusIcon,
  SearchIcon,
  SlidersHorizontalIcon,
  InfoIcon,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { PresenceDot } from "@/components/shared/AvatarWithPresence";
import { useUserPresence } from "@/stores/presence-store";
import { presenceLabel } from "@/stores/profile-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { PanelCardShell } from "@/components/shared/PanelCardShell";
import { UnderlineTabBar } from "@/components/shared/Tabs";
import { useChatStore, type PersonProfileTab } from "@/stores/chat-store";
import { usePersonProfileMember } from "@/hooks/use-person-profile-member";
import { useOpenDirectMessage } from "@/hooks/use-open-direct-message";
import { useOpenPersonProfile } from "@/hooks/use-open-person-profile";
import { useWorkspaceApi } from "@/hooks/use-workspace-api";
import { useHomeQuery } from "@/hooks/use-home-query";
import { useAuthStore } from "@/stores/auth-store";
import { findDmByUserId } from "@/lib/chat/sidebar-dm";
import { fetchAssignedComments, fetchTasks } from "@/lib/api/home";
import { fetchWorkspacePeople, updateMemberManager } from "@/lib/api/workspace";
import { mockPersonActivity } from "@/lib/mocks/person-profile";
import {
  avatarColorClassForKey,
  avatarInitialFromName,
} from "@/lib/user-display";
import { ROLE_LABELS } from "@/components/workspace/WorkspaceInviteForm";
import { cn, PKT_TIME_ZONE } from "@/lib/utils";
import type { Task } from "@/lib/types/task";
import { PageLoader } from "@/components/ui/page-loader";
import { toast } from "sonner";

function formatLocalTime() {
  return new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: PKT_TIME_ZONE,
  });
}

function IconRow({
  icon,
  children,
  muted,
  className,
}: {
  icon: ReactNode;
  children: ReactNode;
  muted?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-3 py-2", className)}>
      <span className="text-muted-foreground">{icon}</span>
      <div
        className={cn(
          "min-w-0 flex-1 truncate text-sm",
          muted ? "text-muted-foreground" : "text-foreground"
        )}
      >
        {children}
      </div>
    </div>
  );
}

function ActivityCard({
  project,
  breadcrumbs,
  action,
  fromStatus,
  toStatus,
  timestamp,
}: {
  project: string;
  breadcrumbs: string;
  action: string;
  fromStatus: { label: string; color: string };
  toStatus: { label: string; color: string };
  timestamp: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-background p-3">
      <p className="text-sm font-medium leading-snug">{project}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{breadcrumbs}</p>
      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
        <span className="text-foreground">{action.split(" from ")[0]}</span>
        <span>from</span>
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium text-white",
            fromStatus.color
          )}
        >
          {fromStatus.label}
        </span>
        <span>to</span>
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium text-white",
            toStatus.color
          )}
        >
          {toStatus.label}
        </span>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{timestamp}</p>
    </div>
  );
}

export function PersonProfilePanel({
  userId,
  channelId,
}: {
  userId: string;
  channelId?: string;
}) {
  const router = useRouter();
  const { accessToken, workspaceId, ready } = useWorkspaceApi();
  const closePersonProfile = useChatStore((s) => s.closePersonProfile);
  const tab = useChatStore((s) => s.personProfileTab);
  const setPersonProfileTab = useChatStore((s) => s.setPersonProfileTab);
  const { member, loading } = usePersonProfileMember(userId, channelId);
  const { openDirectMessage, openingUserId } = useOpenDirectMessage();
  const { openProfile } = useOpenPersonProfile();
  const liveMemberPresence = useUserPresence(userId, "offline");
  const memberPresence = member?.isDisabled ? "offline" : liveMemberPresence;
  const currentUserId = useAuthStore((s) => s.user?.id);
  const workspaceRole = useAuthStore(
    (s) => s.workspaces.find((w) => w.id === workspaceId)?.role
  );

  const [tasks, setTasks] = useState<Task[]>([]);
  const [comments, setComments] = useState<
    { id: string; task: string; comment: string; author: string; due: string }[]
  >([]);
  const [tabLoading, setTabLoading] = useState(false);
  const [managerRefreshKey, setManagerRefreshKey] = useState(0);
  const [managerPickerOpen, setManagerPickerOpen] = useState(false);
  const [managerSearch, setManagerSearch] = useState("");
  const [savingManager, setSavingManager] = useState(false);

  const displayName = member?.fullName ?? "Member";

  const canEditManager =
    currentUserId === userId ||
    workspaceRole === "OWNER" ||
    workspaceRole === "SUPER_ADMIN" ||
    workspaceRole === "ADMIN";

  const peopleQuery = useHomeQuery(
    (token, ws) => fetchWorkspacePeople(token, ws).then((r) => r.data),
    [managerRefreshKey]
  );
  const people = useMemo(() => peopleQuery.data ?? [], [peopleQuery.data]);
  const profileRow = people.find((p) => p.id === userId);
  const managerId = profileRow?.managerId ?? null;
  const managerName = profileRow?.managerName ?? null;
  const managerCandidates = useMemo(() => {
    const q = managerSearch.trim().toLowerCase();
    return people
      .filter((p) => p.id !== userId)
      .filter((p) => !q || p.fullName.toLowerCase().includes(q));
  }, [people, userId, managerSearch]);

  const [personSwitcherOpen, setPersonSwitcherOpen] = useState(false);
  const [personSwitcherSearch, setPersonSwitcherSearch] = useState("");
  const personSwitcherCandidates = useMemo(() => {
    const q = personSwitcherSearch.trim().toLowerCase();
    return people
      .filter((p) => p.id !== userId)
      .filter((p) => !q || p.fullName.toLowerCase().includes(q));
  }, [people, userId, personSwitcherSearch]);

  async function handleSetManager(nextManagerId: string | null) {
    if (!ready) return;
    setSavingManager(true);
    try {
      await updateMemberManager(accessToken, workspaceId, userId, nextManagerId);
      setManagerPickerOpen(false);
      setManagerSearch("");
      setManagerRefreshKey((k) => k + 1);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update manager");
    } finally {
      setSavingManager(false);
    }
  }

  useEffect(() => {
    const existing = findDmByUserId(workspaceId, userId);
    if (existing) {
      router.prefetch(`/chat/dm/${existing.id}`);
    }
  }, [workspaceId, userId, router]);

  const teamLabel =
    member?.workspaceRole && ROLE_LABELS[member.workspaceRole]
      ? ROLE_LABELS[member.workspaceRole]
      : "Workspace member";

  useEffect(() => {
    if (!ready || tab === "calendar") return;

    let cancelled = false;
    setTabLoading(true);

    const load = async () => {
      try {
        if (tab === "tasks" || tab === "activity") {
          const res = await fetchTasks(accessToken, workspaceId);
          const filtered = res.data.filter((t) =>
            (t.assigneeIds ?? []).includes(userId)
          );
          if (!cancelled) setTasks(filtered);
        } else if (tab === "comments") {
          const res = await fetchAssignedComments(accessToken, workspaceId);
          const filtered = res.data.filter(
            (c) =>
              c.author.toLowerCase() === displayName.toLowerCase() ||
              c.author.toLowerCase() === member?.email?.toLowerCase()
          );
          if (!cancelled) setComments(filtered);
        }
      } catch {
        if (!cancelled) {
          if (tab === "tasks" || tab === "activity") setTasks([]);
          if (tab === "comments") setComments([]);
        }
      } finally {
        if (!cancelled) setTabLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [
    ready,
    tab,
    accessToken,
    workspaceId,
    userId,
    displayName,
    member?.email,
  ]);

  const activity = useMemo(() => {
    if (tasks.length === 0) return [];
    return tasks.map((t) => ({
      id: `act-${t.id}`,
      dateLabel: new Date(t.updatedAt || t.createdAt || Date.now()).toLocaleDateString(undefined, {
        month: "numeric",
        day: "numeric",
        year: "2-digit",
      }),
      project: t.name || "Task",
      breadcrumbs: t.list ? `Space / ${t.list}` : "Workspace / Tasks",
      action: `${displayName} updated task status`,
      fromStatus: { label: "Todo", color: "bg-zinc-400" },
      toStatus: { label: t.status || "In Progress", color: "bg-sky-500" },
      timestamp: t.updatedAt
        ? new Date(t.updatedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
        : "Recently",
    }));
  }, [tasks, displayName]);

  const taskCount = tab === "tasks" ? tasks.length : 0;
  const commentCount = tab === "comments" ? comments.length : 0;

  const tabs: { id: PersonProfileTab; label: string }[] = [
    { id: "activity", label: "Activity" },
    {
      id: "tasks",
      label: taskCount > 0 ? `Tasks (${taskCount})` : "Tasks",
    },
    {
      id: "comments",
      label: commentCount > 0 ? `Comments (${commentCount})` : "Comments",
    },
    { id: "calendar", label: "Calendar" },
  ];

  const messaging = openingUserId === userId;

  return (
    <PanelCardShell
      widthClass="w-[400px]"
      marginClassName="box-border flex h-full shrink-0 py-3 pl-2 pr-1"
    >
      <div className="flex h-12 shrink-0 items-center justify-end px-3 pt-1">
        <Button
          variant="ghost"
          size="icon-sm"
          className="size-7 rounded-full"
          onClick={closePersonProfile}
          aria-label="Close profile"
        >
          <XIcon className="size-4" strokeWidth={1.5} />
        </Button>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className="px-4 pb-4">
          {loading ? (
            <div className="flex justify-center py-8">
              <PageLoader />
            </div>
          ) : (
            <>
              <div className="flex items-start gap-3">
                <Avatar className="size-16 shrink-0 rounded-xl">
                  {member?.avatarUrl ? (
                    <AvatarImage src={member.avatarUrl} alt={displayName} />
                  ) : null}
                  <AvatarFallback
                    className={cn(
                      "rounded-xl text-xl font-semibold",
                      avatarColorClassForKey(userId, displayName)
                    )}
                  >
                    {avatarInitialFromName(displayName)}
                  </AvatarFallback>
                </Avatar>

                <div className="min-w-0 flex-1 pt-1">
                  <Popover
                    open={personSwitcherOpen}
                    onOpenChange={(next) => {
                      setPersonSwitcherOpen(next);
                      if (!next) setPersonSwitcherSearch("");
                    }}
                  >
                    <PopoverTrigger
                      render={
                        <button
                          type="button"
                          className="inline-flex min-w-0 items-center gap-1 text-lg font-semibold hover:text-primary"
                        >
                          <span className="truncate">
                            {displayName}
                            {member?.isDisabled && (
                              <span className="text-destructive"> (deactivated)</span>
                            )}
                          </span>
                          <ChevronDownIcon className="size-4 shrink-0 text-muted-foreground" />
                        </button>
                      }
                    />
                    <PopoverContent align="start" className="w-72 p-2">
                      <div className="relative mb-2">
                        <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          value={personSwitcherSearch}
                          onChange={(e) => setPersonSwitcherSearch(e.target.value)}
                          placeholder="Search people…"
                          className="h-8 pl-8"
                          autoFocus
                        />
                      </div>
                      <ul className="max-h-56 space-y-0.5 overflow-y-auto">
                        {personSwitcherCandidates.length === 0 ? (
                          <li className="px-2 py-3 text-center text-xs text-muted-foreground">
                            No people found
                          </li>
                        ) : (
                          personSwitcherCandidates.map((p) => (
                            <li key={p.id}>
                              <button
                                type="button"
                                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted"
                                onClick={() => {
                                  setPersonSwitcherOpen(false);
                                  setPersonSwitcherSearch("");
                                  openProfile(p.id);
                                }}
                              >
                                <Avatar className="size-6">
                                  <AvatarFallback
                                    className={cn(
                                      "text-[10px] font-semibold",
                                      avatarColorClassForKey(p.id, p.fullName)
                                    )}
                                  >
                                    {avatarInitialFromName(p.fullName)}
                                  </AvatarFallback>
                                </Avatar>
                                <span className="min-w-0 flex-1 truncate">
                                  {p.fullName}
                                </span>
                              </button>
                            </li>
                          ))
                        )}
                      </ul>
                    </PopoverContent>
                  </Popover>

                  <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                    <span>Add description...</span>
                    <span className="h-3.5 w-px bg-border" />
                    <span className="inline-flex items-center gap-1.5">
                      <PresenceDot presence={memberPresence} size="sm" inline />
                      {presenceLabel(memberPresence)}
                    </span>
                  </div>
                </div>
              </div>

              <Button
                type="button"
                variant="outline"
                size="icon"
                className="mt-3 size-9 rounded-lg border-border shadow-sm"
                onClick={() => void openDirectMessage(userId)}
                disabled={messaging}
                aria-label={`Message ${displayName}`}
                title={`Message ${displayName}`}
              >
                {messaging ? (
                  <span className="loader-breathe size-4 rounded-full bg-primary" />
                ) : (
                  <MessageCircleIcon className="size-4" strokeWidth={1.75} />
                )}
              </Button>

              <UnderlineTabBar
                className="mt-5"
                tabs={tabs}
                active={tab}
                onChange={setPersonProfileTab}
                size="compact"
              />

              {tab === "activity" && (
                <div className="mt-4 space-y-1">
                  <IconRow icon={<PalmtreeIcon className="size-4" />} muted>
                    Add time off
                  </IconRow>
                  <IconRow icon={<MailIcon className="size-4" />}>
                    {member?.email ?? "—"}
                  </IconRow>
                  <IconRow icon={<ClockIcon className="size-4" />}>
                    {formatLocalTime()} local time
                  </IconRow>
                  <IconRow icon={<UserLockIcon className="size-4" />}>
                    {managerId ? (
                      <span className="inline-flex items-center gap-1.5">
                        {canEditManager ? (
                          <button
                            type="button"
                            className="shrink-0 rounded-full"
                            onClick={() => void handleSetManager(null)}
                            disabled={savingManager}
                            aria-label={`Remove manager ${managerName ?? ""}`}
                            title="Remove manager"
                          >
                            <Avatar className="size-5">
                              <AvatarFallback
                                className={cn(
                                  "text-[9px] font-semibold",
                                  avatarColorClassForKey(
                                    managerId,
                                    managerName ?? ""
                                  )
                                )}
                              >
                                {avatarInitialFromName(managerName ?? "")}
                              </AvatarFallback>
                            </Avatar>
                          </button>
                        ) : (
                          <Avatar className="size-5 shrink-0">
                            <AvatarFallback
                              className={cn(
                                "text-[9px] font-semibold",
                                avatarColorClassForKey(
                                  managerId,
                                  managerName ?? ""
                                )
                              )}
                            >
                              {avatarInitialFromName(managerName ?? "")}
                            </AvatarFallback>
                          </Avatar>
                        )}
                        <button
                          type="button"
                          className="truncate hover:text-primary hover:underline"
                          onClick={() => openProfile(managerId)}
                        >
                          Reports to {managerName ?? "member"}
                        </button>
                      </span>
                    ) : canEditManager ? (
                      <Popover
                        open={managerPickerOpen}
                        onOpenChange={(next) => {
                          setManagerPickerOpen(next);
                          if (!next) setManagerSearch("");
                        }}
                      >
                        <PopoverTrigger
                          render={
                            <button
                              type="button"
                              className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
                            >
                              Select manager
                              <ChevronDownIcon className="size-3.5" />
                            </button>
                          }
                        />
                        <PopoverContent align="start" className="w-72 p-2">
                          <div className="relative mb-2">
                            <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                              value={managerSearch}
                              onChange={(e) => setManagerSearch(e.target.value)}
                              placeholder="Search or enter email…"
                              className="h-8 pl-8"
                              autoFocus
                            />
                          </div>
                          <ul className="max-h-56 space-y-0.5 overflow-y-auto">
                            {managerCandidates.length === 0 ? (
                              <li className="px-2 py-3 text-center text-xs text-muted-foreground">
                                No people found
                              </li>
                            ) : (
                              managerCandidates.map((p) => (
                                <li key={p.id}>
                                  <button
                                    type="button"
                                    disabled={savingManager}
                                    className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted disabled:pointer-events-none disabled:opacity-60"
                                    onClick={() => void handleSetManager(p.id)}
                                  >
                                    <Avatar className="size-6">
                                      <AvatarFallback
                                        className={cn(
                                          "text-[10px] font-semibold",
                                          avatarColorClassForKey(
                                            p.id,
                                            p.fullName
                                          )
                                        )}
                                      >
                                        {avatarInitialFromName(p.fullName)}
                                      </AvatarFallback>
                                    </Avatar>
                                    <span className="min-w-0 flex-1 truncate">
                                      {p.id === currentUserId ? "Me" : p.fullName}
                                    </span>
                                  </button>
                                </li>
                              ))
                            )}
                          </ul>
                        </PopoverContent>
                      </Popover>
                    ) : (
                      "No manager assigned"
                    )}
                  </IconRow>
                  <IconRow icon={<UsersIcon className="size-4" />}>
                    {teamLabel}
                  </IconRow>

                  <Separator className="my-4" />

                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1 text-sm font-semibold">
                      Priorities
                      <InfoIcon className="size-3.5 text-muted-foreground" />
                    </span>
                    <Button variant="ghost" size="sm" className="h-7 text-xs">
                      <PlusIcon className="size-3.5" />
                      Add
                    </Button>
                  </div>
                  <div className="mt-2 rounded-lg border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
                    + Add your most important tasks here.
                  </div>

                  <div className="mt-5 flex items-center justify-between">
                    <span className="text-sm font-semibold">Activity</span>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="size-7"
                        aria-label="Search activity"
                      >
                        <SearchIcon className="size-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="size-7"
                        aria-label="Filter activity"
                      >
                        <SlidersHorizontalIcon className="size-3.5" />
                      </Button>
                    </div>
                  </div>

                  <div className="mt-3 space-y-4">
                    {tabLoading ? (
                      <div className="flex justify-center py-6">
                        <PageLoader />
                      </div>
                    ) : activity.length === 0 ? (
                      <p className="py-6 text-center text-sm text-muted-foreground">
                        No recent activity recorded for {displayName}.
                      </p>
                    ) : (
                      activity.map((entry, index) => (
                        <div key={entry.id}>
                          {(index === 0 ||
                            activity[index - 1]?.dateLabel !== entry.dateLabel) && (
                            <p className="mb-2 text-xs font-medium text-muted-foreground">
                              {entry.dateLabel}
                            </p>
                          )}
                          <ActivityCard
                            project={entry.project}
                            breadcrumbs={entry.breadcrumbs}
                            action={entry.action}
                            fromStatus={entry.fromStatus}
                            toStatus={entry.toStatus}
                            timestamp={entry.timestamp}
                          />
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {tab === "tasks" && (
                <div className="mt-4">
                  {tabLoading ? (
                    <div className="flex justify-center py-6">
                      <PageLoader />
                    </div>
                  ) : tasks.length === 0 ? (
                    <p className="py-6 text-center text-sm text-muted-foreground">
                      No tasks assigned to {displayName}.
                    </p>
                  ) : (
                    <ul className="space-y-2">
                      {tasks.map((task) => (
                        <li
                          key={task.id}
                          className="rounded-lg border border-border px-3 py-2"
                        >
                          <p className="text-sm font-medium">{task.name}</p>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {task.space} / {task.list}
                          </p>
                          <span
                            className="mt-1.5 inline-block rounded px-1.5 py-0.5 text-[11px] font-medium text-white"
                            style={{ backgroundColor: task.statusColor }}
                          >
                            {task.status}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {tab === "comments" && (
                <div className="mt-4">
                  {tabLoading ? (
                    <div className="flex justify-center py-6">
                      <PageLoader />
                    </div>
                  ) : comments.length === 0 ? (
                    <p className="py-6 text-center text-sm text-muted-foreground">
                      No comments for {displayName}.
                    </p>
                  ) : (
                    <ul className="space-y-2">
                      {comments.map((c) => (
                        <li
                          key={c.id}
                          className="rounded-lg border border-border px-3 py-2"
                        >
                          <p className="text-sm font-medium">{c.task}</p>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {c.comment}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            Due {c.due}
                          </p>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {tab === "calendar" && (
                <div className="mt-4 rounded-lg border border-border p-4">
                  <p className="font-medium">This week</p>
                  <div className="mt-2 grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground">
                    {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
                      <span key={i}>{d}</span>
                    ))}
                  </div>
                  <p className="mt-3 text-sm text-muted-foreground">
                    No meetings scheduled
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </ScrollArea>
    </PanelCardShell>
  );
}
