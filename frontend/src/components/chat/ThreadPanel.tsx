"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  XIcon,
  UserSquare2Icon,
  ListTodoIcon,
  ChevronDownIcon,
  SearchIcon,
  ListChecksIcon,
} from "lucide-react";
import type {
  ConversationType,
  ThreadBundle,
  UpdateMessagePayload,
} from "@/lib/types/chat";
import {
  fetchChannelThread,
  fetchDmThread,
  sendChannelThreadReply,
  sendDmThreadReply,
  updateChatMessage,
} from "@/lib/api/chat";
import { useWorkspaceApi } from "@/hooks/use-workspace-api";
import { ApiError } from "@/lib/api/client";
import { useChatStore } from "@/stores/chat-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PanelCardShell } from "@/components/shared/PanelCardShell";
import { Separator } from "@/components/ui/separator";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";
import { ThreadMessageRow } from "./thread/ThreadMessageRow";
import { ThreadReplyComposer } from "./thread/ThreadReplyComposer";
import { PageLoader } from "@/components/ui/page-loader";
import {
  ATTACHMENT_PLACEHOLDER,
  createOptimisticMessage,
  mergeConfirmedMessage,
  mergeIncomingMessage,
  normalizeMessageForViewer,
  resolveMessageAuthorName,
} from "@/lib/chat/messages";
import type { ChatMessage, SendMessagePayload } from "@/lib/types/chat";
import { buildMessageRuns } from "@/lib/chat/message-groups";
import { useAuthStore } from "@/stores/auth-store";
import { createTaskFromThreadMessage } from "@/lib/spaces/create-task-from-thread";
import { fetchSpacesTree, flattenListsFromSpaces } from "@/lib/api/spaces";

function getThreadTitle(
  parent: ChatMessage,
  currentUserId?: string,
  currentUserFullName?: string
) {
  const name = resolveMessageAuthorName(parent, {
    currentUserId,
    currentUserFullName,
  });
  return `Thread with ${name}`;
}

