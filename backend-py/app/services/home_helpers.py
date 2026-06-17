from datetime import datetime, timezone

from app.db.models.enums import InboxItemType, TaskStatus
from app.db.models.home import Task
from app.services.task_attachment_service import map_task_attachment


def _map_task_comment(comment) -> dict:
    updated = getattr(comment, "updated_at", None)
    return {
        "id": comment.id,
        "authorId": comment.user_id,
        "author": comment.user.full_name,
        "body": comment.body,
        "at": comment_relative_time(comment.created_at),
        "createdAt": comment.created_at.isoformat() if comment.created_at else None,
        "updatedAt": updated.isoformat() if updated else None,
        "isEdited": bool(updated),
        "parentCommentId": comment.parent_comment_id,
        "attachments": [
            map_task_attachment(a)
            for a in (getattr(comment, "attachments", None) or [])
            if a.status == "ready"
        ],
    }


def _map_task_comments_threaded(comments: list) -> list[dict]:
    sorted_comments = sorted(comments, key=lambda c: c.created_at)
    replies_by_parent: dict[str, list] = {}
    for comment in sorted_comments:
        if comment.parent_comment_id:
            replies_by_parent.setdefault(comment.parent_comment_id, []).append(comment)

    def with_replies(comment) -> dict:
        payload = _map_task_comment(comment)
        replies = sorted(
            replies_by_parent.get(comment.id, []),
            key=lambda c: c.created_at,
        )
        payload["replyCount"] = len(replies)
        payload["replies"] = [_map_task_comment(r) for r in replies]
        return payload

    top_level = [c for c in sorted_comments if not c.parent_comment_id]
    return [with_replies(c) for c in top_level]


STATUS_LABELS: dict[TaskStatus, str] = {
    TaskStatus.OPEN: "open",
    TaskStatus.TODO: "to do",
    TaskStatus.IN_PROGRESS: "in progress",
    TaskStatus.DONE: "done",
}

STATUS_COLORS: dict[TaskStatus, str] = {
    TaskStatus.IN_PROGRESS: "#4194f6",
    TaskStatus.TODO: "#87909e",
    TaskStatus.OPEN: "#5f55ee",
    TaskStatus.DONE: "#6bc950",
}


def start_of_today() -> datetime:
    now = datetime.now(timezone.utc)
    return now.replace(hour=0, minute=0, second=0, microsecond=0)


def end_of_today() -> datetime:
    return start_of_today().replace(hour=23, minute=59, second=59, microsecond=999999)


def format_due_date(due_date: datetime | None) -> str | None:
    if not due_date:
        return None
    from datetime import timedelta

    today_start = start_of_today()
    today_end = end_of_today()
    tomorrow_end = today_end + timedelta(days=1)

    due = due_date if due_date.tzinfo else due_date.replace(tzinfo=timezone.utc)
    if today_start <= due <= today_end:
        return "Today"
    if today_end < due <= tomorrow_end:
        return "Tomorrow"
    return f"{due.strftime('%b')} {due.day}"


def is_overdue(due_date: datetime | None, status: TaskStatus) -> bool:
    if not due_date or status == TaskStatus.DONE:
        return False
    due = due_date if due_date.tzinfo else due_date.replace(tzinfo=timezone.utc)
    return due < start_of_today()


def relative_time(date: datetime) -> str:
    diff_ms = (datetime.now(timezone.utc) - (
        date if date.tzinfo else date.replace(tzinfo=timezone.utc)
    )).total_seconds() * 1000
    mins = int(diff_ms // 60000)
    if mins < 60:
        return f"{mins}m"
    hours = mins // 60
    if hours < 24:
        return f"{hours}h"
    days = hours // 24
    return f"{days}d"


def comment_relative_time(date: datetime) -> str:
    diff_ms = (datetime.now(timezone.utc) - (
        date if date.tzinfo else date.replace(tzinfo=timezone.utc)
    )).total_seconds() * 1000
    hours = int(diff_ms // (1000 * 60 * 60))
    if hours < 1:
        return "Just now"
    if hours < 24:
        return f"{hours}h ago"
    days = hours // 24
    if days == 1:
        return "Yesterday"
    return f"{days}d ago"


def map_inbox_type(item_type: InboxItemType) -> str:
    return item_type.value.lower()


def map_task(task: Task, current_user_id: str) -> dict:
    assignee_labels = []
    for a in task.assignees:
        name = a.user.full_name.split(" ")[0] if a.user.full_name else "User"
        assignee_labels.append("You" if a.user_id == current_user_id else name)

    comments = sorted(task.comments, key=lambda c: c.created_at)
    if task.list_status:
        status_label = task.list_status.name
        status_color = task.list_status.color
        status_key = task.list_status.legacy_key or task.status.value
    else:
        status_label = STATUS_LABELS.get(task.status, task.status.value.lower())
        status_color = task.status_color
        status_key = task.status.value
    return {
        "id": task.id,
        "name": task.name,
        "status": status_label,
        "statusKey": status_key,
        "statusId": task.status_id,
        "statusColor": status_color,
        "assigneeIds": [a.user_id for a in task.assignees],
        "dueDate": format_due_date(task.due_date),
        "dueDateIso": task.due_date.isoformat() if task.due_date else None,
        "startDate": format_due_date(task.start_date),
        "startDateIso": task.start_date.isoformat() if task.start_date else None,
        "timeEstimateMinutes": task.time_estimate_minutes,
        "assignees": assignee_labels,
        "list": task.task_list.name,
        "listId": task.task_list.id,
        "space": task.task_list.space.name,
        "priority": task.priority.value.lower() if task.priority else None,
        "overdue": is_overdue(task.due_date, task.status),
        "description": task.description,
        "createdAt": task.created_at.isoformat() if task.created_at else None,
        "updatedAt": task.updated_at.isoformat() if task.updated_at else None,
        "commentCount": len(comments),
        "subtaskCount": len(getattr(task, "subtasks", None) or []),
        "comments": _map_task_comments_threaded(comments),
    }


def map_subtask_summary(task: Task, current_user_id: str) -> dict:
    if task.list_status:
        status_label = task.list_status.name
        status_color = task.list_status.color
        status_key = task.list_status.legacy_key or task.status.value
    else:
        status_label = STATUS_LABELS.get(task.status, task.status.value.lower())
        status_color = task.status_color
        status_key = task.status.value
    return {
        "id": task.id,
        "name": task.name,
        "status": status_label,
        "statusKey": status_key,
        "statusColor": status_color,
    }


def map_list_entry(list_row, task_count: int) -> dict:
    return {
        "id": list_row.id,
        "name": list_row.name,
        "taskCount": task_count,
    }


def map_space_row(
    space,
    member_count: int,
    list_count: int,
    folder_payload: list,
    standalone_payload: list,
) -> dict:
    return {
        "id": space.id,
        "name": space.name,
        "color": space.color,
        "memberCount": member_count,
        "listCount": list_count,
        "description": space.description,
        "isPersonal": bool(getattr(space, "is_personal", False)),
        "folders": folder_payload,
        "standaloneLists": standalone_payload,
    }
