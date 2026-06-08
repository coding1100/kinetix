"use client";

import { useState } from "react";
import type { ChatMessage } from "@/lib/types/chat";
import { formatChatMessageTime } from "@/lib/chat/dates";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth-store";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EmojiPickerPopover } from "@/components/chat/emoji/EmojiPickerPopover";
import { MessageEditInline } from "@/components/chat/MessageEditInline";
import { MessageBodyWithMentions } from "./MessageBodyWithMentions";
import { MessageAttachmentList } from "@/components/chat/attachments/MessageAttachmentList";
import {
  SmilePlusIcon,
  MoreHorizontalIcon,
  PencilIcon,
} from "lucide-react";
import { toast } from "sonner";
import { avatarInitialFromName } from "@/lib/user-display";
import { MessageAuthorButton } from "@/components/chat/MessageAuthorButton";

const AVATAR_BY_AUTHOR: Record<string, string> = {
  "Jordan Lee": "bg-violet-600 text-white",
  "Alex Rivera": "bg-sky-600 text-white",
  "Sam Chen": "bg-emerald-600 text-white",
  "Morgan Blake": "bg-amber-700 text-white",
  You: "bg-primary text-primary-foreground",
};

function avatarClass(authorName: string) {
  return (
    AVATAR_BY_AUTHOR[authorName] ??
    "bg-muted text-sm font-medium text-muted-foreground"
  );
}

export function ThreadMessageRow({
  message,
  showHeader = true,
  onToggleReaction,
  onEditMessage,
}: {
  message: ChatMessage;
  showHeader?: boolean;
  onToggleReaction: (messageId: string, emoji: string) => void | Promise<void>;
  onEditMessage?: (messageId: string, body: string) => Promise<void>;
}) {
  const currentUserId = useAuthStore((s) => s.user?.id);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const reactions = message.reactions ?? [];
  const created = new Date(message.createdAt);
  const canEdit = Boolean(
    currentUserId && message.authorId === currentUserId && onEditMessage
  );

  const handleSaveEdit = async (body: string) => {
    if (!onEditMessage) return;
    setSaving(true);
    try {
      await onEditMessage(message.id, body);
      setEditing(false);
    } catch {
      toast.error("Failed to save message");
    } finally {
      setSaving(false);
    }
  };

  return (
    <article
      className={cn(
        "group relative -mx-2 rounded-md px-2 transition-colors hover:bg-muted/70",
        showHeader ? "py-1" : "py-0.5"
      )}
    >
      {canEdit && (
        <div className="pointer-events-none absolute right-1 top-1 z-10 opacity-0 transition-opacity group-hover:opacity-100">
          <div className="pointer-events-auto flex items-center gap-1 rounded-md border border-border bg-card px-1 py-0.5 shadow-sm">
            <EmojiPickerPopover
              onSelectEmoji={(emoji) => void onToggleReaction(message.id, emoji)}
              trigger={
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  className="size-6"
                  aria-label="Add reaction"
                >
                  <SmilePlusIcon className="size-3.5" strokeWidth={1.5} />
                </Button>
              }
            />
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    className="size-6"
                    aria-label="More actions"
                  >
                    <MoreHorizontalIcon className="size-3.5" />
                  </Button>
                }
              />
              <DropdownMenuContent align="end" className="w-40">
                <DropdownMenuItem onClick={() => setEditing(true)}>
                  <PencilIcon className="size-4" />
                  Edit message
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      )}

      <div className="flex gap-2.5 pr-14">
        {showHeader ? (
          <MessageAuthorButton
            authorId={message.authorId}
            authorName={message.authorName}
            className="shrink-0 rounded-full"
          >
            <Avatar className="size-8">
              <AvatarFallback
                className={cn(
                  "text-xs font-semibold",
                  avatarClass(message.authorName)
                )}
              >
                {avatarInitialFromName(message.authorName)}
              </AvatarFallback>
            </Avatar>
          </MessageAuthorButton>
        ) : null}
        <div className={cn("min-w-0 flex-1", !showHeader && "ml-9")}>
          {showHeader && (
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0">
              <MessageAuthorButton
                authorId={message.authorId}
                authorName={message.authorName}
                className="text-sm font-semibold text-foreground hover:text-primary"
              >
                {message.authorName}
              </MessageAuthorButton>
              <time
                className="text-xs text-muted-foreground"
                dateTime={message.createdAt}
              >
                {formatChatMessageTime(created)}
              </time>
            </div>
          )}
          {editing ? (
            <MessageEditInline
              initialBody={message.body}
              saving={saving}
              onSave={handleSaveEdit}
              onCancel={() => setEditing(false)}
            />
          ) : (
            <div className={showHeader ? "mt-1" : "mt-0"}>
              {message.body ? (
                <MessageBodyWithMentions body={message.body} />
              ) : null}
              <MessageAttachmentList attachments={message.attachments ?? []} />
            </div>
          )}
          {!editing && reactions.length > 0 && (
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {reactions.map((r) => (
                <button
                  key={r.emoji}
                  type="button"
                  className="inline-flex h-6 items-center gap-1 rounded-full border border-border bg-muted/40 px-2 text-xs hover:bg-muted"
                  onClick={() => void onToggleReaction(message.id, r.emoji)}
                >
                  <span className="text-base leading-none">{r.emoji}</span>
                  <span className="text-muted-foreground">{r.count}</span>
                </button>
              ))}
              {!canEdit && (
                <EmojiPickerPopover
                  onSelectEmoji={(emoji) =>
                    void onToggleReaction(message.id, emoji)
                  }
                  trigger={
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      className="size-6 text-muted-foreground"
                      aria-label="Add reaction"
                    >
                      <SmilePlusIcon className="size-3.5" strokeWidth={1.5} />
                    </Button>
                  }
                />
              )}
            </div>
          )}
          {!editing && reactions.length === 0 && !canEdit && (
            <div className="mt-2">
              <EmojiPickerPopover
                onSelectEmoji={(emoji) =>
                  void onToggleReaction(message.id, emoji)
                }
                trigger={
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="size-6 text-muted-foreground"
                    aria-label="Add reaction"
                  >
                    <SmilePlusIcon className="size-3.5" strokeWidth={1.5} />
                  </Button>
                }
              />
            </div>
          )}
        </div>
      </div>
    </article>
  );
}
