export interface TaskComment {
  id: string;
  authorId?: string;
  author: string;
  authorIsDisabled?: boolean;
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

export interface TaskChecklistItem {
  id: string;
  text: string;
  isChecked: boolean;
  assigneeId?: string | null;
  assigneeName?: string | null;
}

export interface TaskChecklist {
  id: string;
  name: string;
  itemCount: number;
  checkedCount: number;
  items: TaskChecklistItem[];
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
  followerIds?: string[];
  dueDate?: string;
  dueDateIso?: string | null;
  startDate?: string | null;
  startDateIso?: string | null;
  timeEstimateMinutes?: number | null;
  timeTrackedSeconds?: number;
  timeTracking?: TaskTimeTracking;
  assignees: string[];
  disabledAssigneeIds?: string[];
  list: string;
  listId?: string;
  space: string;
  priority?: "urgent" | "high" | "normal" | "low";
  overdue?: boolean;
  description?: string;
  createdAt?: string | null;
  updatedAt?: string | null;
  commentCount?: number;
  subtaskCount?: number;
  comments?: TaskComment[];
  subtasks?: TaskSubtask[];
  attachments?: TaskAttachment[];
  checklists?: TaskChecklist[];
  inLineup?: boolean;
  isFollowing?: boolean;
}

export type TaskDependencyType = "blocking" | "blocked_by" | "linked";

export interface TaskDependency {
  id: string;
  type: TaskDependencyType;
  task: TaskSubtask;
}

export interface TaskActivityEvent {
  id: string;
  type: string;
  title: string;
  preview: string;
  source: string;
  createdAt: string;
  href?: string;
  activityKind?: string | null;
}
