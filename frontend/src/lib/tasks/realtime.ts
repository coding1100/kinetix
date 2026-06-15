import type { Task } from "@/lib/types/task";

export type TaskRealtimePayload = {
  workspaceId: string;
  action: "created" | "updated" | "deleted";
  taskId: string;
  listId?: string | null;
  task?: Task | null;
};

const listeners = new Set<(event: TaskRealtimePayload) => void>();

export function subscribeTaskEvents(listener: (event: TaskRealtimePayload) => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function ingestTaskEvent(event: TaskRealtimePayload) {
  listeners.forEach((listener) => listener(event));
}
