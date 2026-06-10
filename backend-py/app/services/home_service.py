from datetime import datetime, timezone

from sqlalchemy import delete, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.errors import AppError
from app.db.models.enums import (
    InboxBucket,
    InboxItemType,
    MemberStatus,
    TaskStatus,
)
from app.db.models.home import (
    AssignedComment,
    Folder,
    HomeFavorite,
    HomeRecent,
    HomeReminder,
    InboxItem,
    Post,
    Space,
    Task,
    TaskAssignee,
    TaskComment,
    TaskList,
    TaskList,
    UserHomeSidebar,
)
from app.db.models.workspace import WorkspaceMember
from app.schemas.home import (
    CreatePostBody,
    CreateTaskBody,
    UpdateInboxItemBody,
    UpdateTaskBody,
)
from app.services import workspace_service
from app.services.home_helpers import (
    STATUS_COLORS,
    end_of_today,
    map_inbox_type,
    map_list_entry,
    map_space_row,
    map_task,
    relative_time,
    start_of_today,
)

_TASK_LOAD = (
    selectinload(Task.task_list).selectinload(TaskList.space),
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
    spaces = (
        await session.scalars(
            select(Space)
            .where(Space.workspace_id == workspace_id)
            .options(*_SPACE_LOAD)
            .order_by(Space.name.asc())
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
        base.append(Space.name == "Personal")
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
    return {
        "id": task_list.id,
        "name": task_list.name,
        "space": {
            "id": space.id,
            "name": space.name,
            "color": space.color,
        },
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
    task = Task(
        list_id=list_id,
        name=body.name.strip(),
        description=body.description,
    )
    session.add(task)
    await session.commit()
    refreshed = await session.scalar(
        select(Task).where(Task.id == task.id).options(*_TASK_LOAD)
    )
    return map_task(refreshed, user_id)


async def list_tasks(
    session: AsyncSession,
    workspace_id: str,
    user_id: str,
    filter_name: str | None,
    search: str | None = None,
) -> dict:
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
    return map_task(task, user_id)


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

    if body.name is not None:
        task.name = body.name.strip()
    if body.description is not None:
        task.description = body.description or None
    if body.status:
        task.status = TaskStatus(body.status)
        task.status_color = STATUS_COLORS.get(task.status, task.status_color)
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

    await session.commit()
    refreshed = await session.scalar(
        select(Task)
        .where(Task.id == task_id)
        .options(*_TASK_LOAD)
    )
    return map_task(refreshed, user_id)


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
            .order_by(HomeRecent.id.asc())
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
