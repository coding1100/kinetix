from datetime import datetime, timezone

from sqlalchemy import delete, func, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.errors import AppError
from app.db.models.enums import (
    InboxBucket,
    InboxItemType,
    MemberStatus,
    TaskPriority,
    TaskStatus,
)
from app.db.models.home import (
    AssignedComment,
    Folder,
    HomeFavorite,
    HomeRecent,
    HomeReminder,
    InboxItem,
    ListStatus,
    Post,
    Space,
    Task,
    TaskAssignee,
    TaskComment,
    TaskFollower,
    TaskList,
    UserHomeSidebar,
    UserTaskLineup,
)
from app.services.list_status_service import (
    default_status_for_list,
    ensure_list_statuses,
    get_list_status,
    list_statuses_for_list,
)
from app.services.personal_space_service import ensure_personal_space
from app.db.models.workspace import WorkspaceMember
from app.schemas.home import (
    AddLineupBody,
    CreateFavoriteBody,
    CreatePostBody,
    CreateReminderBody,
    CreateTaskBody,
    RecordRecentBody,
    ReorderLineupBody,
    UpdateInboxItemBody,
    UpdateTaskBody,
)
from app.services import workspace_service
from app.services.notification_service import (
    create_task_assignment_notifications,
    emit_home_notifications,
)
from app.socket.emit import broadcast_task_event
from app.services.home_helpers import (
    STATUS_COLORS,
    end_of_today,
    format_due_date,
    map_inbox_type,
    map_list_entry,
    map_space_row,
    map_task,
    relative_time,
    start_of_today,
)

_TASK_LOAD = (
    selectinload(Task.task_list).selectinload(TaskList.space),
    selectinload(Task.list_status),
    selectinload(Task.assignees).selectinload(TaskAssignee.user),
    selectinload(Task.comments).selectinload(TaskComment.user),
)

_SPACE_LOAD = (
    selectinload(Space.folders)
    .selectinload(Folder.lists)
    .selectinload(TaskList.tasks),
    selectinload(Space.lists).selectinload(TaskList.tasks),
)


async def _active_member_count(session: AsyncSession, workspace_id: str) -> int:
    count = await session.scalar(
        select(func.count())
        .select_from(WorkspaceMember)
        .where(
            WorkspaceMember.workspace_id == workspace_id,
            WorkspaceMember.status == MemberStatus.ACTIVE,
        )
    )
    return int(count or 0)


async def _list_count_for_space(session: AsyncSession, space_id: str) -> int:
    count = await session.scalar(
        select(func.count())
        .select_from(TaskList)
        .where(TaskList.space_id == space_id)
    )
    return int(count or 0)


def _build_space_payload(space, member_count: int, list_count: int) -> dict:
    folders = []
    for folder in space.folders:
        folders.append(
            {
                "id": folder.id,
                "name": folder.name,
                "lists": [
                    map_list_entry(lst, len(lst.tasks))
                    for lst in folder.lists
                ],
            }
        )
    standalone = [
        map_list_entry(lst, len(lst.tasks))
        for lst in space.lists
        if lst.folder_id is None
    ]
    return map_space_row(space, member_count, list_count, folders, standalone)


async def list_inbox(
    session: AsyncSession,
    workspace_id: str,
    user_id: str,
    tab: str,
) -> dict:
    bucket = InboxBucket.LATER if tab == "later" else InboxBucket.ALL
    items = (
        await session.scalars(
            select(InboxItem)
            .where(
                InboxItem.workspace_id == workspace_id,
                InboxItem.user_id == user_id,
                InboxItem.bucket == bucket,
            )
            .order_by(InboxItem.created_at.desc())
        )
    ).all()
    return {
        "data": [
            {
                "id": item.id,
                "type": map_inbox_type(item.type),
                "title": item.title,
                "preview": item.preview,
                "source": item.source,
                "createdAt": item.created_at.isoformat(),
                "unread": item.unread,
                "group": item.time_group.value.lower(),
                "href": item.href,
            }
            for item in items
        ]
    }


