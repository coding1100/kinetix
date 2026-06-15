export interface TaskComment {
  id: string;
  author: string;
  body: string;
  at: string;
}

export interface ListStatus {
  id: string;
  name: string;
  color: string;
  statusGroup: string;
  legacyKey?: string | null;
  sortOrder: number;
}

export interface Task {
  id: string;
  name: string;
  status: string;
  statusKey?: string;
  statusId?: string | null;
  statusColor: string;
  assigneeIds?: string[];
  dueDate?: string;
  dueDateIso?: string | null;
  assignees: string[];
  list: string;
  listId?: string;
  space: string;
  priority?: "urgent" | "high" | "normal" | "low";
  overdue?: boolean;
  description?: string;
  comments?: TaskComment[];
  inLineup?: boolean;
  isFollowing?: boolean;
}
