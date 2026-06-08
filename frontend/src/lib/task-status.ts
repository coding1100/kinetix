export type TaskStatusKey = "OPEN" | "TODO" | "IN_PROGRESS" | "DONE";

export const TASK_STATUS_COLUMNS: {
  key: TaskStatusKey;
  label: string;
  color: string;
}[] = [
  { key: "OPEN", label: "open", color: "#5f55ee" },
  { key: "TODO", label: "to do", color: "#87909e" },
  { key: "IN_PROGRESS", label: "in progress", color: "#4194f6" },
  { key: "DONE", label: "done", color: "#6bc950" },
];

const labelToKey = new Map(
  TASK_STATUS_COLUMNS.map((c) => [c.label, c.key])
);

const keyToLabel = new Map(
  TASK_STATUS_COLUMNS.map((c) => [c.key, c.label])
);

export function taskStatusKeyFromLabel(label: string): TaskStatusKey {
  return labelToKey.get(label) ?? "TODO";
}

export function taskStatusLabelFromKey(key: TaskStatusKey): string {
  return keyToLabel.get(key) ?? "to do";
}

export function taskStatusColorFromKey(key: TaskStatusKey): string {
  return TASK_STATUS_COLUMNS.find((c) => c.key === key)?.color ?? "#87909e";
}
