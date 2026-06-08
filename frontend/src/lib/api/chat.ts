import { apiFetch } from "./client";
import type {
  Channel,
  ChannelMember,
  ChatMessage,
  ChatSearchHit,
  DirectMessage,
  SendMessagePayload,
  ThreadBundle,
} from "@/lib/types/chat";

function serializeMessagePayload(payload: string | SendMessagePayload) {
  if (typeof payload === "string") {
    return JSON.stringify({ body: payload });
  }
  return JSON.stringify({
    body: payload.body ?? "",
    attachmentIds: payload.attachmentIds,
  });
}

function wsPath(workspaceId: string, path: string) {
  return `/workspaces/${workspaceId}${path}`;
}

export function fetchChannels(token: string, workspaceId: string) {
  return apiFetch<{ data: Channel[] }>(
    wsPath(workspaceId, "/chat/channels"),
    { token }
  );
}

export function fetchChannel(
  token: string,
  workspaceId: string,
  channelId: string
) {
  return apiFetch<Channel>(
    wsPath(workspaceId, `/chat/channels/${channelId}`),
    { token }
  );
}

export function fetchChannelMembers(
  token: string,
  workspaceId: string,
  channelId: string
) {
  return apiFetch<{ data: ChannelMember[] }>(
    wsPath(workspaceId, `/chat/channels/${channelId}/members`),
    { token }
  );
}

export function addChannelMembers(
  token: string,
  workspaceId: string,
  channelId: string,
  userIds: string[]
) {
  return apiFetch<{ data: ChannelMember[]; added: number }>(
    wsPath(workspaceId, `/chat/channels/${channelId}/members`),
    {
      method: "POST",
      token,
      body: JSON.stringify({ userIds }),
    }
  );
}

export function removeChannelMember(
  token: string,
  workspaceId: string,
  channelId: string,
  memberUserId: string
) {
  return apiFetch<{ ok: boolean }>(
    wsPath(workspaceId, `/chat/channels/${channelId}/members/${memberUserId}`),
    { method: "DELETE", token }
  );
}

export function createChannel(
  token: string,
  workspaceId: string,
  body: {
    name: string;
    isPrivate?: boolean;
    topic?: string;
    memberIds?: string[];
  }
) {
  return apiFetch<Channel>(wsPath(workspaceId, "/chat/channels"), {
    method: "POST",
    token,
    body: JSON.stringify(body),
  });
}

export function updateChannel(
  token: string,
  workspaceId: string,
  channelId: string,
  body: { name?: string; topic?: string }
) {
  return apiFetch<Channel>(
    wsPath(workspaceId, `/chat/channels/${channelId}`),
    { method: "PATCH", token, body: JSON.stringify(body) }
  );
}

export function deleteChannel(
  token: string,
  workspaceId: string,
  channelId: string
) {
  return apiFetch<{ ok: boolean }>(
    wsPath(workspaceId, `/chat/channels/${channelId}`),
    { method: "DELETE", token }
  );
}

export function updateChannelMember(
  token: string,
  workspaceId: string,
  channelId: string,
  body: { isFollowing?: boolean; starred?: boolean }
) {
  return apiFetch<{ ok: boolean }>(
    wsPath(workspaceId, `/chat/channels/${channelId}/member`),
    { method: "PATCH", token, body: JSON.stringify(body) }
  );
}

export function updateChannelMemberById(
  token: string,
  workspaceId: string,
  channelId: string,
  memberUserId: string,
  body: { isFollowing?: boolean }
) {
  return apiFetch<{ ok: boolean }>(
    wsPath(
      workspaceId,
      `/chat/channels/${channelId}/members/${memberUserId}`
    ),
    { method: "PATCH", token, body: JSON.stringify(body) }
  );
}

export function markChannelRead(
  token: string,
  workspaceId: string,
  channelId: string
) {
  return apiFetch<{ ok: boolean; unread: number }>(
    wsPath(workspaceId, `/chat/channels/${channelId}/read`),
    { method: "POST", token }
  );
}

export function markDmRead(
  token: string,
  workspaceId: string,
  conversationId: string
) {
  return apiFetch<{ ok: boolean; unread: number }>(
    wsPath(workspaceId, `/chat/dms/${conversationId}/read`),
    { method: "POST", token }
  );
}

export function markChannelUnread(
  token: string,
  workspaceId: string,
  channelId: string
) {
  return apiFetch<{ ok: boolean; unread: number }>(
    wsPath(workspaceId, `/chat/channels/${channelId}/unread`),
    { method: "POST", token }
  );
}

export function markDmUnread(
  token: string,
  workspaceId: string,
  conversationId: string
) {
  return apiFetch<{ ok: boolean; unread: number }>(
    wsPath(workspaceId, `/chat/dms/${conversationId}/unread`),
    { method: "POST", token }
  );
}

