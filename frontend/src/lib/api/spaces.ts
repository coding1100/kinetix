import { apiFetch } from "./client";
import type { Task } from "@/lib/types/task";
import type { SpaceDto } from "./home";

function wsPath(workspaceId: string, path: string) {
  return `/workspaces/${workspaceId}${path}`;
}

export interface ListMetaDto {
  id: string;
  name: string;
  space: { id: string; name: string; color: string };
}

export function fetchSpacesTree(token: string, workspaceId: string) {
  return apiFetch<{ data: SpaceDto[] }>(wsPath(workspaceId, "/spaces"), { token });
}

export function fetchListMeta(
  token: string,
  workspaceId: string,
  listId: string
) {
  return apiFetch<ListMetaDto>(wsPath(workspaceId, `/lists/${listId}`), { token });
}

export function fetchListTasks(
  token: string,
  workspaceId: string,
  listId: string
) {
  return apiFetch<{ data: Task[] }>(
    wsPath(workspaceId, `/lists/${listId}/tasks`),
    { token }
  );
}

export function createListTask(
  token: string,
  workspaceId: string,
  listId: string,
  input: { name: string; description?: string }
) {
  return apiFetch<Task>(wsPath(workspaceId, `/lists/${listId}/tasks`), {
    method: "POST",
    token,
    body: JSON.stringify(input),
  });
}

export type UpdateTaskInput = {
  name?: string;
  status?: "OPEN" | "TODO" | "IN_PROGRESS" | "DONE";
  description?: string;
  dueDate?: string;
  assigneeIds?: string[];
};

export function patchTask(
  token: string,
  workspaceId: string,
  taskId: string,
  input: UpdateTaskInput
) {
  return apiFetch<Task>(wsPath(workspaceId, `/tasks/${taskId}`), {
    method: "PATCH",
    token,
    body: JSON.stringify(input),
  });
}

export function createSpace(
  token: string,
  workspaceId: string,
  input: { name: string; color?: string; description?: string }
) {
  return apiFetch<SpaceDto>(wsPath(workspaceId, "/spaces"), {
    method: "POST",
    token,
    body: JSON.stringify(input),
  });
}

export function createFolder(
  token: string,
  workspaceId: string,
  spaceId: string,
  input: { name: string }
) {
  return apiFetch<{ id: string; name: string }>(
    wsPath(workspaceId, `/spaces/${spaceId}/folders`),
    { method: "POST", token, body: JSON.stringify(input) }
  );
}

export function createList(
  token: string,
  workspaceId: string,
  spaceId: string,
  input: { name: string; folderId?: string }
) {
  return apiFetch<{ id: string; name: string }>(
    wsPath(workspaceId, `/spaces/${spaceId}/lists`),
    { method: "POST", token, body: JSON.stringify(input) }
  );
}

export function searchWorkspaceTasks(
  token: string,
  workspaceId: string,
  query: string
) {
  const q = encodeURIComponent(query.trim());
  return apiFetch<{ data: Task[] }>(
    wsPath(workspaceId, `/tasks?search=${q}`),
    { token }
  );
}

export function addTaskComment(
  token: string,
  workspaceId: string,
  taskId: string,
  body: string
) {
  return apiFetch<Task>(wsPath(workspaceId, `/tasks/${taskId}/comments`), {
    method: "POST",
    token,
    body: JSON.stringify({ body }),
  });
}

export function firstListIdFromSpaces(spaces: SpaceDto[]): string | null {
  for (const space of spaces) {
    for (const folder of space.folders ?? []) {
      const list = folder.lists[0];
      if (list) return list.id;
    }
    const standalone = space.standaloneLists?.[0];
    if (standalone) return standalone.id;
  }
  return null;
}
