"use client";

import { useState } from "react";
import type {
  ChatMessage,
  ConversationType,
  UpdateMessagePayload,
} from "@/lib/types/chat";
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
  PinIcon,
  PencilIcon,
  Trash2Icon,
} from "lucide-react";
import { toast } from "sonner";
import { formatRequestError } from "@/lib/api/client";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { resolveMessageAuthorName } from "@/lib/chat/messages";
import {
  avatarColorClassForKey,
  avatarInitialFromName,
} from "@/lib/user-display";
import { MessageAttachmentList } from "@/components/chat/attachments/MessageAttachmentList";
import { MessageBodyWithMentions } from "@/components/chat/thread/MessageBodyWithMentions";
import {
  canEditMessageContent,
  normalizeEditableMessageBody,
} from "@/lib/chat/messages";
import { MessageAuthorButton } from "@/components/chat/MessageAuthorButton";
import { InlineMessageEdit } from "@/components/chat/InlineMessageEdit";
import {
  MessageReadReceipts,
  type ReadReceiptMember,
} from "@/components/chat/MessageReadReceipts";

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
  onDeleteMessage,
  onPinMessage,
  onMarkUnread,
  highlighted = false,
  showReadReceipt = false,
  readReceiptMembersById = {},
}: {
  message: ChatMessage;
  showHeader?: boolean;
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
  highlighted?: boolean;
  showReadReceipt?: boolean;
  readReceiptMembersById?: Record<string, ReadReceiptMember>;
}) {
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const currentUserId = useAuthStore((s) => s.user?.id);
  const currentUserFullName = useAuthStore((s) => s.user?.fullName);
  const activeThreadMessageId = useChatStore((s) => s.activeThreadMessageId);
  const setActiveThread = useChatStore((s) => s.setActiveThread);
  const startComposerEdit = useChatStore((s) => s.startComposerEdit);
  const clearComposerEdit = useChatStore((s) => s.clearComposerEdit);
  const editingMessageId = useChatStore((s) =>
    s.composerEdit?.target === "main" ? s.composerEdit.messageId : null
  );
  const isEditing = editingMessageId === message.id;

  const repliesLabel = threadRepliesLabel(message);
  const isPinned = Boolean(message.pinnedAt);
  const readByUserIds = message.readByUserIds ?? [];
  const threadOpen = activeThreadMessageId === message.id;
  const reactions = message.reactions ?? [];
  const created = new Date(message.createdAt);
  const displayName = resolveMessageAuthorName(message, {
    currentUserId,
    currentUserFullName,
  });
  const canEdit = Boolean(
    currentUserId &&
      message.authorId === currentUserId &&
      onEditMessage &&
      canEditMessageContent(message)
  );
  const canDelete = Boolean(
    currentUserId &&
      message.authorId === currentUserId &&
      onDeleteMessage
  );

  const handleStartEdit = () => {
    if (!canEditMessageContent(message)) return;
    startComposerEdit({
      messageId: message.id,
      body: normalizeEditableMessageBody(message.body),
      target: "main",
      attachments: message.attachments,
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
      {!isEditing && showReadReceipt && readByUserIds.length > 0 ? (
        <div className="pointer-events-auto absolute right-2 top-1 z-[5] transition-opacity group-hover:opacity-0">
          <MessageReadReceipts
            readByUserIds={readByUserIds}
            membersById={readReceiptMembersById}
          />
        </div>
      ) : null}

      {!isEditing ? (
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
              {canDelete && (
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={() => setDeleteOpen(true)}
                >
                  <Trash2Icon className="size-4" />
                  Delete message
                </DropdownMenuItem>
              )}
              <DropdownMenuItem
                onClick={() => toast.success("Link copied")}
              >
                <LinkIcon className="size-4" />
                Copy link
              </DropdownMenuItem>
              {onPinMessage ? (
                <DropdownMenuItem
                  onClick={() => void onPinMessage(message.id, !isPinned)}
                >
                  <PinIcon className="size-4" />
                  {isPinned ? "Unpin message" : "Pin message"}
                </DropdownMenuItem>
              ) : null}
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
      ) : null}

      <div className="flex items-start gap-3">
        {showHeader ? (
          <MessageAuthorButton
            authorId={message.authorId}
            authorName={displayName}
            className="mt-0.5 shrink-0 self-start rounded-full"
          >
            <Avatar className="size-6">
              <AvatarFallback
                className={cn(
                  "text-xs font-semibold",
                  avatarColorClassForKey(message.authorId, displayName)
                )}
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
          {isEditing && onEditMessage ? (
            <InlineMessageEdit
              message={message}
              conversationType={conversationType}
              conversationId={conversationId}
              className={showHeader ? "mt-0.5" : "mt-0"}
              onSave={async (payload) => {
                await onEditMessage(message.id, payload);
                clearComposerEdit();
              }}
              onCancel={clearComposerEdit}
            />
          ) : (
            <>
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
            </>
          )}
          {!isEditing && reactions.length > 0 && (
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
          {!isEditing && repliesLabel && (
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
          {!isEditing && isPinned ? (
            <p className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
              <PinIcon className="size-3" />
              Pinned
            </p>
          ) : null}
        </div>
      </div>
      {canDelete ? (
        <ConfirmDialog
          open={deleteOpen}
          onOpenChange={setDeleteOpen}
          title="Delete message?"
          description="This message will be permanently deleted. This cannot be undone."
          confirmLabel="Delete message"
          loading={deleting}
          onConfirm={async () => {
            if (!onDeleteMessage) return;
            setDeleting(true);
            try {
              await onDeleteMessage(message.id);
              setDeleteOpen(false);
            } catch (err) {
              toast.error(
                `Failed to delete message — ${formatRequestError(err)}`,
                { duration: 8000 }
              );
            } finally {
              setDeleting(false);
            }
          }}
        />
      ) : null}
    </article>
  );
}