export function fetchChannelMessages(
  token: string,
  workspaceId: string,
  channelId: string
) {
  return apiFetch<{ data: ChatMessage[] }>(
    wsPath(workspaceId, `/chat/channels/${channelId}/messages`),
    { token }
  );
}

export function searchChannelMessages(
  token: string,
  workspaceId: string,
  channelId: string,
  query: string
) {
  const q = encodeURIComponent(query.trim());
  return apiFetch<{ data: ChatSearchHit[] }>(
    wsPath(workspaceId, `/chat/channels/${channelId}/messages/search?q=${q}`),
    { token }
  );
}

export function sendChannelMessage(
  token: string,
  workspaceId: string,
  channelId: string,
  payload: string | SendMessagePayload
) {
  return apiFetch<ChatMessage>(
    wsPath(workspaceId, `/chat/channels/${channelId}/messages`),
    { method: "POST", token, body: serializeMessagePayload(payload) }
  );
}

export function fetchChannelThread(
  token: string,
  workspaceId: string,
  channelId: string,
  messageId: string
) {
  return apiFetch<ThreadBundle>(
    wsPath(workspaceId, `/chat/channels/${channelId}/messages/${messageId}/thread`),
    { token }
  );
}

export function sendChannelThreadReply(
  token: string,
  workspaceId: string,
  channelId: string,
  messageId: string,
  payload: string | SendMessagePayload
) {
  return apiFetch<ChatMessage>(
    wsPath(
      workspaceId,
      `/chat/channels/${channelId}/messages/${messageId}/thread`
    ),
    { method: "POST", token, body: serializeMessagePayload(payload) }
  );
}

export function fetchDms(token: string, workspaceId: string) {
  return apiFetch<{ data: DirectMessage[] }>(
    wsPath(workspaceId, "/chat/dms"),
    { token }
  );
}

export function fetchDm(
  token: string,
  workspaceId: string,
  conversationId: string
) {
  return apiFetch<DirectMessage>(
    wsPath(workspaceId, `/chat/dms/${conversationId}`),
    { token }
  );
}

export function createDm(
  token: string,
  workspaceId: string,
  userIds: string[],
  name?: string
) {
  return apiFetch<DirectMessage>(wsPath(workspaceId, "/chat/dms"), {
    method: "POST",
    token,
    body: JSON.stringify({ userIds, name }),
  });
}

export function fetchDmMessages(
  token: string,
  workspaceId: string,
  conversationId: string
) {
  return apiFetch<{ data: ChatMessage[] }>(
    wsPath(workspaceId, `/chat/dms/${conversationId}/messages`),
    { token }
  );
}

export function searchDmMessages(
  token: string,
  workspaceId: string,
  conversationId: string,
  query: string
) {
  const q = encodeURIComponent(query.trim());
  return apiFetch<{ data: ChatSearchHit[] }>(
    wsPath(workspaceId, `/chat/dms/${conversationId}/messages/search?q=${q}`),
    { token }
  );
}

export function sendDmMessage(
  token: string,
  workspaceId: string,
  conversationId: string,
  payload: string | SendMessagePayload
) {
  return apiFetch<ChatMessage>(
    wsPath(workspaceId, `/chat/dms/${conversationId}/messages`),
    { method: "POST", token, body: serializeMessagePayload(payload) }
  );
}

export function fetchDmThread(
  token: string,
  workspaceId: string,
  conversationId: string,
  messageId: string
) {
  return apiFetch<ThreadBundle>(
    wsPath(
      workspaceId,
      `/chat/dms/${conversationId}/messages/${messageId}/thread`
    ),
    { token }
  );
}

export function sendDmThreadReply(
  token: string,
  workspaceId: string,
  conversationId: string,
  messageId: string,
  payload: string | SendMessagePayload
) {
  return apiFetch<ChatMessage>(
    wsPath(
      workspaceId,
      `/chat/dms/${conversationId}/messages/${messageId}/thread`
    ),
    { method: "POST", token, body: serializeMessagePayload(payload) }
  );
}

export function updateChatMessage(
  token: string,
  workspaceId: string,
  messageId: string,
  body: string
) {
  return apiFetch<ChatMessage>(
    wsPath(workspaceId, `/chat/messages/${messageId}`),
    { method: "PATCH", token, body: JSON.stringify({ body }) }
  );
}

export function toggleMessageReaction(
  token: string,
  workspaceId: string,
  messageId: string,
  emoji: string
) {
  return apiFetch<{
    messageId: string;
    reactions: { emoji: string; count: number }[];
  }>(wsPath(workspaceId, `/chat/messages/${messageId}/reactions`), {
    method: "POST",
    token,
    body: JSON.stringify({ emoji }),
  });
}

export function fetchWorkspaceMembers(token: string, workspaceId: string) {
  return apiFetch<{
    data: {
      id: string;
      email: string;
      fullName: string;
      avatarUrl?: string | null;
      role?: string;
    }[];
  }>(`/workspaces/${workspaceId}/members`, { token });
}