async def update_inbox_item(
    session: AsyncSession,
    workspace_id: str,
    user_id: str,
    item_id: str,
    body: UpdateInboxItemBody,
) -> dict:
    item = await session.scalar(
        select(InboxItem).where(
            InboxItem.id == item_id,
            InboxItem.workspace_id == workspace_id,
            InboxItem.user_id == user_id,
        )
    )
    if not item:
        raise AppError(404, "NOT_FOUND", "Inbox item not found")

    if body.unread is not None:
        item.unread = body.unread
    if body.bucket is not None:
        item.bucket = InboxBucket(body.bucket)

    await session.commit()
    await session.refresh(item)
    return {
        "id": item.id,
        "unread": item.unread,
        "bucket": item.bucket.value.lower(),
    }


async def list_replies(
    session: AsyncSession, workspace_id: str, user_id: str
) -> dict:
    items = (
        await session.scalars(
            select(InboxItem)
            .where(
                InboxItem.workspace_id == workspace_id,
                InboxItem.user_id == user_id,
                InboxItem.type == InboxItemType.REPLY,
            )
            .order_by(InboxItem.created_at.desc())
        )
    ).all()
    return {
        "data": [
            {
                "id": item.id,
                "channel": item.source.lstrip("#"),
                "preview": item.preview,
                "unread": item.unread,
                "href": item.href or "/chat",
            }
            for item in items
        ]
    }


async def list_assigned_comments(
    session: AsyncSession, workspace_id: str, user_id: str
) -> dict:
    rows = (
        await session.scalars(
            select(AssignedComment)
            .where(
                AssignedComment.workspace_id == workspace_id,
                AssignedComment.assignee_id == user_id,
                AssignedComment.resolved_at.is_(None),
            )
            .options(selectinload(AssignedComment.task))
            .order_by(AssignedComment.created_at.desc())
        )
    ).all()
    return {
        "data": [
            {
                "id": row.id,
                "task": row.task.name,
                "comment": row.body,
                "author": row.author_name,
                "due": row.due_label or "—",
            }
            for row in rows
        ]
    }


async def resolve_assigned_comment(
    session: AsyncSession,
    workspace_id: str,
    user_id: str,
    comment_id: str,
) -> dict:
    row = await session.scalar(
        select(AssignedComment).where(
            AssignedComment.id == comment_id,
            AssignedComment.workspace_id == workspace_id,
            AssignedComment.assignee_id == user_id,
        )
    )
    if not row:
        raise AppError(404, "NOT_FOUND", "Comment not found")
    row.resolved_at = datetime.now(timezone.utc)
    await session.commit()
    return {"id": comment_id, "resolved": True}


async def list_chat_activity(
    session: AsyncSession,
    workspace_id: str,
    user_id: str,
    kind: str | None,
) -> dict:
    types = [
        InboxItemType.MENTION,
        InboxItemType.REACTION,
        InboxItemType.ASSIGNMENT,
    ]
    items = (
        await session.scalars(
            select(InboxItem)
            .where(
                InboxItem.workspace_id == workspace_id,
                InboxItem.user_id == user_id,
                InboxItem.type.in_(types),
            )
            .order_by(InboxItem.created_at.desc())
        )
    ).all()
    mapped = [
        {
            "id": item.id,
            "kind": item.activity_kind or item.type.value.lower(),
            "text": item.title,
            "time": relative_time(item.created_at),
            "href": item.href or "/chat",
        }
        for item in items
    ]
    if kind and kind != "all":
        mapped = [i for i in mapped if i["kind"] == kind]
    return {"data": mapped}


async def list_drafts_sent(
    session: AsyncSession,
    workspace_id: str,
    user_id: str,
    tab: str,
) -> dict:
    type_map = {
        "drafts": InboxItemType.DRAFT,
        "sent": InboxItemType.SENT,
        "scheduled": InboxItemType.SCHEDULED,
    }
    item_type = type_map.get(tab, InboxItemType.DRAFT)
    items = (
        await session.scalars(
            select(InboxItem)
            .where(
                InboxItem.workspace_id == workspace_id,
                InboxItem.user_id == user_id,
                InboxItem.type == item_type,
            )
            .order_by(InboxItem.created_at.desc())
        )
    ).all()
    type_label = (
        "draft" if tab == "drafts" else "sent" if tab == "sent" else "scheduled"
    )
    return {
        "data": [
            {
                "id": item.id,
                "target": item.source,
                "preview": item.preview,
                "type": type_label,
                "at": item.sent_at_label or relative_time(item.created_at),
            }
            for item in items
        ]
    }


