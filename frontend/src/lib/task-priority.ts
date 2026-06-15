export type TaskPriority = "urgent" | "high" | "normal" | "low";

export const TASK_PRIORITIES: {
  value: TaskPriority;
  label: string;
}[] = [
  { value: "urgent", label: "Urgent" },
  { value: "high", label: "High" },
  { value: "normal", label: "Normal" },
  { value: "low", label: "Low" },
];

export function taskPriorityLabel(value: TaskPriority | undefined): string {
  if (!value) return "";
  return TASK_PRIORITIES.find((p) => p.value === value)?.label ?? value;
}
