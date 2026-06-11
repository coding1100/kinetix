"use client";

import { useState } from "react";
import type { ChatMessage, UpdateMessagePayload } from "@/lib/types/chat";
import { formatChatMessageTime } from "@/lib/chat/dates";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth-store";
import { useChatStore } from "@/stores/chat-store";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EmojiPickerPopover } from "@/components/chat/emoji/EmojiPickerPopover";
import { MessageBodyWithMentions } from "./MessageBodyWithMentions";
import { MessageAttachmentList } from "@/components/chat/attachments/MessageAttachmentList";
import {
  SmilePlusIcon,
  MoreHorizontalIcon,
  PencilIcon,
  Trash2Icon,
} from "lucide-react";
import { toast } from "sonner";
import { formatRequestError } from "@/lib/api/client";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import {
  canEditMessageContent,
  normalizeEditableMessageBody,
  resolveMessageAuthorName,
} from "@/lib/chat/messages";
import {
  avatarColorClassForKey,
  avatarInitialFromName,
} from "@/lib/user-display";
import { MessageAuthorButton } from "@/components/chat/MessageAuthorButton";
import { InlineMessageEdit } from "@/components/chat/InlineMessageEdit";
import type { ConversationType } from "@/lib/types/chat";

export function ThreadMessageRow({
  message,
  showHeader = true,
  conversationType,
  conversationId,
  onToggleReaction,
  onEditMessage,
  onDeleteMessage,
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
}) {
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const currentUserId = useAuthStore((s) => s.user?.id);
  const currentUserFullName = useAuthStore((s) => s.user?.fullName);
  const displayName = resolveMessageAuthorName(message, {
    currentUserId,
    currentUserFullName,
  });
  const startComposerEdit = useChatStore((s) => s.startComposerEdit);
  const clearComposerEdit = useChatStore((s) => s.clearComposerEdit);
  const editingMessageId = useChatStore((s) =>
    s.composerEdit?.target === "thread" ? s.composerEdit.messageId : null
  );
  const isEditing = editingMessageId === message.id;
  const reactions = message.reactions ?? [];
  const created = new Date(message.createdAt);
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
      target: "thread",
      attachments: message.attachments,
    });
  };

  return (
    <article
      className={cn(
        "group relative -mx-2 rounded-md px-2 transition-colors hover:bg-muted/70",
        showHeader ? "py-0.1" : "py-0.1",
        editingMessageId === message.id && "bg-primary/10 ring-1 ring-primary/30"
      )}
    >
      {(canEdit || canDelete) && !isEditing && (
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
              <DropdownMenuContent align="end" className="w-44">
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
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      )}

      <div className="flex items-start gap-2.5 pr-14">
        {showHeader ? (
          <MessageAuthorButton
            authorId={message.authorId}
            authorName={displayName}
            className="shrink-0 self-start rounded-full"
          >
            <Avatar className="size-8">
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
        <div className={cn("min-w-0 flex-1", !showHeader && "ml-9")}>
          {showHeader && (
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0">
              <MessageAuthorButton
                authorId={message.authorId}
                authorName={displayName}
                className="text-sm font-semibold text-foreground hover:text-primary"
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
          <div className={showHeader ? "mt-1" : "mt-0"}>
            {isEditing && onEditMessage ? (
              <InlineMessageEdit
                message={message}
                conversationType={conversationType}
                conversationId={conversationId}
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
                    data-quote-scope="thread"
                    data-message-author-id={message.authorId}
                    data-message-author-name={displayName}
                  >
                    <MessageBodyWithMentions body={message.body} />
                  </div>
                ) : null}
                <MessageAttachmentList attachments={message.attachments ?? []} />
              </>
            )}
          </div>
          {reactions.length > 0 && (
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
          {reactions.length === 0 && !canEdit && (
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
