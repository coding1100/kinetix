"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangleIcon,
  PencilLineIcon,
  RefreshCwIcon,
  SaveIcon,
  SparklesIcon,
} from "lucide-react";
import { toast } from "sonner";
import { ApiError } from "@/lib/api/client";
import { fetchChannel, fetchChannelCanvas, updateChannelCanvas } from "@/lib/api/chat";
import { ChannelSurfaceNav } from "./ChannelSurfaceNav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageLoader } from "@/components/ui/page-loader";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { useHomeQuery } from "@/hooks/use-home-query";
import { useWorkspaceApi } from "@/hooks/use-workspace-api";
import { useChatStore } from "@/stores/chat-store";
import { cn, formatRelativeTime } from "@/lib/utils";
import type { Channel } from "@/lib/types/chat";

function renderPreview(body: string) {
  return body.split("\n").map((line, index) => {
    const trimmed = line.trim();
    if (!trimmed) return <div key={index} className="h-3" />;
    if (trimmed.startsWith("# ")) {
      return (
        <h3 key={index} className="text-base font-semibold text-foreground">
          {trimmed.slice(2)}
        </h3>
      );
    }
    if (trimmed.startsWith("## ")) {
      return (
        <h4 key={index} className="text-sm font-semibold text-foreground">
          {trimmed.slice(3)}
        </h4>
      );
    }
    if (trimmed.startsWith("- [ ]")) {
      return (
        <div key={index} className="flex items-start gap-2 text-sm text-foreground">
          <span className="mt-0.5 size-3 rounded border border-border" />
          <span>{trimmed.slice(5).trim()}</span>
        </div>
      );
    }
    if (trimmed.startsWith("- ")) {
      return (
        <div key={index} className="flex items-start gap-2 text-sm text-foreground">
          <span className="mt-2 size-1.5 rounded-full bg-muted-foreground" />
          <span>{trimmed.slice(2)}</span>
        </div>
      );
    }
    return (
      <p key={index} className="text-sm leading-6 text-foreground">
        {trimmed}
      </p>
    );
  });
}

