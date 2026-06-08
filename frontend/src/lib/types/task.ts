export interface TaskComment {
  id: string;
  author: string;
  body: string;
  at: string;
}

export interface Task {
  id: string;
  name: string;
  status: string;
  statusKey?: string;
  statusColor: string;
  assigneeIds?: string[];
  dueDate?: string;
  dueDateIso?: string | null;
  assignees: string[];
  list: string;
  space: string;
  priority?: "urgent" | "high" | "normal" | "low";
  overdue?: boolean;
  description?: string;
  comments?: TaskComment[];
}