async def list_spaces(session: AsyncSession, workspace_id: str) -> dict:
    await ensure_personal_space(session, workspace_id)
    await session.commit()
    spaces = (
        await session.scalars(
            select(Space)
            .where(Space.workspace_id == workspace_id)
            .options(*_SPACE_LOAD)
            .order_by(Space.is_personal.desc(), Space.name.asc())
        )
    ).all()
    member_count = await _active_member_count(session, workspace_id)
    data = []
    for space in spaces:
        list_count = await _list_count_for_space(session, space.id)
        data.append(_build_space_payload(space, member_count, list_count))
    return {"data": data}


async def get_space(
    session: AsyncSession, workspace_id: str, space_id: str
) -> dict:
    space = await session.scalar(
        select(Space)
        .where(Space.id == space_id, Space.workspace_id == workspace_id)
        .options(*_SPACE_LOAD)
    )
    if not space:
        raise AppError(404, "NOT_FOUND", "Space not found")
    member_count = await _active_member_count(session, workspace_id)
    list_count = await _list_count_for_space(session, space.id)
    return _build_space_payload(space, member_count, list_count)


def _task_filters(
    workspace_id: str, user_id: str, filter_name: str | None, search: str | None
):
    base = [Space.workspace_id == workspace_id]
    if search and search.strip():
        term = f"%{search.strip()}%"
        base.append(Task.name.ilike(term))
    if filter_name == "assigned":
        base.append(Task.assignees.any(TaskAssignee.user_id == user_id))
    elif filter_name == "personal":
        base.append(
            or_(Space.is_personal.is_(True), Space.name == "Personal")
        )
    elif filter_name == "today":
        base.extend(
            [
                Task.due_date <= end_of_today(),
                Task.status != TaskStatus.DONE,
            ]
        )
    elif filter_name == "overdue":
        base.extend(
            [
                Task.due_date < start_of_today(),
                Task.status != TaskStatus.DONE,
            ]
        )
    return base


async def get_list(
    session: AsyncSession, workspace_id: str, list_id: str
) -> dict:
    task_list = await session.scalar(
        select(TaskList)
        .join(Space)
        .where(TaskList.id == list_id, Space.workspace_id == workspace_id)
        .options(selectinload(TaskList.space))
    )
    if not task_list:
        raise AppError(404, "NOT_FOUND", "List not found")
    space = task_list.space
    statuses = await list_statuses_for_list(session, task_list.id)
    await session.commit()
    return {
        "id": task_list.id,
        "name": task_list.name,
        "space": {
            "id": space.id,
            "name": space.name,
            "color": space.color,
        },
        "statuses": statuses,
    }


async def list_tasks_for_list(
    session: AsyncSession,
    workspace_id: str,
    user_id: str,
    list_id: str,
) -> dict:
    task_list = await session.scalar(
        select(TaskList)
        .join(Space)
        .where(TaskList.id == list_id, Space.workspace_id == workspace_id)
    )
    if not task_list:
        raise AppError(404, "NOT_FOUND", "List not found")
    tasks = (
        await session.scalars(
            select(Task)
            .where(Task.list_id == list_id)
            .options(*_TASK_LOAD)
            .order_by(Task.updated_at.desc())
        )
    ).all()
    return {"data": [map_task(t, user_id) for t in tasks]}


async def create_task(
    session: AsyncSession,
    workspace_id: str,
    user_id: str,
    list_id: str,
    body: CreateTaskBody,
) -> dict:
    task_list = await session.scalar(
        select(TaskList)
        .join(Space)
        .where(TaskList.id == list_id, Space.workspace_id == workspace_id)
    )
    if not task_list:
        raise AppError(404, "NOT_FOUND", "List not found")
    await ensure_list_statuses(session, list_id)
    default_status = await default_status_for_list(session, list_id)
    now = datetime.now(timezone.utc)
    task = Task(
        list_id=list_id,
        name=body.name.strip(),
        description=body.description,
        updated_at=now,
        status_id=default_status.id if default_status else None,
        status_color=default_status.color if default_status else "#87909e",
    )
    session.add(task)
    await session.commit()
    refreshed = await session.scalar(
        select(Task).where(Task.id == task.id).options(*_TASK_LOAD)
    )
    mapped = map_task(refreshed, user_id)
    await broadcast_task_event(
        workspace_id=workspace_id,
        action="created",
        task_id=refreshed.id,
        list_id=refreshed.list_id,
        task=mapped,
    )
    return mapped


