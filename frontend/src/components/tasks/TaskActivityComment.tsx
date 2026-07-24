"use client";

import { useState } from "react";
import {
  ChevronDownIcon,
  ChevronUpIcon,
  MoreHorizontalIcon,
  PencilIcon,
  SmilePlusIcon,
  ThumbsUpIcon,
  Trash2Icon,
} from "lucide-react";
import type { TaskComment } from "@/lib/types/task";
import type { MentionMember } from "@/hooks/use-mention-members";
import { MessageBodyWithMentions } from "@/components/chat/thread/MessageBodyWithMentions";
import { CommentAttachmentCard } from "@/components/tasks/CommentAttachmentCard";
import { TaskCommentComposer } from "@/components/tasks/TaskCommentComposer";
import { EmojiPickerPopover } from "@/components/chat/emoji/EmojiPickerPopover";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { avatarColorClassForKey, avatarInitialFromName } from "@/lib/user-display";
import { cn, PKT_TIME_ZONE } from "@/lib/utils";

function formatCommentTime(c: TaskComment) {
  if (c.createdAt) {
    const d = new Date(c.createdAt);
    const now = new Date();
    const sameDay =
      d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate();
    const time = d.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      timeZone: PKT_TIME_ZONE,
    });
    if (sameDay) return `Today at ${time}`;
    return d.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZone: PKT_TIME_ZONE,
    });
  }
  return c.at;
}

