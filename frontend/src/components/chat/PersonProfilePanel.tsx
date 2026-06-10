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
import { AvatarWithPresence, PresenceDot } from "@/components/shared/AvatarWithPresence";
import { useUserPresence } from "@/stores/presence-store";
import { presenceLabel } from "@/stores/profile-store";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { PanelCardShell } from "@/components/shared/PanelCardShell";
import { UnderlineTabBar } from "@/components/shared/Tabs";
import { useChatStore, type PersonProfileTab } from "@/stores/chat-store";
import { usePersonProfileMember } from "@/hooks/use-person-profile-member";
import { useOpenDirectMessage } from "@/hooks/use-open-direct-message";
import { useWorkspaceApi } from "@/hooks/use-workspace-api";
import { findDmByUserId } from "@/lib/chat/sidebar-dm";
import { fetchAssignedComments, fetchTasks } from "@/lib/api/home";
import { mockPersonActivity } from "@/lib/mocks/person-profile";
import {
  avatarColorClassForKey,
  avatarInitialFromName,
} from "@/lib/user-display";
import { ROLE_LABELS } from "@/components/workspace/WorkspaceInviteForm";
import { cn } from "@/lib/utils";
import type { Task } from "@/lib/types/task";
import { PageLoader } from "@/components/ui/page-loader";

function formatLocalTime() {
  return new Date().toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

function InfoRow({
  icon,
  label,
  value,
  muted,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  muted?: boolean;
}) {
  return (
    <div className="flex items-start gap-3 py-2">
      <span className="mt-0.5 text-muted-foreground">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p
          className={cn(
            "truncate text-sm",
            muted ? "text-muted-foreground" : "text-foreground"
          )}
        >
          {value}
        </p>
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
  const memberPresence = useUserPresence(userId, "offline");

  const [tasks, setTasks] = useState<Task[]>([]);
  const [comments, setComments] = useState<
    { id: string; task: string; comment: string; author: string; due: string }[]
  >([]);
  const [tabLoading, setTabLoading] = useState(false);

  const displayName = member?.fullName ?? "Member";
  const activity = useMemo(
    () => mockPersonActivity(displayName),
    [displayName]
  );

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
    if (!ready || tab === "activity" || tab === "calendar") return;

    let cancelled = false;
    setTabLoading(true);

    const load = async () => {
      try {
        if (tab === "tasks") {
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
          if (tab === "tasks") setTasks([]);
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
              <div className="flex flex-col items-center text-center">
                <AvatarWithPresence
                  presence={memberPresence}
                  dotSize="md"
                  borderClass="border-card"
                >
                  <Avatar className="size-20 rounded-xl">
                    {member?.avatarUrl ? (
                      <AvatarImage src={member.avatarUrl} alt={displayName} />
                    ) : null}
                    <AvatarFallback
                      className={cn(
                        "rounded-xl text-2xl font-semibold",
                        avatarColorClassForKey(userId, displayName)
                      )}
                    >
                      {avatarInitialFromName(displayName)}
                    </AvatarFallback>
                  </Avatar>
                </AvatarWithPresence>

                <button
                  type="button"
                  className="mt-3 inline-flex items-center gap-1 text-lg font-semibold hover:text-primary"
                >
                  {displayName}
                  <ChevronDownIcon className="size-4 text-muted-foreground" />
                </button>

                <p className="mt-1 text-sm text-muted-foreground">
                  Add description...
                </p>

                <div className="mt-2 flex items-center gap-1.5 text-sm text-muted-foreground">
                  <PresenceDot presence={memberPresence} size="sm" inline />
                  <span>{presenceLabel(memberPresence)}</span>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="mt-3 size-10 rounded-lg border-border shadow-sm"
                  onClick={() => void openDirectMessage(userId)}
                  disabled={messaging}
                  aria-label={`Message ${displayName}`}
                  title={`Message ${displayName}`}
                >
                  {messaging ? (
                    <span className="loader-breathe size-4 rounded-full bg-primary" />
                  ) : (
                    <MessageCircleIcon className="size-5" strokeWidth={1.75} />
                  )}
                </Button>
              </div>

              <UnderlineTabBar
                className="mt-5"
                tabs={tabs}
                active={tab}
                onChange={setPersonProfileTab}
                size="compact"
              />

              {tab === "activity" && (
                <div className="mt-4 space-y-1">
                  <InfoRow
                    icon={<PalmtreeIcon className="size-4" />}
                    label="Add time off"
                    value="Add time off"
                  />
                  <InfoRow
                    icon={<MailIcon className="size-4" />}
                    label="Email"
                    value={member?.email ?? "—"}
                  />
                  <InfoRow
                    icon={<ClockIcon className="size-4" />}
                    label="Local time"
                    value={`${formatLocalTime()} local time`}
                  />
                  <InfoRow
                    icon={<UserLockIcon className="size-4" />}
                    label="Manager"
                    value="No manager assigned"
                    muted
                  />
                  <InfoRow
                    icon={<UsersIcon className="size-4" />}
                    label="Team"
                    value={teamLabel}
                  />

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
                    {activity.map((entry, index) => (
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
                    ))}
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