async def list_tasks(
    session: AsyncSession,
    workspace_id: str,
    user_id: str,
    filter_name: str | None,
    search: str | None = None,
) -> dict:
    if filter_name == "personal":
        await ensure_personal_space(session, workspace_id)
        await session.commit()
    tasks = (
        await session.scalars(
            select(Task)
            .join(Task.task_list)
            .join(TaskList.space)
            .where(*_task_filters(workspace_id, user_id, filter_name, search))
            .options(*_TASK_LOAD)
            .order_by(Task.updated_at.desc())
        )
    ).all()
    return {"data": [map_task(t, user_id) for t in tasks]}


async def get_task(
    session: AsyncSession,
    workspace_id: str,
    user_id: str,
    task_id: str,
) -> dict:
    task = await session.scalar(
        select(Task)
        .join(Task.task_list)
        .join(TaskList.space)
        .where(Task.id == task_id, Space.workspace_id == workspace_id)
        .options(*_TASK_LOAD)
    )
    if not task:
        raise AppError(404, "NOT_FOUND", "Task not found")
    payload = map_task(task, user_id)
    payload["inLineup"] = await is_task_in_lineup(
        session, workspace_id, user_id, task_id
    )
    payload["isFollowing"] = await is_task_followed_by(
        session, task_id, user_id
    )
    return payload


async def update_task(
    session: AsyncSession,
    workspace_id: str,
    user_id: str,
    task_id: str,
    body: UpdateTaskBody,
) -> dict:
    task = await session.scalar(
        select(Task)
        .join(Task.task_list)
        .join(TaskList.space)
        .where(Task.id == task_id, Space.workspace_id == workspace_id)
    )
    if not task:
        raise AppError(404, "NOT_FOUND", "Task not found")

    old_assignee_ids: set[str] = set()
    if body.assignee_ids is not None:
        old_assignee_ids = set(
            (
                await session.scalars(
                    select(TaskAssignee.user_id).where(
                        TaskAssignee.task_id == task_id
                    )
                )
            ).all()
        )

    if body.name is not None:
        task.name = body.name.strip()
    if body.description is not None:
        task.description = body.description or None
    if body.status:
        task.status = TaskStatus(body.status)
        task.status_color = STATUS_COLORS.get(task.status, task.status_color)
        status_row = await session.scalar(
            select(ListStatus).where(
                ListStatus.list_id == task.list_id,
                ListStatus.legacy_key == task.status.value,
            )
        )
        if status_row:
            task.status_id = status_row.id
            task.status_color = status_row.color

    if "status_id" in body.model_fields_set and body.status_id is not None:
        status_row = await get_list_status(session, task.list_id, body.status_id)
        if not status_row:
            raise AppError(400, "VALIDATION_ERROR", "Invalid status")
        task.status_id = status_row.id
        task.status_color = status_row.color
        if status_row.legacy_key:
            task.status = TaskStatus(status_row.legacy_key)

    if body.due_date is not None:
        if body.due_date.strip() == "":
            task.due_date = None
        else:
            raw = body.due_date.replace("Z", "+00:00")
            parsed = datetime.fromisoformat(raw)
            task.due_date = (
                parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)
            )
    if body.assignee_ids is not None:
        members = await workspace_service.list_workspace_members(
            session, workspace_id
        )
        allowed = {m["id"] for m in members}
        for uid in body.assignee_ids:
            if uid not in allowed:
                raise AppError(400, "VALIDATION_ERROR", "Invalid assignee")
        await session.execute(
            delete(TaskAssignee).where(TaskAssignee.task_id == task_id)
        )
        for uid in body.assignee_ids:
            session.add(TaskAssignee(task_id=task_id, user_id=uid))

    if "priority" in body.model_fields_set:
        task.priority = (
            TaskPriority(body.priority.upper()) if body.priority else None
        )

    if body.list_id is not None:
        target_list = await session.scalar(
            select(TaskList)
            .join(Space)
            .where(
                TaskList.id == body.list_id,
                Space.workspace_id == workspace_id,
            )
        )
        if not target_list:
            raise AppError(400, "VALIDATION_ERROR", "Invalid list")
        task.list_id = target_list.id

    task.updated_at = datetime.now(timezone.utc)

    assignment_notifications: list = []
    if body.assignee_ids is not None:
        added = set(body.assignee_ids) - old_assignee_ids
        if added:
            assignment_notifications = await create_task_assignment_notifications(
                session,
                workspace_id=workspace_id,
                actor_user_id=user_id,
                task_name=task.name,
                task_id=task_id,
                assignee_ids=list(added),
            )

    await session.commit()
    refreshed = await session.scalar(
        select(Task)
        .where(Task.id == task_id)
        .options(*_TASK_LOAD)
    )
    mapped = map_task(refreshed, user_id)
    if assignment_notifications:
        await emit_home_notifications(
            session, workspace_id, assignment_notifications
        )
    await broadcast_task_event(
        workspace_id=workspace_id,
        action="updated",
        task_id=task_id,
        list_id=refreshed.list_id,
        task=mapped,
    )
    return mapped


