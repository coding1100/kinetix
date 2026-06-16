import { apiFetch } from "./client";
import type { ListStatus, Task } from "@/lib/types/task";
import type { SpaceDto } from "./home";

function wsPath(workspaceId: string, path: string) {
  return `/workspaces/${workspaceId}${path}`;
}

export type { ListStatus };

export interface ListMetaDto {
  id: string;
  name: string;
  space: { id: string; name: string; color: string };
  statuses?: ListStatus[];
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
  statusId?: string;
  description?: string;
  dueDate?: string;
  assigneeIds?: string[];
  priority?: Task["priority"] | null;
  listId?: string;
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

export function deleteTask(
  token: string,
  workspaceId: string,
  taskId: string
) {
  return apiFetch<{ ok: boolean }>(wsPath(workspaceId, `/tasks/${taskId}`), {
    method: "DELETE",
    token,
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

export function patchSpace(
  token: string,
  workspaceId: string,
  spaceId: string,
  input: { name?: string; color?: string; description?: string }
) {
  return apiFetch<SpaceDto>(wsPath(workspaceId, `/spaces/${spaceId}`), {
    method: "PATCH",
    token,
    body: JSON.stringify(input),
  });
}

export function deleteSpace(
  token: string,
  workspaceId: string,
  spaceId: string
) {
  return apiFetch<{ ok: boolean }>(wsPath(workspaceId, `/spaces/${spaceId}`), {
    method: "DELETE",
    token,
  });
}

export function patchFolder(
  token: string,
  workspaceId: string,
  folderId: string,
  input: { name: string }
) {
  return apiFetch<{ id: string; name: string }>(
    wsPath(workspaceId, `/folders/${folderId}`),
    { method: "PATCH", token, body: JSON.stringify(input) }
  );
}

export function deleteFolder(
  token: string,
  workspaceId: string,
  folderId: string
) {
  return apiFetch<{ ok: boolean }>(wsPath(workspaceId, `/folders/${folderId}`), {
    method: "DELETE",
    token,
  });
}

export function patchList(
  token: string,
  workspaceId: string,
  listId: string,
  input: { name: string }
) {
  return apiFetch<{ id: string; name: string }>(
    wsPath(workspaceId, `/lists/${listId}`),
    { method: "PATCH", token, body: JSON.stringify(input) }
  );
}

export function deleteList(
  token: string,
  workspaceId: string,
  listId: string
) {
  return apiFetch<{ ok: boolean }>(wsPath(workspaceId, `/lists/${listId}`), {
    method: "DELETE",
    token,
  });
}

export function flattenListsFromSpaces(
  spaces: SpaceDto[]
): { id: string; label: string }[] {
  const out: { id: string; label: string }[] = [];
  for (const space of spaces) {
    for (const folder of space.folders ?? []) {
      for (const list of folder.lists) {
        out.push({
          id: list.id,
          label: `${space.name} / ${folder.name} / ${list.name}`,
        });
      }
    }
    for (const list of space.standaloneLists ?? []) {
      out.push({ id: list.id, label: `${space.name} / ${list.name}` });
    }
  }
  return out;
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

export function followTask(
  token: string,
  workspaceId: string,
  taskId: string
) {
  return apiFetch<{ ok: boolean; following: boolean }>(
    wsPath(workspaceId, `/tasks/${taskId}/follow`),
    { method: "POST", token }
  );
}

export function unfollowTask(
  token: string,
  workspaceId: string,
  taskId: string
) {
  return apiFetch<{ ok: boolean; following: boolean }>(
    wsPath(workspaceId, `/tasks/${taskId}/follow`),
    { method: "DELETE", token }
  );
}

export function createSubtask(
  token: string,
  workspaceId: string,
  parentTaskId: string,
  name: string
) {
  return apiFetch<import("@/lib/types/task").TaskSubtask>(
    wsPath(workspaceId, `/tasks/${parentTaskId}/subtasks`),
    { method: "POST", token, body: JSON.stringify({ name }) }
  );
}

export function presignTaskAttachment(
  token: string,
  workspaceId: string,
  taskId: string,
  body: { fileName: string; mimeType: string; sizeBytes: number }
) {
  return apiFetch<{
    attachmentId: string;
    uploadUrl: string;
    storageKey: string;
    expiresIn: number;
  }>(wsPath(workspaceId, `/tasks/${taskId}/attachments/presign`), {
    method: "POST",
    token,
    body: JSON.stringify(body),
  });
}

export function uploadTaskAttachmentContent(
  token: string,
  workspaceId: string,
  taskId: string,
  attachmentId: string,
  file: Blob,
  fileName: string
) {
  const form = new FormData();
  form.append("file", file, fileName);
  return apiFetch<{ ok: boolean; attachmentId: string; status: string }>(
    wsPath(
      workspaceId,
      `/tasks/${taskId}/attachments/${attachmentId}/upload`
    ),
    { method: "POST", token, body: form }
  );
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
