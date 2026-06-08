"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { SendIcon, SparklesIcon } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  buildAssistantReply,
  type AssistantContext,
} from "@/lib/ai/workspace-assistant";
import {
  fetchNotifications,
  fetchReminders,
  fetchTasks,
} from "@/lib/api/home";
import { useTopBarStore } from "@/stores/topbar-store";
import { useWorkspaceApi } from "@/hooks/use-workspace-api";
import type { Task } from "@/lib/types/task";
import { cn } from "@/lib/utils";

type ChatMessage = { id: string; role: "user" | "assistant"; text: string };

const STARTER: ChatMessage = {
  id: "welcome",
  role: "assistant",
  text: "Hi — I can summarize your inbox, upcoming tasks, and reminders. What would you like to know?",
};

function tasksDueWithinDays(tasks: Task[], days: number): Task[] {
  const end = Date.now() + days * 86400000;
  return tasks.filter((t) => {
    if (!t.dueDateIso) return false;
    const d = new Date(t.dueDateIso).getTime();
    return !Number.isNaN(d) && d <= end;
  });
}

export function AiAssistantSheet() {
  const activeSheet = useTopBarStore((s) => s.activeSheet);
  const closeSheet = useTopBarStore((s) => s.closeSheet);
  const open = activeSheet === "ai";
  const { accessToken, workspaceId, ready } = useWorkspaceApi();
  const [messages, setMessages] = useState<ChatMessage[]>([STARTER]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [context, setContext] = useState<AssistantContext | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const loadContext = useCallback(async () => {
    if (!accessToken || !workspaceId) return null;
    const [notifRes, tasksRes, remindersRes] = await Promise.all([
      fetchNotifications(accessToken, workspaceId),
      fetchTasks(accessToken, workspaceId),
      fetchReminders(accessToken, workspaceId),
    ]);
    return {
      unreadNotifications: notifRes.unreadCount,
      notifications: notifRes.data,
      tasksDueSoon: tasksDueWithinDays(tasksRes.data, 14),
      reminders: remindersRes.data,
    };
  }, [accessToken, workspaceId]);

  useEffect(() => {
    if (!open || !ready) return;
    let cancelled = false;
    void loadContext().then((ctx) => {
      if (!cancelled && ctx) setContext(ctx);
    });
    return () => {
      cancelled = true;
    };
  }, [open, ready, loadContext]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, thinking]);

  const send = async () => {
    const text = input.trim();
    if (!text || thinking) return;
    setInput("");
    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: "user",
      text,
    };
    setMessages((m) => [...m, userMsg]);
    setThinking(true);
    try {
      const ctx = context ?? (await loadContext());
      if (ctx) setContext(ctx);
      const reply = buildAssistantReply(
        text,
        ctx ?? {
          unreadNotifications: 0,
          notifications: [],
          tasksDueSoon: [],
          reminders: [],
        }
      );
      setMessages((m) => [
        ...m,
        { id: `a-${Date.now()}`, role: "assistant", text: reply },
      ]);
    } finally {
      setThinking(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={(o) => !o && closeSheet()}>
      <SheetContent side="right" className="flex w-full flex-col sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <SparklesIcon className="size-4 text-primary" />
            Kinetix AI
          </SheetTitle>
          <SheetDescription>
            Workspace assistant — inbox, tasks, and reminders from your live data.
          </SheetDescription>
        </SheetHeader>
        <ScrollArea className="min-h-0 flex-1 rounded-lg border border-border bg-muted/30">
          <div className="space-y-3 p-3">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={cn(
                  "max-w-[90%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap",
                  msg.role === "user"
                    ? "ml-auto bg-primary text-primary-foreground"
                    : "bg-card text-foreground shadow-sm"
                )}
              >
                {msg.text}
              </div>
            ))}
            {thinking ? (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Spinner size="sm" label="Thinking" />
                Thinking…
              </p>
            ) : null}
            <div ref={scrollRef} />
          </div>
        </ScrollArea>
        <div className="flex gap-2 pt-2">
          <Input
            placeholder="Ask about inbox, tasks, reminders…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
          />
          <Button
            size="icon"
            aria-label="Send"
            disabled={!input.trim()}
            loading={thinking}
            onClick={() => void send()}
          >
            <SendIcon className="size-4" />
          </Button>
        </div>
        <div className="flex flex-wrap gap-1 pt-1">
          {[
            "What's unread?",
            "Tasks due soon",
            "My reminders",
          ].map((chip) => (
            <Button
              key={chip}
              variant="secondary"
              size="xs"
              className="rounded-full"
              disabled={thinking}
              onClick={() => {
                setInput(chip);
              }}
            >
              {chip}
            </Button>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