async def delete_task(
    session: AsyncSession,
    workspace_id: str,
    task_id: str,
) -> dict:
    task = await session.scalar(
        select(Task)
        .join(Task.task_list)
        .join(TaskList.space)
        .where(Task.id == task_id, Space.workspace_id == workspace_id)
    )
    if not task:
        raise AppError(404, "NOT_FOUND", "Task not found")
    task_id = task.id
    list_id = task.list_id
    await session.delete(task)
    await session.commit()
    await broadcast_task_event(
        workspace_id=workspace_id,
        action="deleted",
        task_id=task_id,
        list_id=list_id,
    )
    return {"ok": True}


async def list_posts(session: AsyncSession, workspace_id: str) -> dict:
    posts = (
        await session.scalars(
            select(Post)
            .where(Post.workspace_id == workspace_id)
            .options(selectinload(Post.author))
            .order_by(Post.created_at.desc())
        )
    ).all()
    return {
        "data": [
            {
                "id": p.id,
                "author": p.author.full_name,
                "channel": p.channel,
                "content": p.content,
                "createdAt": p.created_at.isoformat(),
                "reactions": p.reactions,
            }
            for p in posts
        ]
    }


async def create_post(
    session: AsyncSession,
    workspace_id: str,
    author_id: str,
    body: CreatePostBody,
) -> dict:
    post = Post(
        workspace_id=workspace_id,
        author_id=author_id,
        channel=body.channel,
        content=body.content,
    )
    session.add(post)
    await session.commit()
    loaded = await session.scalar(
        select(Post)
        .where(Post.id == post.id)
        .options(selectinload(Post.author))
    )
    return {
        "id": loaded.id,
        "author": loaded.author.full_name,
        "channel": loaded.channel,
        "content": loaded.content,
        "createdAt": loaded.created_at.isoformat(),
        "reactions": loaded.reactions,
    }


async def list_reminders(
    session: AsyncSession, workspace_id: str, user_id: str
) -> dict:
    rows = (
        await session.scalars(
            select(HomeReminder)
            .where(
                HomeReminder.workspace_id == workspace_id,
                HomeReminder.user_id == user_id,
            )
            .order_by(HomeReminder.due_at.asc())
        )
    ).all()
    return {
        "data": [{"id": r.id, "title": r.title, "due": r.due_label} for r in rows]
    }


async def list_favorites(
    session: AsyncSession, workspace_id: str, user_id: str
) -> dict:
    rows = (
        await session.scalars(
            select(HomeFavorite)
            .where(
                HomeFavorite.workspace_id == workspace_id,
                HomeFavorite.user_id == user_id,
            )
            .order_by(HomeFavorite.name.asc())
        )
    ).all()
    return {
        "data": [
            {
                "id": r.id,
                "name": r.name,
                "type": r.item_type,
                "href": r.href,
            }
            for r in rows
        ]
    }


