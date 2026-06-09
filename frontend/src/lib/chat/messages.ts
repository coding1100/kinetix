import type { ChatMessage } from "@/lib/types/chat";

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
    authorName: isSelf ? "You" : msg.authorName,
  };
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
  authorId: string
): ChatMessage {
  return {
    id: createPendingMessageId(),
    authorId,
    authorName: "You",
    body,
    createdAt: new Date().toISOString(),
    isSelf: true,
    reactions: [],
    threadCount: 0,
  };
}

/** Replace pending row or merge by id — avoids blank gap while REST/socket resolve. */
export function upsertChatMessage<T extends ChatMessage>(
  prev: T[],
  incoming: T
): T[] {
  const pendingIdx = prev.findIndex(
    (m) =>
      m.id.startsWith("pending-") &&
      m.authorId === incoming.authorId &&
      m.body === incoming.body
  );
  if (pendingIdx >= 0) {
    return prev.map((m, i) => (i === pendingIdx ? incoming : m));
  }

  const existingIdx = prev.findIndex((m) => m.id === incoming.id);
  if (existingIdx >= 0) {
    return prev.map((m, i) =>
      i === existingIdx ? { ...m, ...incoming } : m
    );
  }

  return [...prev, incoming];
}

export function mergeConfirmedMessage<T extends ChatMessage>(
  prev: T[],
  tempId: string,
  confirmed: T
): T[] {
  const tempIdx = prev.findIndex((m) => m.id === tempId);
  if (tempIdx >= 0) {
    return prev.map((m, i) => (i === tempIdx ? confirmed : m));
  }
  return upsertChatMessage(prev, confirmed);
}

export function mergeIncomingMessage<T extends ChatMessage>(
  prev: T[],
  incoming: T
): T[] {
  return upsertChatMessage(prev, incoming);
}

export function applyMessageUpdate<T extends ChatMessage>(
  prev: T[],
  updated: T
): T[] {
  return prev.map((m) => (m.id === updated.id ? { ...m, ...updated } : m));
}

/** @deprecated Use mergeConfirmedMessage */
export function replaceMessageById(
  prev: ChatMessage[],
  tempId: string,
  confirmed: ChatMessage
): ChatMessage[] {
  return mergeConfirmedMessage(prev, tempId, confirmed);
}
