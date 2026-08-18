"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  CircleCheckIcon,
  MicIcon,
  MicOffIcon,
  PhoneCallIcon,
  PhoneOffIcon,
  PlayCircleIcon,
  RadioTowerIcon,
  SaveIcon,
  UsersIcon,
} from "lucide-react";
import { toast } from "sonner";
import { ApiError } from "@/lib/api/client";
import {
  endChannelHuddle,
  fetchChannel,
  fetchChannelHuddles,
  joinChannelHuddle,
  leaveChannelHuddle,
  startChannelHuddle,
  updateChannelHuddle,
  updateMyChannelHuddle,
} from "@/lib/api/chat";
import { ChannelSurfaceNav } from "./ChannelSurfaceNav";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageLoader } from "@/components/ui/page-loader";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { useHomeQuery } from "@/hooks/use-home-query";
import { useWorkspaceApi } from "@/hooks/use-workspace-api";
import { useAuthStore } from "@/stores/auth-store";
import { useChatStore } from "@/stores/chat-store";
import type { Channel, ChannelHuddle } from "@/lib/types/chat";
import { cn, formatRelativeTime } from "@/lib/utils";

function huddleDuration(startedAt: string, endedAt?: string | null) {
  const start = new Date(startedAt).getTime();
  const end = endedAt ? new Date(endedAt).getTime() : Date.now();
  const total = Math.max(0, Math.floor((end - start) / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function HuddleAvatar({ name, avatarUrl }: { name: string; avatarUrl?: string | null }) {
  const initials = name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <Avatar className="size-8">
      {avatarUrl ? <AvatarImage src={avatarUrl} alt={name} /> : null}
      <AvatarFallback className="text-[11px] font-semibold">{initials}</AvatarFallback>
    </Avatar>
  );
}

export function ChannelHuddleView({ channelId }: { channelId: string }) {
  const { accessToken, workspaceId, ready } = useWorkspaceApi();
  const currentUserId = useAuthStore((s) => s.user?.id);
  const refreshKey = useChatStore((s) => s.channelSurfaceRefreshKey[channelId] ?? 0);
  const [title, setTitle] = useState("Live huddle");
  const [notes, setNotes] = useState("");
  const [active, setActive] = useState<ChannelHuddle | null>(null);
  const [history, setHistory] = useState<ChannelHuddle[]>([]);
  const [saving, setSaving] = useState(false);
  const [action, setAction] = useState<"start" | "join" | "leave" | "end" | "mute" | null>(null);
  const [elapsed, setElapsed] = useState("0:00");
  const dirtyRef = useRef(false);
  const saveTimer = useRef<number | null>(null);

  const channelQuery = useHomeQuery(
    (token, ws) => fetchChannel(token, ws, channelId),
    [channelId, refreshKey]
  );
  const huddlesQuery = useHomeQuery(
    (token, ws) => fetchChannelHuddles(token, ws, channelId),
    [channelId, refreshKey]
  );

  const channel = channelQuery.data as Channel | undefined;
  const subtitle = useMemo(() => {
    if (!channel) return "Huddle room";
    return channel.topic?.trim() ? channel.topic : `Held inside #${channel.name}`;
  }, [channel]);

  useEffect(() => {
    const current = huddlesQuery.data?.current ?? null;
    if (!huddlesQuery.data || dirtyRef.current) return;
    setActive(current);
    setHistory(huddlesQuery.data.data);
    if (current) {
      setTitle(current.title || "Live huddle");
      setNotes(current.notes || "");
      setElapsed(huddleDuration(current.startedAt, current.endedAt));
    } else {
      setTitle("Live huddle");
      setNotes("");
      setElapsed("0:00");
    }
  }, [huddlesQuery.data]);

  useEffect(() => {
    if (!active?.isActive) return;
    const timer = window.setInterval(() => {
      setElapsed(huddleDuration(active.startedAt, active.endedAt));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [active?.startedAt, active?.endedAt, active?.isActive]);

  useEffect(
    () => () => {
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
    },
    []
  );

  const persist = async (nextTitle = title, nextNotes = notes) => {
    if (!ready || !accessToken || !workspaceId || !active?.id) return;
    setSaving(true);
    try {
      const updated = await updateChannelHuddle(
        accessToken,
        workspaceId,
        channelId,
        active.id,
        { title: nextTitle.trim() || "Live huddle", notes: nextNotes }
      );
      setActive(updated);
      setHistory((prev) => [updated, ...prev.filter((item) => item.id !== updated.id)].slice(0, 5));
      dirtyRef.current = false;
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to save huddle");
    } finally {
      setSaving(false);
    }
  };

  const schedulePersist = () => {
    if (!active?.id) return;
    dirtyRef.current = true;
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      void persist();
    }, 700);
  };

  const start = async () => {
    if (!ready || !accessToken || !workspaceId) return;
    setAction("start");
    try {
      const created = await startChannelHuddle(accessToken, workspaceId, channelId, {
        title: title.trim() || "Live huddle",
        notes,
      });
      setActive(created);
      setHistory((prev) => [created, ...prev].slice(0, 5));
      setElapsed(huddleDuration(created.startedAt, created.endedAt));
      dirtyRef.current = false;
      toast.success("Huddle started");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not start huddle");
    } finally {
      setAction(null);
    }
  };

  const join = async () => {
    if (!ready || !accessToken || !workspaceId || !active?.id) return;
    setAction("join");
    try {
      const updated = await joinChannelHuddle(accessToken, workspaceId, channelId, active.id);
      setActive(updated);
      setHistory((prev) => [updated, ...prev.filter((item) => item.id !== updated.id)].slice(0, 5));
      toast.success("Joined huddle");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not join huddle");
    } finally {
      setAction(null);
    }
  };

  const leave = async () => {
    if (!ready || !accessToken || !workspaceId || !active?.id) return;
    setAction("leave");
    try {
      const updated = await leaveChannelHuddle(accessToken, workspaceId, channelId, active.id);
      setActive(updated);
      setHistory((prev) => [updated, ...prev.filter((item) => item.id !== updated.id)].slice(0, 5));
      toast.success("Left huddle");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not leave huddle");
    } finally {
      setAction(null);
    }
  };

  const end = async () => {
    if (!ready || !accessToken || !workspaceId || !active?.id) return;
    setAction("end");
    try {
      const updated = await endChannelHuddle(accessToken, workspaceId, channelId, active.id);
      setActive(updated);
      setHistory((prev) => [updated, ...prev.filter((item) => item.id !== updated.id)].slice(0, 5));
      toast.success("Huddle ended");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not end huddle");
    } finally {
      setAction(null);
    }
  };

  const toggleMute = async () => {
    if (!ready || !accessToken || !workspaceId || !active?.id) return;
    const me = active.participants.find((p) => p.id === currentUserId);
    const muted = !(me?.isMuted ?? false);
    setAction("mute");
    try {
      const updated = await updateMyChannelHuddle(accessToken, workspaceId, channelId, active.id, {
        muted,
      });
      setActive(updated);
      setHistory((prev) => [updated, ...prev.filter((item) => item.id !== updated.id)].slice(0, 5));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not update mute state");
    } finally {
      setAction(null);
    }
  };

  if (channelQuery.loading || huddlesQuery.loading) {
    return <PageLoader label="Loading huddle..." />;
  }

  const joined = Boolean(active?.currentUserJoined);
  const me = active?.participants.find((p) => p.id === currentUserId);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-card">
      <div className="border-b border-border">
        <div className="px-4 pt-3">
          <ChannelSurfaceNav
            channelId={channelId}
            active="huddle"
            className="border-0 px-0 py-0"
          />
        </div>
        <div className="flex items-start justify-between gap-4 px-4 py-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <RadioTowerIcon className="size-4 text-primary" />
              <h1 className="truncate text-sm font-semibold">
                {channel?.name ? `#${channel.name}` : "Huddle"}
              </h1>
              {active?.isActive ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                  <CircleCheckIcon className="size-3.5" />
                  Live
                </span>
              ) : (
                <span className="rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">
                  No active huddle
                </span>
              )}
            </div>
            <p className="mt-1 truncate text-sm text-muted-foreground">{subtitle}</p>
          </div>
          <div className="flex items-center gap-2">
            {active?.isActive ? (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={toggleMute}
                  loading={action === "mute"}
                >
                  {me?.isMuted ? <MicOffIcon className="size-4" /> : <MicIcon className="size-4" />}
                  {me?.isMuted ? "Unmute" : "Mute"}
                </Button>
                {joined ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    onClick={leave}
                    loading={action === "leave"}
                  >
                    <PhoneOffIcon className="size-4" />
                    Leave
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    onClick={join}
                    loading={action === "join"}
                  >
                    <PhoneCallIcon className="size-4" />
                    Join
                  </Button>
                )}
                <Button
                  variant="secondary"
                  size="sm"
                  className="gap-1.5"
                  onClick={end}
                  loading={action === "end"}
                >
                  End
                </Button>
              </>
            ) : (
              <Button
                variant="default"
                size="sm"
                className="gap-1.5"
                onClick={start}
                loading={action === "start"}
              >
                <PlayCircleIcon className="size-4" />
                Start huddle
              </Button>
            )}
          </div>
        </div>
      </div>
      <Separator />
      <ScrollArea className="min-h-0 flex-1">
        <div className="grid min-h-0 grid-cols-1 gap-4 p-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
          <section className="rounded-lg border border-border bg-background p-4 shadow-sm">
            <div className="space-y-3">
              <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
                <div>
                  <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Huddle title
                  </label>
                  <Input
                    value={title}
                    onChange={(e) => {
                      setTitle(e.target.value);
                      schedulePersist();
                    }}
                    placeholder="Live huddle"
                    disabled={!active?.isActive}
                  />
                </div>
                <div className="flex items-end">
                  <Button
                    variant="outline"
                    className="gap-1.5"
                    onClick={() => void persist()}
                    loading={saving}
                    disabled={!active?.isActive}
                  >
                    <SaveIcon className="size-4" />
                    Save
                  </Button>
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Live notes
                </label>
                <Textarea
                  value={notes}
                  onChange={(e) => {
                    setNotes(e.target.value);
                    schedulePersist();
                  }}
                  className="min-h-[320px] font-mono text-sm leading-6"
                  placeholder="Capture decisions, blockers, and next steps as the huddle runs."
                  disabled={!active?.isActive}
                />
              </div>
            </div>
          </section>

          <section className="space-y-4 rounded-lg border border-border bg-muted/20 p-4 shadow-sm">
            <div className="rounded-lg border border-border bg-background p-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold">Live state</h2>
                <span className="text-xs text-muted-foreground">
                  {active?.isActive ? `Running for ${elapsed}` : "Idle"}
                </span>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                {active?.isActive
                  ? `${active.participantCount} participant${active.participantCount === 1 ? "" : "s"} in the room`
                  : "Start a huddle to bring this channel into a live room."}
              </p>
              {active ? (
                <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                  <span className="rounded-full border border-border px-2 py-1">
                    Started {formatRelativeTime(new Date(active.startedAt))}
                  </span>
                  {active.endedAt ? (
                    <span className="rounded-full border border-border px-2 py-1">
                      Ended {formatRelativeTime(new Date(active.endedAt))}
                    </span>
                  ) : null}
                </div>
              ) : null}
            </div>

            <div className="rounded-lg border border-border bg-background p-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold">Participants</h2>
                <UsersIcon className="size-4 text-muted-foreground" />
              </div>
              {active?.participants.length ? (
                <div className="mt-3 space-y-2">
                  {active.participants.map((participant) => (
                    <div
                      key={participant.id}
                      className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2"
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <HuddleAvatar
                          name={participant.fullName}
                          avatarUrl={participant.avatarUrl}
                        />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">
                            {participant.fullName}
                            {participant.id === currentUserId ? " (you)" : ""}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            Joined {formatRelativeTime(new Date(participant.joinedAt))}
                          </p>
                        </div>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {participant.isMuted ? "Muted" : "Speaking"}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-3 text-sm text-muted-foreground">
                  No one is in the huddle yet.
                </p>
              )}
            </div>

            <div className="rounded-lg border border-border bg-background p-4">
              <h2 className="text-sm font-semibold">Recent huddles</h2>
              {history.length ? (
                <div className="mt-3 space-y-2">
                  {history.map((item) => (
                    <div
                      key={item.id}
                      className={cn(
                        "rounded-md border border-border px-3 py-2 text-sm",
                        item.isActive && "border-primary/40 bg-primary/5"
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate font-medium">{item.title}</span>
                        <span className="text-xs text-muted-foreground">
                          {item.isActive ? "Active" : "Ended"}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {formatRelativeTime(new Date(item.startedAt))} · {item.participantCount} participant{item.participantCount === 1 ? "" : "s"}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-3 text-sm text-muted-foreground">
                  No previous huddles yet.
                </p>
              )}
            </div>
          </section>
        </div>
      </ScrollArea>
    </div>
  );
}