async def list_recents(
    session: AsyncSession, workspace_id: str, user_id: str
) -> dict:
    rows = (
        await session.scalars(
            select(HomeRecent)
            .where(
                HomeRecent.workspace_id == workspace_id,
                HomeRecent.user_id == user_id,
            )
            .order_by(HomeRecent.visited_at.desc())
            .limit(30)
        )
    ).all()
    return {
        "data": [
            {
                "id": r.id,
                "name": r.name,
                "type": r.item_type,
                "space": r.space,
                "href": r.href,
            }
            for r in rows
        ]
    }


async def create_reminder(
    session: AsyncSession,
    workspace_id: str,
    user_id: str,
    body: CreateReminderBody,
) -> dict:
    due_at = None
    due_label = "Soon"
    if body.due_at:
        raw = body.due_at.replace("Z", "+00:00")
        parsed = datetime.fromisoformat(raw)
        due_at = parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)
        due_label = format_due_date(due_at) or due_label

    reminder = HomeReminder(
        workspace_id=workspace_id,
        user_id=user_id,
        title=body.title.strip(),
        due_label=due_label,
        due_at=due_at,
    )
    session.add(reminder)
    await session.commit()
    await session.refresh(reminder)
    return {"id": reminder.id, "title": reminder.title, "due": reminder.due_label}


async def delete_reminder(
    session: AsyncSession,
    workspace_id: str,
    user_id: str,
    reminder_id: str,
) -> dict:
    reminder = await session.scalar(
        select(HomeReminder).where(
            HomeReminder.id == reminder_id,
            HomeReminder.workspace_id == workspace_id,
            HomeReminder.user_id == user_id,
        )
    )
    if not reminder:
        raise AppError(404, "NOT_FOUND", "Reminder not found")
    await session.delete(reminder)
    await session.commit()
    return {"ok": True}


async def create_favorite(
    session: AsyncSession,
    workspace_id: str,
    user_id: str,
    body: CreateFavoriteBody,
) -> dict:
    existing = await session.scalar(
        select(HomeFavorite).where(
            HomeFavorite.workspace_id == workspace_id,
            HomeFavorite.user_id == user_id,
            HomeFavorite.href == body.href,
        )
    )
    if existing:
        return {
            "id": existing.id,
            "name": existing.name,
            "type": existing.item_type,
            "href": existing.href,
        }

    favorite = HomeFavorite(
        workspace_id=workspace_id,
        user_id=user_id,
        name=body.name.strip(),
        item_type=body.item_type,
        href=body.href,
    )
    session.add(favorite)
    await session.commit()
    await session.refresh(favorite)
    return {
        "id": favorite.id,
        "name": favorite.name,
        "type": favorite.item_type,
        "href": favorite.href,
    }


async def delete_favorite(
    session: AsyncSession,
    workspace_id: str,
    user_id: str,
    favorite_id: str,
) -> dict:
    favorite = await session.scalar(
        select(HomeFavorite).where(
            HomeFavorite.id == favorite_id,
            HomeFavorite.workspace_id == workspace_id,
            HomeFavorite.user_id == user_id,
        )
    )
    if not favorite:
        raise AppError(404, "NOT_FOUND", "Favorite not found")
    await session.delete(favorite)
    await session.commit()
    return {"ok": True}


async def record_recent(
    session: AsyncSession,
    workspace_id: str,
    user_id: str,
    body: RecordRecentBody,
) -> dict:
    existing = await session.scalar(
        select(HomeRecent).where(
            HomeRecent.workspace_id == workspace_id,
            HomeRecent.user_id == user_id,
            HomeRecent.href == body.href,
        )
    )
    now = datetime.now(timezone.utc)
    if existing:
        existing.name = body.name.strip()
        existing.item_type = body.item_type
        existing.space = body.space
        existing.visited_at = now
        recent = existing
    else:
        recent = HomeRecent(
            workspace_id=workspace_id,
            user_id=user_id,
            name=body.name.strip(),
            item_type=body.item_type,
            space=body.space,
            href=body.href,
            visited_at=now,
        )
        session.add(recent)

    await session.commit()
    await session.refresh(recent)

    overflow = (
        await session.scalars(
            select(HomeRecent.id)
            .where(
                HomeRecent.workspace_id == workspace_id,
                HomeRecent.user_id == user_id,
            )
            .order_by(HomeRecent.visited_at.desc())
            .offset(30)
        )
    ).all()
    if overflow:
        await session.execute(
            delete(HomeRecent).where(HomeRecent.id.in_(overflow))
        )
        await session.commit()

    return {
        "id": recent.id,
        "name": recent.name,
        "type": recent.item_type,
        "space": recent.space,
        "href": recent.href,
    }


