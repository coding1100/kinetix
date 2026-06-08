"use client";

import { XIcon } from "lucide-react";
import type { ChatMessage } from "@/lib/types/chat";
import { useChatStore } from "@/stores/chat-store";
import { PanelCardShell } from "@/components/shared/PanelCardShell";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatRelativeTime } from "@/lib/utils";

export function DmRepliesPanel({ messages }: { messages: ChatMessage[] }) {
  const setDmDetailsView = useChatStore((s) => s.setDmDetailsView);
  const setActiveThread = useChatStore((s) => s.setActiveThread);

  const threads = messages.filter((m) => (m.threadCount ?? 0) > 0);

  const handleOpen = (messageId: string) => {
    setActiveThread(messageId);
    setDmDetailsView(null);
  };

  return (
    <PanelCardShell
      widthClass="w-[340px]"
      marginClassName="box-border flex h-full shrink-0 py-3 pl-2 pr-1"
    >
      <div className="flex h-12 shrink-0 items-center justify-between px-4 pt-1">
        <span className="text-sm font-semibold">Replies</span>
        <Button
          variant="ghost"
          size="icon-sm"
          className="size-7 rounded-full"
          onClick={() => setDmDetailsView(null)}
          aria-label="Close replies"
        >
          <XIcon className="size-4" strokeWidth={1.5} />
        </Button>
      </div>
      <Separator />
      <ScrollArea className="min-h-0 flex-1">
        <div className="p-4">
          {threads.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No threads with replies in this conversation.
            </p>
          ) : (
            <ul className="space-y-2">
              {threads.map((msg) => {
                const count = msg.threadCount ?? 0;
                return (
                  <li key={msg.id}>
                    <button
                      type="button"
                      className="w-full rounded-lg border border-border px-3 py-2 text-left transition-colors hover:bg-muted/40"
                      onClick={() => handleOpen(msg.id)}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-medium">
                          {msg.authorName}
                        </span>
                      </div>
                      <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">
                        {msg.body || "Attachment"}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {count} {count === 1 ? "reply" : "replies"} ·{" "}
                        {formatRelativeTime(new Date(msg.createdAt))}
                      </p>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </ScrollArea>
    </PanelCardShell>
  );
}