export function ThreadPanel({
  type,
  conversationId,
  messageId,
  channelLabel,
  onReplySent,
  onToggleReaction,
  onDeleteMessage,
}: {
  type: ConversationType;
  conversationId: string;
  messageId: string;
  channelLabel?: string;
  onReplySent?: () => void;
  onToggleReaction: (messageId: string, emoji: string) => void | Promise<void>;
  onDeleteMessage: (messageId: string) => Promise<void>;
}) {
  const { accessToken, workspaceId, ready } = useWorkspaceApi();
  const currentUserId = useAuthStore((s) => s.user?.id);
  const currentUserFullName = useAuthStore((s) => s.user?.fullName);
  const setActiveThread = useChatStore((s) => s.setActiveThread);
  const clearComposerEdit = useChatStore((s) => s.clearComposerEdit);
  const realtimeEvent = useChatStore((s) => s.realtimeEvent);
  const clearRealtimeEvent = useChatStore((s) => s.clearRealtimeEvent);
  const messageEditEvent = useChatStore((s) => s.messageEditEvent);
  const clearMessageEditEvent = useChatStore((s) => s.clearMessageEditEvent);
  const messageDeleteEvent = useChatStore((s) => s.messageDeleteEvent);
  const clearMessageDeleteEvent = useChatStore(
    (s) => s.clearMessageDeleteEvent
  );
  const reactionEvent = useChatStore((s) => s.reactionEvent);
  const clearReactionEvent = useChatStore((s) => s.clearReactionEvent);
  const router = useRouter();
  const [bundle, setBundle] = useState<ThreadBundle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creatingTask, setCreatingTask] = useState(false);
  const [createTaskOpen, setCreateTaskOpen] = useState(false);
  const [taskLists, setTaskLists] = useState<{ id: string; label: string }[]>([]);
  const [taskListsLoading, setTaskListsLoading] = useState(false);
  const [taskListSearch, setTaskListSearch] = useState("");

  useEffect(() => {
    if (!createTaskOpen || !ready || taskLists.length > 0) return;
    let cancelled = false;
    setTaskListsLoading(true);
    fetchSpacesTree(accessToken, workspaceId)
      .then((res) => {
        if (cancelled) return;
        setTaskLists(flattenListsFromSpaces(res.data));
      })
      .catch(() => {
        if (!cancelled) toast.error("Could not load lists");
      })
      .finally(() => {
        if (!cancelled) setTaskListsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [createTaskOpen, ready, accessToken, workspaceId, taskLists.length]);

  const filteredTaskLists = useMemo(() => {
    const q = taskListSearch.trim().toLowerCase();
    if (!q) return taskLists;
    return taskLists.filter((list) => list.label.toLowerCase().includes(q));
  }, [taskLists, taskListSearch]);

  const loadThread = async () => {
    if (!ready) return;
    setLoading(true);
    setError(null);
    try {
      const result =
        type === "channel"
          ? await fetchChannelThread(
              accessToken,
              workspaceId,
              conversationId,
              messageId
            )
          : await fetchDmThread(
              accessToken,
              workspaceId,
              conversationId,
              messageId
            );
      setBundle(result);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load thread");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    clearComposerEdit();
    loadThread();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, accessToken, workspaceId, type, conversationId, messageId]);

  useEffect(() => {
    if (!realtimeEvent || realtimeEvent.workspaceId !== workspaceId) return;
    if (realtimeEvent.kind !== type || realtimeEvent.conversationId !== conversationId) {
      return;
    }
    if (realtimeEvent.parentId !== messageId) return;
    if (!currentUserId) return;
    const incoming = normalizeMessageForViewer(
      realtimeEvent.message,
      currentUserId
    );
    setBundle((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        replies: mergeIncomingMessage(prev.replies, incoming),
      };
    });
    clearRealtimeEvent();
  }, [
    realtimeEvent,
    workspaceId,
    type,
    conversationId,
    messageId,
    currentUserId,
    clearRealtimeEvent,
  ]);

  const applyMessageToBundle = (updated: ChatMessage) => {
    setBundle((prev) => {
      if (!prev) return prev;
      if (prev.parent.id === updated.id) {
        return { ...prev, parent: updated };
      }
      return {
        ...prev,
        replies: prev.replies.map((r) =>
          r.id === updated.id ? updated : r
        ),
      };
    });
  };

  useEffect(() => {
    if (!messageEditEvent || messageEditEvent.workspaceId !== workspaceId) return;
    if (
      messageEditEvent.kind !== type ||
      messageEditEvent.conversationId !== conversationId
    ) {
      return;
    }
    if (!currentUserId) return;
    const updated = normalizeMessageForViewer(
      messageEditEvent.message,
      currentUserId
    );
    const isParent = updated.id === messageId;
    const isReply = messageEditEvent.parentId === messageId;
    if (!isParent && !isReply) {
      clearMessageEditEvent();
      return;
    }
    applyMessageToBundle({
      ...updated,
      attachments: updated.attachments ?? [],
    });
    clearMessageEditEvent();
  }, [
    messageEditEvent,
    workspaceId,
    type,
    conversationId,
    messageId,
    currentUserId,
    clearMessageEditEvent,
  ]);

  useEffect(() => {
    if (!messageDeleteEvent || messageDeleteEvent.workspaceId !== workspaceId) {
      return;
    }
    if (
      messageDeleteEvent.kind !== type ||
      messageDeleteEvent.conversationId !== conversationId
    ) {
      return;
    }
    const deletedId = messageDeleteEvent.messageId;
    if (deletedId === messageId) {
      setActiveThread(null);
      clearComposerEdit();
      clearMessageDeleteEvent();
      return;
    }
    if (messageDeleteEvent.parentId === messageId) {
      setBundle((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          replies: prev.replies.filter((reply) => reply.id !== deletedId),
        };
      });
    }
    clearComposerEdit();
    clearMessageDeleteEvent();
  }, [
    messageDeleteEvent,
    workspaceId,
    type,
    conversationId,
    messageId,
    setActiveThread,
    clearComposerEdit,
    clearMessageDeleteEvent,
  ]);

  const handleEditMessage = async (
    targetId: string,
    payload: UpdateMessagePayload
  ) => {
    let rollback: ThreadBundle | null = null;
    const applyEdit = (message: ThreadBundle["parent"]) => {
      const keepIds = new Set(payload.attachmentIds);
      return {
        ...message,
        body: payload.body,
        attachments: (message.attachments ?? []).filter((attachment) =>
          keepIds.has(attachment.id)
        ),
      };
    };
    setBundle((prev) => {
      if (!prev) return prev;
      rollback = prev;
      if (prev.parent.id === targetId) {
        return { ...prev, parent: applyEdit(prev.parent) };
      }
      return {
        ...prev,
        replies: prev.replies.map((reply) =>
          reply.id === targetId ? applyEdit(reply) : reply
        ),
      };
    });
    try {
      const updated = await updateChatMessage(
        accessToken,
        workspaceId,
        targetId,
        payload
      );
      const normalized = currentUserId
        ? normalizeMessageForViewer(updated, currentUserId)
        : updated;
      applyMessageToBundle({
        ...normalized,
        attachments: normalized.attachments ?? [],
      });
    } catch (err) {
      if (rollback) {
        setBundle(rollback);
      }
      throw err;
    }
  };

  const handleDeleteMessage = async (targetId: string) => {
    let rollback: ThreadBundle | null = bundle;
    if (!bundle) return;
    if (bundle.parent.id === targetId) {
      setBundle(null);
    } else {
      setBundle({
        ...bundle,
        replies: bundle.replies.filter((reply) => reply.id !== targetId),
      });
    }
    clearComposerEdit();
    try {
      await onDeleteMessage(targetId);
    } catch (err) {
      setBundle(rollback);
      throw err;
    }
  };

  useEffect(() => {
    if (!reactionEvent || reactionEvent.workspaceId !== workspaceId) return;
    const { messageId, reactions } = reactionEvent;
    setBundle((prev) => {
      if (!prev) return prev;
      if (prev.parent.id === messageId) {
        return { ...prev, parent: { ...prev.parent, reactions } };
      }
      return {
        ...prev,
        replies: prev.replies.map((r) =>
          r.id === messageId ? { ...r, reactions } : r
        ),
      };
    });
    clearReactionEvent();
  }, [reactionEvent, workspaceId, clearReactionEvent]);

  const handleReply = async (payload: SendMessagePayload) => {
    if (!ready || !accessToken || !workspaceId) {
      throw new ApiError(401, "UNAUTHORIZED", "Session not ready — try refreshing");
    }
    if (!currentUserId) {
      throw new ApiError(401, "UNAUTHORIZED", "You must be signed in to send messages");
    }
    const optimistic = createOptimisticMessage(
      payload.body || ATTACHMENT_PLACEHOLDER,
      currentUserId,
      payload.optimisticAttachments,
      currentUserFullName
    );
    setBundle((prev) => {
      if (!prev) return prev;
      return { ...prev, replies: [...prev.replies, optimistic] };
    });
    try {
      const confirmed =
        type === "channel"
          ? await sendChannelThreadReply(
              accessToken,
              workspaceId,
              conversationId,
              messageId,
              payload
            )
          : await sendDmThreadReply(
              accessToken,
              workspaceId,
              conversationId,
              messageId,
              payload
            );
      setBundle((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          replies: mergeConfirmedMessage(
            prev.replies,
            optimistic.id,
            confirmed
          ),
        };
      });
      onReplySent?.();
    } catch {
      setBundle((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          replies: prev.replies.filter((r) => r.id !== optimistic.id),
        };
      });
      throw new Error("Failed to send reply");
    }
  };

  if (loading) {
    return (
      <PanelCardShell widthClass="w-[380px]" marginClassName="box-border flex h-full shrink-0 py-3 pr-2 pl-2">
        <PageLoader label="Loading thread…" />
      </PanelCardShell>
    );
  }

  if (error || !bundle) {
    return (
      <PanelCardShell widthClass="w-[380px]" marginClassName="box-border flex h-full shrink-0 py-3 pr-2 pl-2">
        <div className="flex items-center justify-between px-4 pt-3 pb-2">
          <span className="text-sm font-semibold">Thread</span>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setActiveThread(null)}
          >
            <XIcon className="size-4" strokeWidth={1.5} />
          </Button>
        </div>
        <p className="px-4 pb-4 text-sm text-muted-foreground">
          {error ?? "Message not found."}
        </p>
      </PanelCardShell>
    );
  }

  const { parent, replies, hasNew } = bundle;
  const replyLabel =
    replies.length === 1 ? "1 Reply" : `${replies.length} Replies`;

  async function handleCreateTaskFromThread(listId: string) {
    if (!ready) return;
    setCreateTaskOpen(false);
    setCreatingTask(true);
    try {
      const { task, listId: createdListId } = await createTaskFromThreadMessage(
        accessToken,
        workspaceId,
        parent.body,
        listId
      );
      toast.success("Task created");
      router.push(`/spaces/l/${createdListId}?task=${task.id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not create task");
    } finally {
      setCreatingTask(false);
    }
  }

  return (
    <PanelCardShell widthClass="w-[380px]" marginClassName="box-border flex h-full shrink-0 py-3 pr-2 pl-2">
      <header className="shrink-0 px-4 pt-3 pb-2">
        <div className="flex items-start justify-between gap-2">
          <h2 className="text-base font-semibold leading-tight text-foreground">
            {getThreadTitle(parent, currentUserId, currentUserFullName)}
          </h2>
          <Button
            variant="ghost"
            size="icon-sm"
            className="size-7 shrink-0 rounded-full"
            onClick={() => setActiveThread(null)}
            aria-label="Close thread"
          >
            <XIcon className="size-4" strokeWidth={1.5} />
          </Button>
        </div>
        <div className="mt-2.5 flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-7 gap-1.5 border-border px-2.5 text-xs font-medium"
            onClick={() => toast("Assign to — Phase 3")}
          >
            <UserSquare2Icon className="size-3.5" strokeWidth={1.5} />
            Assign to
          </Button>
          <Popover
            open={createTaskOpen}
            onOpenChange={(next) => {
              setCreateTaskOpen(next);
              if (!next) setTaskListSearch("");
            }}
          >
            <PopoverTrigger
              render={
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 gap-1 border-border px-2.5 text-xs font-medium"
                  loading={creatingTask}
                >
                  <ListTodoIcon className="size-3.5" strokeWidth={1.5} />
                  Create task
                  <ChevronDownIcon
                    className="size-3.5 opacity-60"
                    strokeWidth={1.5}
                  />
                </Button>
              }
            />
            <PopoverContent align="start" className="w-80 p-0">
              <div className="border-b border-border px-4 py-3">
                <p className="text-sm font-semibold text-foreground">
                  Create Task
                </p>
                <p className="text-xs text-muted-foreground">
                  Select a List to create a Task
                </p>
              </div>
              <div className="p-2">
                <div className="relative mb-2">
                  <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={taskListSearch}
                    onChange={(e) => setTaskListSearch(e.target.value)}
                    placeholder="Search Lists…"
                    className="h-9 pl-8"
                    autoFocus
                  />
                </div>
                <p className="px-1 pb-1 text-xs font-semibold text-muted-foreground">
                  Suggested
                </p>
                <ul className="max-h-64 space-y-0.5 overflow-y-auto">
                  {taskListsLoading ? (
                    <li className="px-2 py-4 text-center text-xs text-muted-foreground">
                      Loading lists…
                    </li>
                  ) : filteredTaskLists.length === 0 ? (
                    <li className="px-2 py-4 text-center text-xs text-muted-foreground">
                      No result found
                    </li>
                  ) : (
                    filteredTaskLists.map((list) => (
                      <li key={list.id}>
                        <button
                          type="button"
                          disabled={creatingTask}
                          className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm hover:bg-muted disabled:pointer-events-none disabled:opacity-60"
                          onClick={() => void handleCreateTaskFromThread(list.id)}
                        >
                          <ListChecksIcon className="size-4 shrink-0 text-muted-foreground" />
                          <span className="min-w-0 flex-1 truncate">
                            {list.label}
                          </span>
                        </button>
                      </li>
                    ))
                  )}
                </ul>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </header>

      <Separator />

      <div className="min-h-0 flex-1 overflow-y-auto" data-quote-scope="thread">
        <div className="px-4 py-4">
          <ThreadMessageRow
            message={parent}
            conversationType={type}
            conversationId={conversationId}
            onToggleReaction={onToggleReaction}
            onEditMessage={handleEditMessage}
            onDeleteMessage={handleDeleteMessage}
          />

          {replies.length > 0 && (
            <div className="relative my-5 flex items-center gap-2">
              <div className="h-px flex-1 bg-border" />
              <span className="shrink-0 text-xs font-medium text-[#e8384f]">
                {replyLabel}
                {hasNew && " · New"}
              </span>
              <div className="h-px flex-1 bg-border" />
            </div>
          )}

          <div className="space-y-2">
            {buildMessageRuns(replies).map((run) => (
              <div
                key={`${run.authorId}-${run.messages[0]?.id}`}
                className="space-y-0"
              >
                {run.messages.map((reply, index) => (
                  <ThreadMessageRow
                    key={reply.id}
                    message={reply}
                    showHeader={index === 0}
                    conversationType={type}
                    conversationId={conversationId}
                    onToggleReaction={onToggleReaction}
                    onEditMessage={handleEditMessage}
                    onDeleteMessage={handleDeleteMessage}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      <ThreadReplyComposer
        alsoSendChannelLabel={channelLabel}
        conversationType={type}
        conversationId={conversationId}
        onSend={handleReply}
      />
    </PanelCardShell>
  );
}