async def _get_workspace_task(
    session: AsyncSession, workspace_id: str, task_id: str
) -> Task:
    task = await session.scalar(
        select(Task)
        .join(Task.task_list)
        .join(TaskList.space)
        .where(Task.id == task_id, Space.workspace_id == workspace_id)
    )
    if not task:
        raise AppError(404, "NOT_FOUND", "Task not found")
    return task


async def list_lineup(
    session: AsyncSession, workspace_id: str, user_id: str
) -> dict:
    rows = (
        await session.scalars(
            select(Task)
            .join(UserTaskLineup, UserTaskLineup.task_id == Task.id)
            .join(TaskList)
            .join(Space)
            .where(
                UserTaskLineup.workspace_id == workspace_id,
                UserTaskLineup.user_id == user_id,
                Space.workspace_id == workspace_id,
            )
            .options(*_TASK_LOAD)
            .order_by(UserTaskLineup.sort_order.asc())
        )
    ).all()
    return {"data": [map_task(t, user_id) for t in rows]}


async def add_to_lineup(
    session: AsyncSession,
    workspace_id: str,
    user_id: str,
    body: AddLineupBody,
) -> dict:
    await _get_workspace_task(session, workspace_id, body.task_id)
    existing = await session.scalar(
        select(UserTaskLineup).where(
            UserTaskLineup.user_id == user_id,
            UserTaskLineup.task_id == body.task_id,
        )
    )
    if existing:
        return {"ok": True, "taskId": body.task_id}

    max_order = await session.scalar(
        select(func.max(UserTaskLineup.sort_order)).where(
            UserTaskLineup.workspace_id == workspace_id,
            UserTaskLineup.user_id == user_id,
        )
    )
    session.add(
        UserTaskLineup(
            workspace_id=workspace_id,
            user_id=user_id,
            task_id=body.task_id,
            sort_order=int(max_order or 0) + 1,
        )
    )
    await session.commit()
    return {"ok": True, "taskId": body.task_id}


async def remove_from_lineup(
    session: AsyncSession,
    workspace_id: str,
    user_id: str,
    task_id: str,
) -> dict:
    row = await session.scalar(
        select(UserTaskLineup).where(
            UserTaskLineup.workspace_id == workspace_id,
            UserTaskLineup.user_id == user_id,
            UserTaskLineup.task_id == task_id,
        )
    )
    if not row:
        raise AppError(404, "NOT_FOUND", "Task not in LineUp")
    await session.delete(row)
    await session.commit()
    return {"ok": True}


async def reorder_lineup(
    session: AsyncSession,
    workspace_id: str,
    user_id: str,
    body: ReorderLineupBody,
) -> dict:
    rows = (
        await session.scalars(
            select(UserTaskLineup).where(
                UserTaskLineup.workspace_id == workspace_id,
                UserTaskLineup.user_id == user_id,
            )
        )
    ).all()
    by_task = {r.task_id: r for r in rows}
    for i, task_id in enumerate(body.task_ids):
        row = by_task.get(task_id)
        if row:
            row.sort_order = i
    await session.commit()
    return {"ok": True}


async def is_task_in_lineup(
    session: AsyncSession,
    workspace_id: str,
    user_id: str,
    task_id: str,
) -> bool:
    row = await session.scalar(
        select(UserTaskLineup.id).where(
            UserTaskLineup.workspace_id == workspace_id,
            UserTaskLineup.user_id == user_id,
            UserTaskLineup.task_id == task_id,
        )
    )
    return row is not None


