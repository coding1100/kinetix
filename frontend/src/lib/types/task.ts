export interface TaskComment {
  id: string;
  authorId?: string;
  author: string;
  body: string;
  at: string;
  createdAt?: string | null;
  updatedAt?: string | null;
  isEdited?: boolean;
  parentCommentId?: string | null;
  replyCount?: number;
  replies?: TaskComment[];
  attachments?: TaskAttachment[];
}

export interface TaskTimeTracking {
  active: boolean;
  entryId?: string | null;
  startedAt?: string | null;
}

export interface TaskSubtask {
  id: string;
  name: string;
  status: string;
  statusKey?: string;
  statusColor: string;
}

export interface TaskAttachment {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  status: string;
  downloadUrl?: string | null;
  createdAt?: string | null;
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
  startDate?: string | null;
  startDateIso?: string | null;
  timeEstimateMinutes?: number | null;
  timeTrackedSeconds?: number;
  timeTracking?: TaskTimeTracking;
  assignees: string[];
  list: string;
  listId?: string;
  space: string;
  priority?: "urgent" | "high" | "normal" | "low";
  overdue?: boolean;
  description?: string;
  commentCount?: number;
  subtaskCount?: number;
  comments?: TaskComment[];
  subtasks?: TaskSubtask[];
  attachments?: TaskAttachment[];
  inLineup?: boolean;
  isFollowing?: boolean;
}