function CommentBody({ comment }: { comment: TaskComment }) {
  return (
    <div className="mt-1">
      {comment.body ? <MessageBodyWithMentions body={comment.body} /> : null}
      {comment.attachments && comment.attachments.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-2">
          {comment.attachments.map((att) => (
            <CommentAttachmentCard key={att.id} attachment={att} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function CommentActivityItem({
  comment,
  onStartReply,
  isReply = false,
  currentUserId,
  taskId,
  workspaceMembers,
  sending,
  onEdit,
  onDelete,
}: {
  comment: TaskComment;
  onStartReply?: () => void;
  isReply?: boolean;
  currentUserId?: string | null;
  taskId: string | null;
  workspaceMembers?: MentionMember[];
  sending: boolean;
  onEdit: (commentId: string, body: string) => Promise<void>;
  onDelete: (commentId: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [liked, setLiked] = useState(false);
  const [reactions, setReactions] = useState<string[]>([]);
  const canManage = Boolean(currentUserId && comment.authorId === currentUserId);

  const toggleReaction = (emoji: string) => {
    setReactions((prev) =>
      prev.includes(emoji) ? prev.filter((e) => e !== emoji) : [...prev, emoji]
    );
  };

  return (
    <div
      className={cn(
        "group/comment rounded-lg border border-border/60 bg-muted/30 p-3",
        isReply && "relative ml-4"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <Avatar className="size-7">
            <AvatarFallback
              className={cn(
                "text-[11px]",
                avatarColorClassForKey(comment.authorId, comment.author)
              )}
            >
              {avatarInitialFromName(comment.author)}
            </AvatarFallback>
          </Avatar>
          <div>
            <span className="text-sm font-semibold">
              {comment.author}
              {comment.authorIsDisabled && (
                <span className="text-destructive"> (deactivated)</span>
              )}
            </span>{" "}
            <span className="text-xs text-muted-foreground">
              {formatCommentTime(comment)}
              {comment.isEdited ? " · edited" : ""}
            </span>
          </div>
        </div>
        {canManage && !editing ? (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="size-7 text-muted-foreground opacity-0 transition-opacity group-hover/comment:opacity-100"
                  aria-label="Comment actions"
                />
              }
            >
              <MoreHorizontalIcon className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuItem onClick={() => setEditing(true)}>
                <PencilIcon className="size-4" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() => setDeleteOpen(true)}
              >
                <Trash2Icon className="size-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>

      {editing ? (
        <div className="mt-2 pl-9">
          <TaskCommentComposer
            key={`edit-${comment.id}`}
            taskId={taskId}
            workspaceMembers={workspaceMembers}
            initialBody={comment.body}
            compact
            sending={sending}
            placeholder="Edit comment…"
            onCancel={() => setEditing(false)}
            onSubmit={async (body) => {
              await onEdit(comment.id, body);
              setEditing(false);
            }}
          />
        </div>
      ) : (
        <div className="pl-9">
          <CommentBody comment={comment} />
        </div>
      )}

      {!editing ? (
        <div className="mt-2 flex items-center justify-between pl-9">
          <div className="flex items-center gap-1">
            <button
              type="button"
              className={cn(
                "flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium",
                liked
                  ? "bg-primary/15 text-primary hover:bg-primary/20"
                  : "text-muted-foreground hover:bg-muted"
              )}
              onClick={() => setLiked((v) => !v)}
            >
              <ThumbsUpIcon className="size-3.5" />
              {liked ? 1 : null}
            </button>

            <EmojiPickerPopover
              onSelectEmoji={toggleReaction}
              trigger={
                <button
                  type="button"
                  className="flex items-center rounded-full p-1 text-muted-foreground hover:bg-muted"
                  aria-label="Add reaction"
                >
                  <SmilePlusIcon className="size-3.5" />
                </button>
              }
            />

            {reactions.map((emoji) => (
              <button
                key={emoji}
                type="button"
                className="flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-xs text-primary hover:bg-primary/20"
                onClick={() => toggleReaction(emoji)}
              >
                <span>{emoji}</span>
                <span>1</span>
              </button>
            ))}
          </div>
          {onStartReply ? (
            <button
              type="button"
              className="text-xs font-medium text-muted-foreground hover:text-foreground"
              onClick={onStartReply}
            >
              Reply
            </button>
          ) : null}
        </div>
      ) : null}

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete comment?"
        description="This comment and its replies will be permanently deleted."
        confirmLabel="Delete comment"
        loading={deleting}
        onConfirm={async () => {
          setDeleting(true);
          try {
            await onDelete(comment.id);
            setDeleteOpen(false);
          } finally {
            setDeleting(false);
          }
        }}
      />
    </div>
  );
}

export function TaskActivityComment({
  comment,
  taskId,
  workspaceMembers,
  currentUserId,
  replyingToId,
  onStartReply,
  onCancelReply,
  onSubmitReply,
  onEditComment,
  onDeleteComment,
  sending,
}: {
  comment: TaskComment;
  taskId: string | null;
  workspaceMembers?: MentionMember[];
  currentUserId?: string | null;
  replyingToId: string | null;
  onStartReply: (commentId: string) => void;
  onCancelReply: () => void;
  onSubmitReply: (
    parentCommentId: string,
    body: string,
    attachmentIds: string[]
  ) => Promise<void>;
  onEditComment: (commentId: string, body: string) => Promise<void>;
  onDeleteComment: (commentId: string) => Promise<void>;
  sending: boolean;
}) {
  const replies = comment.replies ?? [];
  const replyCount = comment.replyCount ?? replies.length;
  const [expanded, setExpanded] = useState(replyCount > 0);
  const isReplying = replyingToId === comment.id;

  return (
    <div className="group mb-3">
      <CommentActivityItem
        comment={comment}
        onStartReply={() => onStartReply(comment.id)}
        currentUserId={currentUserId}
        taskId={taskId}
        workspaceMembers={workspaceMembers}
        sending={sending}
        onEdit={onEditComment}
        onDelete={onDeleteComment}
      />

      {replyCount > 0 ? (
        <div className="mt-3">
          <button
            type="button"
            className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? (
              <ChevronUpIcon className="size-3.5" />
            ) : (
              <ChevronDownIcon className="size-3.5" />
            )}
            {expanded
              ? "Hide replies"
              : `${replyCount} ${replyCount === 1 ? "reply" : "replies"}`}
          </button>

          {expanded ? (
            <div className="mt-3 space-y-4 border-l-2 border-border/80 pl-4">
              {replies.map((reply) => (
                <CommentActivityItem
                  key={reply.id}
                  comment={reply}
                  isReply
                  currentUserId={currentUserId}
                  taskId={taskId}
                  workspaceMembers={workspaceMembers}
                  sending={sending}
                  onEdit={onEditComment}
                  onDelete={onDeleteComment}
                />
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {isReplying ? (
        <div className="mt-3 border-l-2 border-primary/30 pl-4">
          <p className="mb-2 text-xs text-muted-foreground">
            Replying to <span className="font-medium text-foreground">{comment.author}</span>
          </p>
          <TaskCommentComposer
            taskId={taskId}
            workspaceMembers={workspaceMembers}
            sending={sending}
            compact
            placeholder="Write a reply…"
            onCancel={onCancelReply}
            onSubmit={(body, attachmentIds) =>
              onSubmitReply(comment.id, body, attachmentIds)
            }
          />
        </div>
      ) : null}
    </div>
  );
}