async def is_task_followed_by(
    session: AsyncSession, task_id: str, user_id: str
) -> bool:
    row = await session.scalar(
        select(TaskFollower.user_id).where(
            TaskFollower.task_id == task_id,
            TaskFollower.user_id == user_id,
        )
    )
    return row is not None


async def follow_task(
    session: AsyncSession,
    workspace_id: str,
    user_id: str,
    task_id: str,
) -> dict:
    await _get_workspace_task(session, workspace_id, task_id)
    existing = await session.scalar(
        select(TaskFollower).where(
            TaskFollower.task_id == task_id,
            TaskFollower.user_id == user_id,
        )
    )
    if not existing:
        session.add(TaskFollower(task_id=task_id, user_id=user_id))
        await session.commit()
    return {"ok": True, "following": True}


async def unfollow_task(
    session: AsyncSession,
    workspace_id: str,
    user_id: str,
    task_id: str,
) -> dict:
    row = await session.scalar(
        select(TaskFollower)
        .join(Task)
        .join(TaskList)
        .join(Space)
        .where(
            TaskFollower.task_id == task_id,
            TaskFollower.user_id == user_id,
            Space.workspace_id == workspace_id,
        )
    )
    if row:
        await session.delete(row)
        await session.commit()
    return {"ok": True, "following": False}


async def list_notifications(
    session: AsyncSession,
    workspace_id: str,
    user_id: str,
    limit: int = 50,
) -> dict:
    items = (
        await session.scalars(
            select(InboxItem)
            .where(
                InboxItem.workspace_id == workspace_id,
                InboxItem.user_id == user_id,
            )
            .order_by(InboxItem.created_at.desc())
            .limit(limit)
        )
    ).all()
    unread_count = await session.scalar(
        select(func.count())
        .select_from(InboxItem)
        .where(
            InboxItem.workspace_id == workspace_id,
            InboxItem.user_id == user_id,
            InboxItem.unread.is_(True),
        )
    )
    return {
        "unreadCount": int(unread_count or 0),
        "data": [
            {
                "id": item.id,
                "type": map_inbox_type(item.type),
                "title": item.title,
                "preview": item.preview,
                "source": item.source,
                "createdAt": item.created_at.isoformat(),
                "unread": item.unread,
                "href": item.href,
            }
            for item in items
        ],
    }


async def mark_all_notifications_read(
    session: AsyncSession, workspace_id: str, user_id: str
) -> dict:
    result = await session.execute(
        update(InboxItem)
        .where(
            InboxItem.workspace_id == workspace_id,
            InboxItem.user_id == user_id,
            InboxItem.unread.is_(True),
        )
        .values(unread=False)
    )
    await session.commit()
    return {"updated": int(result.rowcount or 0)}


async def get_unread_summary(
    session: AsyncSession, workspace_id: str, user_id: str
) -> dict:
    count = await session.scalar(
        select(func.count())
        .select_from(InboxItem)
        .where(
            InboxItem.workspace_id == workspace_id,
            InboxItem.user_id == user_id,
            InboxItem.unread.is_(True),
        )
    )
    return {"home": int(count or 0)}


async def get_sidebar_config(
    session: AsyncSession, workspace_id: str, user_id: str
) -> dict:
    row = await session.scalar(
        select(UserHomeSidebar).where(
            UserHomeSidebar.user_id == user_id,
            UserHomeSidebar.workspace_id == workspace_id,
        )
    )
    return {"config": row.config if row else None}


async def update_sidebar_config(
    session: AsyncSession,
    workspace_id: str,
    user_id: str,
    config: dict,
) -> dict:
    row = await session.scalar(
        select(UserHomeSidebar).where(
            UserHomeSidebar.user_id == user_id,
            UserHomeSidebar.workspace_id == workspace_id,
        )
    )
    if row:
        row.config = config
    else:
        session.add(
            UserHomeSidebar(
                user_id=user_id,
                workspace_id=workspace_id,
                config=config,
            )
        )
    await session.commit()
    row = await session.scalar(
        select(UserHomeSidebar).where(
            UserHomeSidebar.user_id == user_id,
            UserHomeSidebar.workspace_id == workspace_id,
        )
    )
    return {"config": row.config}
