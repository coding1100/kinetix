import type { ChatMessage, MessageAttachment } from "@/lib/types/chat";
import { stripMessageHtml } from "@/lib/chat/rich-text/sanitize";

export const ATTACHMENT_PLACEHOLDER = "Shared an attachment";

export function normalizeEditableMessageBody(body: string): string {
  const trimmed = body.trim();
  if (!trimmed || trimmed === ATTACHMENT_PLACEHOLDER) return "";
  return body;
}

export function canEditMessageContent(message: ChatMessage): boolean {
  return (
    Boolean(normalizeEditableMessageBody(message.body)) ||
    (message.attachments?.length ?? 0) > 0
  );
}

/** Append a message only if its id is not already in the list (REST + socket race). */
export function appendUniqueMessage<T extends { id: string }>(
  prev: T[],
  msg: T
): T[] {
  if (prev.some((m) => m.id === msg.id)) return prev;
  return [...prev, msg];
}

/** Map socket/API payload to the signed-in viewer (broadcast omits per-viewer fields). */
export function normalizeMessageForViewer(
  msg: ChatMessage,
  currentUserId: string
): ChatMessage {
  const isSelf = msg.authorId === currentUserId;
  return {
    ...msg,
    isSelf,
  };
}

export function resolveMessageAuthorName(
  message: ChatMessage,
  options?: { currentUserId?: string; currentUserFullName?: string }
): string {
  const isSelf =
    message.isSelf ??
    (options?.currentUserId
      ? message.authorId === options.currentUserId
      : false);
  const fullName = options?.currentUserFullName?.trim();
  if (isSelf && fullName) return fullName;
  if (message.authorName === "You" && fullName) return fullName;
  return message.authorName;
}

function createPendingMessageId() {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return `pending-${crypto.randomUUID()}`;
    }
  } catch {
    // randomUUID requires a secure context (HTTPS); HTTP EC2 IPs need a fallback
  }
  return `pending-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function createOptimisticMessage(
  body: string,
  authorId: string,
  attachments?: MessageAttachment[],
  authorName?: string
): ChatMessage {
  return {
    id: createPendingMessageId(),
    authorId,
    authorName: authorName?.trim() || "You",
    body,
    createdAt: new Date().toISOString(),
    isSelf: true,
    reactions: [],
    threadCount: 0,
    attachments: attachments?.length ? attachments : undefined,
  };
}

function dedupeMessagesById<T extends { id: string }>(messages: T[]): T[] {
  const seen = new Set<string>();
  return messages.filter((m) => {
    if (seen.has(m.id)) return false;
    seen.add(m.id);
    return true;
  });
}

function messageBodiesMatch(a: string, b: string): boolean {
  if (a === b) return true;
  return stripMessageHtml(a).trim() === stripMessageHtml(b).trim();
}

/** Match optimistic row when REST/socket body differs (e.g. attachment-only sends). */
function findPendingReplaceIndex<T extends ChatMessage>(
  prev: T[],
  incoming: T
): number {
  const exactBody = prev.findIndex(
    (m) =>
      m.id.startsWith("pending-") &&
      m.authorId === incoming.authorId &&
      messageBodiesMatch(m.body, incoming.body)
  );
  if (exactBody >= 0) return exactBody;

  const hasIncomingAttachments = (incoming.attachments?.length ?? 0) > 0;
  if (!hasIncomingAttachments) return -1;

  for (let i = prev.length - 1; i >= 0; i--) {
    const m = prev[i];
    if (
      m.id.startsWith("pending-") &&
      m.authorId === incoming.authorId &&
      (m.body === ATTACHMENT_PLACEHOLDER ||
        m.body === "" ||
        (m.attachments?.length ?? 0) > 0)
    ) {
      return i;
    }
  }

  return -1;
}

/** Replace pending row or merge by id — avoids blank gap while REST/socket resolve. */
export function upsertChatMessage<T extends ChatMessage>(
  prev: T[],
  incoming: T
): T[] {
  const pendingIdx = findPendingReplaceIndex(prev, incoming);
  if (pendingIdx >= 0) {
    return dedupeMessagesById(
      prev.map((m, i) => (i === pendingIdx ? { ...m, ...incoming } : m))
    );
  }

  const existingIdx = prev.findIndex((m) => m.id === incoming.id);
  if (existingIdx >= 0) {
    return dedupeMessagesById(
      prev.map((m, i) => (i === existingIdx ? { ...m, ...incoming } : m))
    );
  }

  return dedupeMessagesById([...prev, incoming]);
}

export function mergeConfirmedMessage<T extends ChatMessage>(
  prev: T[],
  tempId: string,
  confirmed: T
): T[] {
  const tempIdx = prev.findIndex((m) => m.id === tempId);
  if (tempIdx >= 0) {
    return dedupeMessagesById(
      prev.map((m, i) => (i === tempIdx ? { ...m, ...confirmed } : m))
    );
  }
  return upsertChatMessage(prev, confirmed);
}

export function mergeIncomingMessage<T extends ChatMessage>(
  prev: T[],
  incoming: T
): T[] {
  return upsertChatMessage(prev, incoming);
}

/** Merge API fetch with in-flight optimistic / socket rows without losing history. */
export function mergeFetchedMessages<T extends ChatMessage>(
  fetched: T[],
  existing: T[]
): T[] {
  const byId = new Map<string, T>();
  for (const message of fetched) {
    byId.set(message.id, message);
  }
  for (const message of existing) {
    if (message.id.startsWith("pending-")) {
      byId.set(message.id, message);
      continue;
    }
    if (!byId.has(message.id)) {
      byId.set(message.id, message);
    }
  }
  return dedupeMessagesById(
    [...byId.values()].sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    )
  );
}

export function applyMessageUpdate<T extends ChatMessage>(
  prev: T[],
  updated: T
): T[] {
  return prev.map((m) => {
    if (m.id !== updated.id) return m;
    return {
      ...m,
      ...updated,
      attachments:
        updated.attachments !== undefined ? updated.attachments : m.attachments,
    };
  });
}

export function removeMessageById<T extends ChatMessage>(
  prev: T[],
  messageId: string
): T[] {
  return prev.filter((message) => message.id !== messageId);
}

/** @deprecated Use mergeConfirmedMessage */
export function replaceMessageById(
  prev: ChatMessage[],
  tempId: string,
  confirmed: ChatMessage
): ChatMessage[] {
  return mergeConfirmedMessage(prev, tempId, confirmed);
}
