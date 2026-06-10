import { apiFetch } from "./client";
import type { Task } from "@/lib/types/task";

export type InboxItemType =
  | "comment"
  | "mention"
  | "assignment"
  | "chat"
  | "reminder"
  | "reply"
  | "reaction"
  | "sent"
  | "draft"
  | "scheduled";

export interface InboxItemDto {
  id: string;
  type: InboxItemType;
  title: string;
  preview: string;
  source: string;
  createdAt: string;
  unread: boolean;
  group: "today" | "earlier";
  href?: string;
}

export interface SpaceDto {
  id: string;
  name: string;
  color: string;
  memberCount: number;
  listCount: number;
  description?: string;
  folders?: {
    id: string;
    name: string;
    lists: { id: string; name: string; taskCount: number }[];
  }[];
  standaloneLists?: { id: string; name: string; taskCount: number }[];
}

export interface PostDto {
  id: string;
  author: string;
  channel: string;
  content: string;
  createdAt: string;
  reactions: number;
}

function wsPath(workspaceId: string, path: string) {
  return `/workspaces/${workspaceId}${path}`;
}

export function fetchInbox(
  token: string,
  workspaceId: string,
  tab: "all" | "later"
) {
  return apiFetch<{ data: InboxItemDto[] }>(
    wsPath(workspaceId, `/home/inbox?tab=${tab}`),
    { token }
  );
}

export interface NotificationDto {
  id: string;
  type: InboxItemType;
  title: string;
  preview: string;
  source: string;
  createdAt: string;
  unread: boolean;
  group?: InboxItemDto["group"];
  href?: string;
}

export function fetchNotifications(token: string, workspaceId: string) {
  return apiFetch<{ data: NotificationDto[]; unreadCount: number }>(
    wsPath(workspaceId, "/home/notifications"),
    { token }
  );
}

export function markNotificationRead(
  token: string,
  workspaceId: string,
  itemId: string
) {
  return apiFetch<{ id: string; unread: boolean }>(
    wsPath(workspaceId, `/home/inbox/${itemId}`),
    { method: "PATCH", token, body: JSON.stringify({ unread: false }) }
  );
}

export function markAllNotificationsRead(token: string, workspaceId: string) {
  return apiFetch<{ updated: number }>(
    wsPath(workspaceId, "/home/notifications/read-all"),
    { method: "POST", token }
  );
}

export function fetchReplies(token: string, workspaceId: string) {
  return apiFetch<{
    data: { id: string; channel: string; preview: string; unread: boolean; href: string }[];
  }>(wsPath(workspaceId, "/home/replies"), { token });
}

export function fetchAssignedComments(token: string, workspaceId: string) {
  return apiFetch<{
    data: { id: string; task: string; comment: string; author: string; due: string }[];
  }>(wsPath(workspaceId, "/home/assigned-comments"), { token });
}

export function resolveAssignedComment(
  token: string,
  workspaceId: string,
  commentId: string
) {
  return apiFetch<{ id: string; resolved: boolean }>(
    wsPath(workspaceId, `/home/assigned-comments/${commentId}/resolve`),
    { method: "PATCH", token }
  );
}

export function fetchChatActivity(
  token: string,
  workspaceId: string,
  kind?: string
) {
  const q = kind && kind !== "all" ? `?kind=${encodeURIComponent(kind)}` : "";
  return apiFetch<{
    data: { id: string; kind: string; text: string; time: string; href: string }[];
  }>(wsPath(workspaceId, `/home/chat-activity${q}`), { token });
}

export function fetchDraftsSent(
  token: string,
  workspaceId: string,
  tab: "drafts" | "sent" | "scheduled"
) {
  return apiFetch<{
    data: { id: string; target: string; preview: string; type: string; at?: string }[];
  }>(wsPath(workspaceId, `/home/drafts-sent?tab=${tab}`), { token });
}

export function fetchSpaces(token: string, workspaceId: string) {
  return apiFetch<{ data: SpaceDto[] }>(wsPath(workspaceId, "/spaces"), { token });
}

export function fetchSpace(token: string, workspaceId: string, spaceId: string) {
  return apiFetch<SpaceDto>(wsPath(workspaceId, `/spaces/${spaceId}`), { token });
}

export function fetchTasks(
  token: string,
  workspaceId: string,
  filter?: string,
  search?: string
) {
  const params = new URLSearchParams();
  if (filter) params.set("filter", filter);
  if (search?.trim()) params.set("search", search.trim());
  const q = params.toString() ? `?${params}` : "";
  return apiFetch<{ data: Task[] }>(wsPath(workspaceId, `/tasks${q}`), { token });
}

export function fetchTask(token: string, workspaceId: string, taskId: string) {
  return apiFetch<Task>(wsPath(workspaceId, `/tasks/${taskId}`), { token });
}

export function fetchPosts(token: string, workspaceId: string) {
  return apiFetch<{ data: PostDto[] }>(wsPath(workspaceId, "/posts"), { token });
}

export function createPost(
  token: string,
  workspaceId: string,
  input: { channel: string; content: string }
) {
  return apiFetch<PostDto>(wsPath(workspaceId, "/posts"), {
    method: "POST",
    token,
    body: JSON.stringify(input),
  });
}

export function fetchReminders(token: string, workspaceId: string) {
  return apiFetch<{ data: { id: string; title: string; due: string }[] }>(
    wsPath(workspaceId, "/home/reminders"),
    { token }
  );
}

export function fetchFavorites(token: string, workspaceId: string) {
  return apiFetch<{
    data: { id: string; name: string; type: string; href: string }[];
  }>(wsPath(workspaceId, "/home/favorites"), { token });
}

export function fetchRecents(token: string, workspaceId: string) {
  return apiFetch<{
    data: { id: string; name: string; type: string; space: string; href: string }[];
  }>(wsPath(workspaceId, "/home/recents"), { token });
}

export function fetchUnreadSummary(token: string, workspaceId: string) {
  return apiFetch<{ home: number }>(
    wsPath(workspaceId, "/home/unread-summary"),
    { token }
  );
}
