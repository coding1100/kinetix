"use client";

import { useState } from "react";
import {
  MessageCircleIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  MoreHorizontalIcon,
  PencilIcon,
  Trash2Icon,
} from "lucide-react";
import type { TaskComment } from "@/lib/types/task";
import type { MentionMember } from "@/hooks/use-mention-members";
import { MessageBodyWithMentions } from "@/components/chat/thread/MessageBodyWithMentions";
import { CommentAttachmentCard } from "@/components/tasks/CommentAttachmentCard";
import { TaskCommentComposer } from "@/components/tasks/TaskCommentComposer";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

function formatCommentTime(c: TaskComment) {
  if (c.createdAt) {
    const d = new Date(c.createdAt);
    const now = new Date();
    const sameDay =
      d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate();
    const time = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    if (sameDay) return `Today at ${time}`;
    return d.toLocaleString([], {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
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
  verb,
  isReply = false,
  currentUserId,
  taskId,
  workspaceMembers,
  sending,
  onEdit,
  onDelete,
}: {
  comment: TaskComment;
  verb: "commented" | "replied";
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
  const canManage = Boolean(currentUserId && comment.authorId === currentUserId);

  return (
    <div className={cn("group", isReply && "relative pl-4 before:absolute before:left-0 before:top-0 before:bottom-0 before:w-0.5 before:rounded-full before:bg-border")}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm">
          <span className="font-semibold">{comment.author}</span>{" "}
          <span className="text-muted-foreground">{verb}</span>
        </p>
        {canManage && !editing ? (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="size-7 opacity-0 transition-opacity group-hover:opacity-100"
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
        <div className="mt-2">
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
        <>
          <CommentBody comment={comment} />
          <p className="mt-1 text-xs text-muted-foreground">
            {formatCommentTime(comment)}
            {comment.isEdited ? " · edited" : ""}
          </p>
        </>
      )}

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
    <div className="group mb-5">
      <div className="mb-1 flex justify-end">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:text-foreground"
          onClick={() => onStartReply(comment.id)}
        >
          <MessageCircleIcon className="mr-1 size-3.5" />
          Reply
        </Button>
      </div>

      <CommentActivityItem
        comment={comment}
        verb="commented"
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
                  verb="replied"
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
