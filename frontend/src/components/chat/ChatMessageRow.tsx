"use client";

import type { ChatMessage, ConversationType } from "@/lib/types/chat";
import { formatChatMessageTime } from "@/lib/chat/dates";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth-store";
import { useChatStore } from "@/stores/chat-store";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EmojiPickerPopover } from "@/components/chat/emoji/EmojiPickerPopover";
import {
  MessageCircleIcon,
  SmilePlusIcon,
  MoreHorizontalIcon,
  LinkIcon,
  BellIcon,
  PencilIcon,
} from "lucide-react";
import { toast } from "sonner";
import { resolveMessageAuthorName } from "@/lib/chat/messages";
import { avatarInitialFromName } from "@/lib/user-display";
import { MessageAttachmentList } from "@/components/chat/attachments/MessageAttachmentList";
import { MessageBodyWithMentions } from "@/components/chat/thread/MessageBodyWithMentions";
import { MessageAuthorButton } from "@/components/chat/MessageAuthorButton";

const AVATAR_BY_AUTHOR: Record<string, string> = {
  You: "bg-primary text-primary-foreground",
  "Alex Rivera": "bg-sky-600 text-white",
  "Jordan Lee": "bg-violet-600 text-white",
  "Sam Chen": "bg-emerald-600 text-white",
  "Morgan Blake": "bg-amber-700 text-white",
};

function avatarClass(authorName: string) {
  return (
    AVATAR_BY_AUTHOR[authorName] ??
    "bg-muted text-xs font-medium text-muted-foreground"
  );
}

function threadRepliesLabel(msg: ChatMessage): string | null {
  if (!msg.threadCount || msg.threadCount <= 0) return null;
  const n = msg.threadCount;
  return `${n} ${n === 1 ? "reply" : "replies"}`;
}