export function ChannelCanvasView({ channelId }: { channelId: string }) {
  const { accessToken, workspaceId, ready } = useWorkspaceApi();
  const refreshKey = useChatStore((s) => s.channelSurfaceRefreshKey[channelId] ?? 0);
  const [title, setTitle] = useState("Canvas");
  const [body, setBody] = useState("");
  const [dirty, setDirty] = useState(false);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">(
    "idle"
  );
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [remoteUpdatePending, setRemoteUpdatePending] = useState(false);
  const saveTimer = useRef<number | null>(null);
  const draftRef = useRef({ title: "Canvas", body: "" });
  const revisionRef = useRef(0);
  const dirtyRef = useRef(false);
  const savingRef = useRef(false);
  const queuedSaveRef = useRef(false);
  const saveRef = useRef<() => Promise<void>>(async () => undefined);

  const channelQuery = useHomeQuery(
    (token, ws) => fetchChannel(token, ws, channelId),
    [channelId, refreshKey]
  );
  const canvasQuery = useHomeQuery(
    (token, ws) => fetchChannelCanvas(token, ws, channelId),
    [channelId, refreshKey]
  );

  const channel = channelQuery.data as Channel | undefined;
  const subtitle = useMemo(() => {
    if (!channel) return "Workspace canvas";
    return channel.topic?.trim()
      ? channel.topic
      : `Shared with ${channel.memberCount} member${channel.memberCount === 1 ? "" : "s"}`;
  }, [channel]);

  useEffect(() => {
    const canvas = canvasQuery.data;
    if (!canvas) return;
    if (dirtyRef.current || savingRef.current) {
      if (canvas.revision > revisionRef.current) setRemoteUpdatePending(true);
      return;
    }
    draftRef.current = { title: canvas.title || "Canvas", body: canvas.body || "" };
    revisionRef.current = canvas.revision;
    setTitle(canvas.title || "Canvas");
    setBody(canvas.body || "");
    setLastSavedAt(canvas.updatedAt);
    setDirty(false);
    setStatus(canvas.id ? "saved" : "idle");
    setRemoteUpdatePending(false);
  }, [canvasQuery.data]);

  useEffect(
    () => () => {
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
    },
    []
  );

  const save = async () => {
    if (!ready || !accessToken || !workspaceId) return;
    if (savingRef.current) {
      queuedSaveRef.current = true;
      return;
    }
    if (saveTimer.current) {
      window.clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    savingRef.current = true;
    const draft = { ...draftRef.current };
    setStatus("saving");
    try {
      const next = await updateChannelCanvas(accessToken, workspaceId, channelId, {
        title: draft.title.trim() || "Canvas",
        body: draft.body,
        expectedRevision: revisionRef.current,
      });
      revisionRef.current = next.revision;
      setLastSavedAt(next.updatedAt);
      setRemoteUpdatePending(false);
      const hasNewerDraft =
        draftRef.current.title !== draft.title || draftRef.current.body !== draft.body;
      dirtyRef.current = hasNewerDraft;
      setDirty(hasNewerDraft);
      setStatus(hasNewerDraft ? "idle" : "saved");
      if (!hasNewerDraft) {
        draftRef.current = { title: next.title, body: next.body };
        setTitle(next.title);
        setBody(next.body);
      }
    } catch (err) {
      setStatus("error");
      if (err instanceof ApiError && err.code === "CANVAS_CONFLICT") {
        setRemoteUpdatePending(true);
        toast.error("This canvas changed elsewhere. Choose which version to keep.");
      } else {
        toast.error(err instanceof ApiError ? err.message : "Failed to save canvas");
      }
    } finally {
      savingRef.current = false;
      if (queuedSaveRef.current) {
        queuedSaveRef.current = false;
        window.setTimeout(() => void save(), 0);
      }
    }
  };
  useEffect(() => {
    saveRef.current = save;
  });

  const scheduleSave = () => {
    dirtyRef.current = true;
    setDirty(true);
    setStatus("idle");
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      void save();
    }, 700);
  };

  const updateDraft = (nextTitle: string, nextBody: string) => {
    draftRef.current = { title: nextTitle, body: nextBody };
    setTitle(nextTitle);
    setBody(nextBody);
    scheduleSave();
  };

  const loadLatest = async () => {
    if (!ready || !accessToken || !workspaceId) return;
    try {
      const latest = await fetchChannelCanvas(accessToken, workspaceId, channelId);
      draftRef.current = { title: latest.title || "Canvas", body: latest.body || "" };
      revisionRef.current = latest.revision;
      dirtyRef.current = false;
      setTitle(draftRef.current.title);
      setBody(draftRef.current.body);
      setLastSavedAt(latest.updatedAt);
      setDirty(false);
      setStatus(latest.id ? "saved" : "idle");
      setRemoteUpdatePending(false);
      toast.success("Loaded the latest canvas");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to load the latest canvas");
    }
  };

  const keepMine = async () => {
    if (!ready || !accessToken || !workspaceId) return;
    try {
      const latest = await fetchChannelCanvas(accessToken, workspaceId, channelId);
      revisionRef.current = latest.revision;
      setRemoteUpdatePending(false);
      await save();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to resolve canvas changes");
    }
  };

  useEffect(() => {
    const warnBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!dirtyRef.current) return;
      event.preventDefault();
      event.returnValue = "";
    };
    const saveWhenHidden = () => {
      if (document.visibilityState === "hidden" && dirtyRef.current) {
        void saveRef.current();
      }
    };
    window.addEventListener("beforeunload", warnBeforeUnload);
    document.addEventListener("visibilitychange", saveWhenHidden);
    return () => {
      window.removeEventListener("beforeunload", warnBeforeUnload);
      document.removeEventListener("visibilitychange", saveWhenHidden);
    };
  }, []);

  if (channelQuery.loading || canvasQuery.loading) {
    return <PageLoader label="Loading canvas..." />;
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-card">
      <div className="border-b border-border">
        <div className="px-4 pt-3">
          <ChannelSurfaceNav
            channelId={channelId}
            active="canvas"
            className="border-0 px-0 py-0"
          />
        </div>
        <div className="flex items-start justify-between gap-4 px-4 py-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <SparklesIcon className="size-4 text-primary" />
              <h1 className="truncate text-sm font-semibold">
                {channel?.name ? `#${channel.name}` : "Canvas"}
              </h1>
            </div>
            <p className="mt-1 truncate text-sm text-muted-foreground">{subtitle}</p>
          </div>
          <div className="flex items-center gap-2">
            {lastSavedAt ? (
              <span className="text-xs text-muted-foreground">
                Updated {formatRelativeTime(new Date(lastSavedAt))}
              </span>
            ) : null}
            <Button
              variant="outline"
              size="sm"
              className={cn("gap-1.5")}
              loading={status === "saving"}
              onClick={() => void save()}
            >
              <SaveIcon className="size-4" />
              Save
            </Button>
          </div>
        </div>
      </div>
      <Separator />
      {remoteUpdatePending ? (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-amber-300 bg-amber-50 px-4 py-2 text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
          <div className="flex min-w-0 items-center gap-2 text-sm">
            <AlertTriangleIcon className="size-4 shrink-0" />
            <span>This canvas was updated in another session.</span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="gap-1.5" onClick={loadLatest}>
              <RefreshCwIcon className="size-4" />
              Load latest
            </Button>
            <Button variant="secondary" size="sm" onClick={keepMine}>
              Keep my version
            </Button>
          </div>
        </div>
      ) : null}
      <ScrollArea className="min-h-0 flex-1">
        <div className="grid min-h-0 grid-cols-1 gap-4 p-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
          <section className="rounded-lg border border-border bg-background p-4 shadow-sm">
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Title
                </label>
                <Input
                  value={title}
                  onChange={(e) => {
                    updateDraft(e.target.value, draftRef.current.body);
                  }}
                  placeholder="Canvas title"
                  maxLength={120}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Canvas notes
                </label>
                <Textarea
                  value={body}
                  onChange={(e) => {
                    updateDraft(draftRef.current.title, e.target.value);
                  }}
                  className="min-h-[420px] font-mono text-sm leading-6"
                  placeholder="# Project plan\n- Goals\n- Open questions\n- Decisions"
                  maxLength={50000}
                />
              </div>
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs text-muted-foreground">
                  Use headings, bullets, and checkboxes to keep the surface easy to scan.
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => {
                    updateDraft("Canvas", "# Summary\n- ");
                  }}
                >
                  <PencilLineIcon className="size-4" />
                  Reset draft
                </Button>
              </div>
            </div>
          </section>

          <section className="rounded-lg border border-border bg-muted/20 p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold">Preview</h2>
              <span className="text-xs text-muted-foreground">
                {status === "saved"
                  ? "Saved"
                  : status === "saving"
                    ? "Saving..."
                    : status === "error"
                      ? "Save failed"
                      : dirty
                        ? "Unsaved changes"
                        : "Ready"}
              </span>
            </div>
            <div className="space-y-3 rounded-lg border border-border bg-background p-4">
              <div className="min-w-0">
                <p className="text-[22px] font-semibold leading-tight">
                  {title || "Canvas"}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Live knowledge surface for this channel
                </p>
              </div>
              <div className="space-y-2">{renderPreview(body)}</div>
            </div>
          </section>
        </div>
      </ScrollArea>
    </div>
  );
}
