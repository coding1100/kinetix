"use client";

import { useEffect, useMemo, useRef } from "react";
import type {
  ChatMessage,
  ConversationType,
  UpdateMessagePayload,
} from "@/lib/types/chat";
import {
  groupMessagesByDay,
  resolveJumpDayKey,
  type ChatJumpOption,
} from "@/lib/chat/dates";
import { ChatDateDivider } from "@/components/chat/ChatDateDivider";
import { ChatMessageRow } from "@/components/chat/ChatMessageRow";
import { buildMessageRuns } from "@/lib/chat/message-groups";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

export function MessageList({
  messages,
  conversationType,
  conversationId,
  onToggleReaction,
  onEditMessage,
  onDeleteMessage,
  onPinMessage,
  onMarkUnread,
  hasMoreOlder,
  loadingOlder,
  onLoadOlder,
  scrollToMessageId,
  highlightMessageId,
  onScrollComplete,
}: {
  messages: ChatMessage[];
  conversationType?: ConversationType;
  conversationId?: string;
  onToggleReaction: (messageId: string, emoji: string) => void | Promise<void>;
  onEditMessage?: (
    messageId: string,
    payload: UpdateMessagePayload
  ) => Promise<void>;
  onDeleteMessage?: (messageId: string) => Promise<void>;
  onPinMessage?: (messageId: string, pinned: boolean) => void | Promise<void>;
  onMarkUnread?: () => void | Promise<void>;
  hasMoreOlder?: boolean;
  loadingOlder?: boolean;
  onLoadOlder?: () => void;
  scrollToMessageId?: string | null;
  highlightMessageId?: string | null;
  onScrollComplete?: () => void;
}) {
  const endRef = useRef<HTMLDivElement>(null);
  const daySectionRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const dayGroups = useMemo(() => groupMessagesByDay(messages), [messages]);

  useEffect(() => {
    if (scrollToMessageId) return;
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages, scrollToMessageId]);

  useEffect(() => {
    if (!scrollToMessageId) return;
    const el = document.getElementById(`message-${scrollToMessageId}`);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    onScrollComplete?.();
  }, [scrollToMessageId, messages, onScrollComplete]);

  const scrollToDayKey = (dayKey: string) => {
    daySectionRefs.current[dayKey]?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  const handleJump = (option: ChatJumpOption) => {
    const dayKey = resolveJumpDayKey(option, dayGroups);
    if (dayKey) scrollToDayKey(dayKey);
  };

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-34" data-quote-scope="main">
      <div className="py-4">
        {hasMoreOlder ? (
          <div className="mb-3 flex justify-center">
            <Button
              variant="outline"
              size="sm"
              className="h-8 rounded-full"
              disabled={loadingOlder}
              onClick={onLoadOlder}
            >
              {loadingOlder ? (
                <>
                  <Spinner className="size-3.5" />
                  Loading…
                </>
              ) : (
                "Load older messages"
              )}
            </Button>
          </div>
        ) : null}
        {dayGroups.map((group) => (
          <div
            key={group.dayKey}
            ref={(el) => {
              daySectionRefs.current[group.dayKey] = el;
            }}
          >
            <ChatDateDivider label={group.label} onJump={handleJump} />
            <div className="space-y-2">
              {buildMessageRuns(group.messages).map((run) => (
                <div
                  key={`${group.dayKey}-${run.authorId}-${run.messages[0]?.id}`}
                  className="space-y-0"
                >
                  {run.messages.map((msg, index) => (
                    <ChatMessageRow
                      key={msg.id}
                      message={msg}
                      showHeader={index === 0}
                      conversationType={conversationType}
                      conversationId={conversationId}
                      onToggleReaction={onToggleReaction}
                      onEditMessage={onEditMessage}
                      onDeleteMessage={onDeleteMessage}
                      onPinMessage={onPinMessage}
                      onMarkUnread={onMarkUnread}
                      highlighted={highlightMessageId === msg.id}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>
        ))}
        <div ref={endRef} className="h-px shrink-0" aria-hidden />
      </div>
    </div>
  );
}