export function ChatMessageRow({
  message,
  showHeader = true,
  conversationType,
  conversationId,
  onToggleReaction,
  onEditMessage,
  onMarkUnread,
  highlighted = false,
}: {
  message: ChatMessage;
  showHeader?: boolean;
  conversationType?: ConversationType;
  conversationId?: string;
  onToggleReaction: (messageId: string, emoji: string) => void | Promise<void>;
  onEditMessage?: (messageId: string, body: string) => Promise<void>;
  onMarkUnread?: () => void | Promise<void>;
  highlighted?: boolean;
}) {
  const currentUserId = useAuthStore((s) => s.user?.id);
  const currentUserFullName = useAuthStore((s) => s.user?.fullName);
  const activeThreadMessageId = useChatStore((s) => s.activeThreadMessageId);
  const setActiveThread = useChatStore((s) => s.setActiveThread);
  const startComposerEdit = useChatStore((s) => s.startComposerEdit);
  const editingMessageId = useChatStore((s) =>
    s.composerEdit?.target === "main" ? s.composerEdit.messageId : null
  );

  const repliesLabel = threadRepliesLabel(message);
  const threadOpen = activeThreadMessageId === message.id;
  const reactions = message.reactions ?? [];
  const created = new Date(message.createdAt);
  const displayName = resolveMessageAuthorName(message, {
    currentUserId,
    currentUserFullName,
  });
  const canEdit = Boolean(
    currentUserId && message.authorId === currentUserId && onEditMessage
  );

  const handleStartEdit = () => {
    if (!message.body.trim()) return;
    startComposerEdit({
      messageId: message.id,
      body: message.body,
      target: "main",
    });
  };

  return (
    <article
      id={`message-${message.id}`}
      className={cn(
        "group relative -mx-3 rounded-md px-3 transition-colors",
        showHeader ? "py-1" : "py-0.5",
        "hover:bg-muted/70",
        threadOpen && "bg-muted/50",
        highlighted && "bg-primary/10 ring-1 ring-primary/30",
        editingMessageId === message.id && "bg-primary/10 ring-1 ring-primary/30"
      )}
    >
      <div className="pointer-events-none absolute right-2 top-1 z-10 opacity-0 transition-opacity group-hover:opacity-100">
        <div className="pointer-events-auto flex items-center gap-1 rounded-md border border-border bg-card px-1.5 py-0.5 shadow-sm">
          <Button
            variant="ghost"
            size="icon-xs"
            className="size-6"
            aria-label="Reply in thread"
            onClick={() => setActiveThread(threadOpen ? null : message.id)}
          >
            <MessageCircleIcon className="size-3.5" />
          </Button>
          <EmojiPickerPopover
            onSelectEmoji={(emoji) => void onToggleReaction(message.id, emoji)}
            trigger={
              <Button
                variant="ghost"
                size="icon-xs"
                className="size-6"
                aria-label="Add reaction"
              >
                <SmilePlusIcon className="size-3.5" />
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
                  aria-label="More message actions"
                >
                  <MoreHorizontalIcon className="size-3.5" />
                </Button>
              }
            />
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem
                onClick={() =>
                  setActiveThread(threadOpen ? null : message.id)
                }
              >
                <MessageCircleIcon className="size-4" />
                Reply in thread
              </DropdownMenuItem>
              {canEdit && (
                <DropdownMenuItem onClick={handleStartEdit}>
                  <PencilIcon className="size-4" />
                  Edit message
                </DropdownMenuItem>
              )}
              <DropdownMenuItem
                onClick={() => toast.success("Link copied")}
              >
                <LinkIcon className="size-4" />
                Copy link
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => {
                  if (onMarkUnread) void onMarkUnread();
                  else toast.success("Marked as unread");
                }}
              >
                <BellIcon className="size-4" />
                Mark unread
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="flex items-start gap-3">
        {showHeader ? (
          <MessageAuthorButton
            authorId={message.authorId}
            authorName={displayName}
            className="mt-0.5 shrink-0 self-start rounded-full"
          >
            <Avatar className="size-6">
              <AvatarFallback
                className={cn("text-xs font-semibold", avatarClass(displayName))}
              >
                {avatarInitialFromName(displayName)}
              </AvatarFallback>
            </Avatar>
          </MessageAuthorButton>
        ) : null}
        <div className={cn("min-w-0 flex-1 pr-16", !showHeader && "ml-10")}>
          {showHeader && (
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0">
              <MessageAuthorButton
                authorId={message.authorId}
                authorName={displayName}
                className="text-sm font-bold text-foreground hover:text-primary"
              >
                {displayName}
              </MessageAuthorButton>
              <time
                className="text-xs text-muted-foreground"
                dateTime={message.createdAt}
              >
                {formatChatMessageTime(created)}
              </time>
            </div>
          )}
          {message.body ? (
            <div
              className={showHeader ? "mt-0.5" : "mt-0"}
              data-quote-scope="main"
              data-message-author-id={message.authorId}
              data-message-author-name={displayName}
            >
              <MessageBodyWithMentions body={message.body} />
            </div>
          ) : null}
          <MessageAttachmentList attachments={message.attachments ?? []} />
          {reactions.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {reactions.map((r) => (
                <Badge
                  key={r.emoji}
                  variant="outline"
                  className="h-6 cursor-pointer gap-1 px-2"
                  onClick={() => void onToggleReaction(message.id, r.emoji)}
                >
                  <span className="text-base leading-none">{r.emoji}</span>
                  <span>{r.count}</span>
                </Badge>
              ))}
            </div>
          )}
          {repliesLabel && (
            <Button
              variant="link"
              className={cn(
                "h-auto p-0 text-xs font-medium",
                threadOpen && "text-primary underline"
              )}
              onClick={() => setActiveThread(threadOpen ? null : message.id)}
            >
              {repliesLabel}
            </Button>
          )}
        </div>
      </div>
    </article>
  );
}
