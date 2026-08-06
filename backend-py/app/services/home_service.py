import uuid
from datetime import datetime, timezone

from sqlalchemy import delete, func, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.errors import AppError
from app.core.utils import as_aware_utc
from app.db.models.chat import ChatChannel
from app.db.models.enums import (
    InboxBucket,
    InboxItemType,
    MemberStatus,
    PermissionLevel,
    TaskPriority,
    TaskStatus,
    WorkspaceRole,
)
from app.db.models.home import (
    AssignedComment,
    Folder,
    FolderMember,
    HomeFavorite,
    HomeRecent,
    HomeReminder,
    InboxItem,
    ListMember,
    ListStatus,
    Post,
    Space,
    Task,
    TaskAttachment,
    TaskChecklist,
    TaskChecklistItem,
    TaskComment,
    TaskDependency,
    TaskList,
    UserHomeSidebar,
    UserTaskLineup,
)
from app.db.models.user import User
from app.services.list_status_service import (
    default_status_for_list,
    ensure_list_statuses,
    get_list_status,
    list_statuses_for_list,
)
from app.services.inbox_visibility import inbox_visible_clause
from app.services.personal_space_service import ensure_personal_space
from app.services.space_permissions import (
    get_space_or_403,
    level_at_least,
    resolve_space_permission,
    visible_space_ids,
)
from app.services.folder_list_permissions import (
    require_folder_permission,
    require_list_permission,
    resolve_folder_permission,
    resolve_list_permission,
)
from app.services.workspace_permissions import get_member_time_flags, is_workspace_admin
from app.db.models.workspace import WorkspaceMember
from app.schemas.home import (
    AddLineupBody,
    CreateFavoriteBody,
    CreatePostBody,
    CreateReminderBody,
    CreateChecklistBody,
    CreateChecklistItemBody,
    CreateSubtaskBody,
    CreateTaskBody,
    CreateTaskDependencyBody,
    RecordRecentBody,
    ReorderLineupBody,
    UpdateChecklistBody,
    UpdateChecklistItemBody,
    UpdateInboxItemBody,
    UpdateTaskBody,
)
from app.services import workspace_service
from app.services.notification_service import (
    create_task_activity_notifications,
    create_task_assignment_notifications,
    emit_home_notifications,
    task_notification_recipients,
)
from app.socket.emit import broadcast_task_event
from app.services.home_helpers import (
    STATUS_COLORS,
    STATUS_LABELS,
    end_of_today,
    format_due_date,
    map_checklist,
    map_checklist_item,
    map_inbox_type,
    map_list_entry,
    map_space_row,
    map_task,
    map_subtask_summary,
    relative_time,
    start_of_today,
)

_TASK_LOAD = (
    selectinload(Task.task_list).selectinload(TaskList.space),
    selectinload(Task.list_status),
    selectinload(Task.comments).selectinload(TaskComment.user),
    selectinload(Task.comments).selectinload(TaskComment.attachments),
    selectinload(Task.subtasks),
    selectinload(Task.checklists).selectinload(TaskChecklist.items).selectinload(
        TaskChecklistItem.assignee
    ),
)


async def _assignee_name_map(
    session: AsyncSession, tasks: Task | list[Task]
) -> dict[str, tuple[str, bool]]:
    """Batch-resolve first names (+ disabled flag) for every assignee across
    one or many tasks.

    Task.assignee_ids is a plain array column (no join table), so unlike a
    relationship there's nothing for selectinload to batch automatically -
    callers must resolve names themselves. Passing the whole task list here
    keeps it to one query per request instead of one per task. Every caller
    just forwards the result straight into map_task, so the (name,
    is_disabled) tuple shape only needs to be understood there.
    """
    task_list = tasks if isinstance(tasks, list) else [tasks]
    ids = {uid for t in task_list for uid in (t.assignee_ids or [])}
    if not ids:
        return {}
    rows = (
        await session.execute(
            select(User.id, User.full_name, User.is_disabled).where(User.id.in_(ids))
        )
    ).all()
    return {row[0]: (row[1], row[2]) for row in rows}


async def _user_name_map(session: AsyncSession, ids: set[str]) -> dict[str, str]:
    """Batch-resolve full names for an arbitrary set of user ids (e.g. an
    assignee/follower diff spanning both added and removed ids, which
    _assignee_name_map can't cover since it only reads a task's *current*
    assignee_ids)."""
    if not ids:
        return {}
    rows = (
        await session.execute(select(User.id, User.full_name).where(User.id.in_(ids)))
    ).all()
    return {row[0]: row[1] for row in rows}


async def _resolve_user_name(session: AsyncSession, user_id: str) -> str:
    user = await session.get(User, user_id)
    return user.full_name if user else "Someone"


def _status_label(status: TaskStatus, list_status: "ListStatus | None") -> str:
    if list_status is not None:
        return list_status.name
    return STATUS_LABELS.get(status, status.value.lower())


def _priority_label(priority: TaskPriority | None) -> str:
    return priority.value.title() if priority else "None"


def _time_estimate_label(minutes: int | None) -> str:
    if not minutes:
        return "no estimate"
    hours, mins = divmod(minutes, 60)
    if hours and mins:
        return f"{hours}h {mins}m"
    if hours:
        return f"{hours}h"
    return f"{mins}m"


def _record_task_activity(
    task: Task,
    *,
    actor_name: str,
    activity_kind: str,
    preview: str,
    title: str | None = None,
) -> None:
    """Append a view-only, append-only entry to Task.activity (JSONB).

    Reassigns the list (rather than task.activity.append(...)) so SQLAlchemy
    detects the change without needing flag_modified.
    """
    entry = {
        "id": str(uuid.uuid4()),
        "type": "activity",
        "title": title or preview,
        "preview": preview,
        "source": task.name,
        "createdAt": datetime.now(timezone.utc).isoformat(),
        "activityKind": activity_kind,
        "actorName": actor_name,
    }
    task.activity = [*(task.activity or []), entry]


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


async def _last_activity_for_space(session: AsyncSession, space):
    last_task_update = await session.scalar(
        select(func.max(Task.updated_at))
        .select_from(Task)
        .join(TaskList, Task.list_id == TaskList.id)
        .where(TaskList.space_id == space.id)
    )
    return last_task_update or space.created_at


def _can_manage_structure(level: PermissionLevel | None, role: WorkspaceRole) -> bool:
    """Rename/Delete/create-child are structural actions - real content
    EDIT isn't enough on its own, Guests/Limited Members are excluded
    even with an explicit EDIT override (mirrors spaces_service.py's
    _require_can_edit_structure, which is what actually enforces this;
    this just tells the frontend when to show the menu items at all)."""
    return level_at_least(level, PermissionLevel.EDIT) and role not in (
        WorkspaceRole.GUEST,
        WorkspaceRole.LIMITED_MEMBER,
    )


async def _build_space_payload(
    session: AsyncSession,
    space,
    member_count: int,
    list_count: int,
    user_id: str,
    role: WorkspaceRole,
) -> dict:
    # Managing sharing (canShare) is a workspace-admin capability, not tied
    # to content EDIT access - see spaces_service.py's add/remove member
    # gates. Folder/List VIEW-level filtering below is still needed though:
    # a private Folder/List the user has no grant on must not appear in the
    # tree at all, independent of who can manage its sharing.
    can_manage = is_workspace_admin(role)
    space_level = await resolve_space_permission(session, space, user_id, role)

    folders = []
    standalone = []
    for folder in space.folders:
        folder.space = space
        folder_level = await resolve_folder_permission(session, folder, user_id, role)
        folder_visible = level_at_least(folder_level, PermissionLevel.VIEW)
        lists = []
        for lst in folder.lists:
            lst.space = space
            lst_level = await resolve_list_permission(session, lst, user_id, role)
            if not level_at_least(lst_level, PermissionLevel.VIEW):
                continue
            lists.append(
                map_list_entry(
                    lst,
                    len(lst.tasks),
                    can_manage,
                    _can_manage_structure(lst_level, role),
                )
            )
        if not folder_visible:
            # No access to the Folder itself - don't expose its existence
            # or name. A directly-shared List inside it (resolve_list_
            # permission's override always wins over the parent chain)
            # still needs to surface, just as a standalone entry instead
            # of nested under a Folder container the user can't see.
            standalone.extend(lists)
            continue
        folders.append(
            {
                "id": folder.id,
                "name": folder.name,
                "lists": lists,
                "canShare": can_manage,
                "canManageStructure": _can_manage_structure(folder_level, role),
                "isPrivate": folder.is_private,
            }
        )
    for lst in space.lists:
        if lst.folder_id is not None:
            continue
        lst.space = space
        lst_level = await resolve_list_permission(session, lst, user_id, role)
        if not level_at_least(lst_level, PermissionLevel.VIEW):
            continue
        standalone.append(
            map_list_entry(
                lst,
                len(lst.tasks),
                can_manage,
                _can_manage_structure(lst_level, role),
            )
        )
    last_activity_at = await _last_activity_for_space(session, space)
    return map_space_row(
        space,
        member_count,
        list_count,
        folders,
        standalone,
        last_activity_at,
        can_manage,
        _can_manage_structure(space_level, role),
    )


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
                inbox_visible_clause(),
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
                "createdAt": as_aware_utc(item.created_at).isoformat(),
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


async def list_spaces(
    session: AsyncSession, workspace_id: str, user_id: str, role: WorkspaceRole
) -> dict:
    await ensure_personal_space(session, workspace_id)
    await session.commit()
    visible = await visible_space_ids(session, workspace_id, user_id, role)
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
        if visible is not None and space.id not in visible:
            continue
        list_count = await _list_count_for_space(session, space.id)
        data.append(
            await _build_space_payload(
                session, space, member_count, list_count, user_id, role
            )
        )
    return {"data": data}


async def list_shared_with_me(
    session: AsyncSession, workspace_id: str, user_id: str, role: WorkspaceRole
) -> dict:
    """Folders/Lists the user has an explicit grant on but can't already see
    via their Space access — i.e. content shared with them individually."""
    visible = await visible_space_ids(session, workspace_id, user_id, role)
    if visible is None:
        return {"data": []}

    folder_rows = (
        await session.scalars(
            select(FolderMember)
            .join(Folder, Folder.id == FolderMember.folder_id)
            .join(Space, Space.id == Folder.space_id)
            .where(
                Space.workspace_id == workspace_id,
                FolderMember.user_id == user_id,
                FolderMember.status == MemberStatus.ACTIVE,
            )
            .options(
                selectinload(FolderMember.folder)
                .selectinload(Folder.space),
                selectinload(FolderMember.folder)
                .selectinload(Folder.lists)
                .selectinload(TaskList.tasks),
            )
        )
    ).all()
    list_rows = (
        await session.scalars(
            select(ListMember)
            .join(TaskList, TaskList.id == ListMember.list_id)
            .join(Space, Space.id == TaskList.space_id)
            .where(
                Space.workspace_id == workspace_id,
                ListMember.user_id == user_id,
                ListMember.status == MemberStatus.ACTIVE,
            )
            .options(selectinload(ListMember.task_list).selectinload(TaskList.space))
        )
    ).all()

    data = []
    nested_list_ids: set[str] = set()
    for row in folder_rows:
        folder = row.folder
        if folder.space_id in visible:
            continue
        lists = []
        for lst in folder.lists:
            lst.space = folder.space
            lst_level = await resolve_list_permission(session, lst, user_id, role)
            if not level_at_least(lst_level, PermissionLevel.VIEW):
                continue
            lists.append(map_list_entry(lst, len(lst.tasks)))
            nested_list_ids.add(lst.id)
        data.append(
            {
                "type": "folder",
                "id": folder.id,
                "name": folder.name,
                "spaceId": folder.space_id,
                "spaceName": folder.space.name,
                "lists": lists,
            }
        )
    for row in list_rows:
        task_list = row.task_list
        if task_list.space_id in visible or task_list.id in nested_list_ids:
            continue
        data.append(
            {
                "type": "list",
                "id": task_list.id,
                "name": task_list.name,
                "spaceId": task_list.space_id,
                "spaceName": task_list.space.name,
            }
        )
    return {"data": data}


async def get_space(
    session: AsyncSession,
    workspace_id: str,
    space_id: str,
    user_id: str,
    role: WorkspaceRole,
) -> dict:
    space = await get_space_or_403(
        session, workspace_id, space_id, user_id, role, PermissionLevel.VIEW
    )
    space = await session.scalar(
        select(Space)
        .where(Space.id == space_id, Space.workspace_id == workspace_id)
        .options(*_SPACE_LOAD)
    )
    member_count = await _active_member_count(session, workspace_id)
    list_count = await _list_count_for_space(session, space.id)
    return await _build_space_payload(
        session, space, member_count, list_count, user_id, role
    )


def _task_filters(
    workspace_id: str, user_id: str, filter_name: str | None, search: str | None
):
    base = [Space.workspace_id == workspace_id, Task.parent_task_id.is_(None)]
    if search and search.strip():
        term = f"%{search.strip()}%"
        base.append(Task.name.ilike(term))
    if filter_name == "assigned":
        base.append(Task.assignee_ids.any(user_id))
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
    session: AsyncSession,
    workspace_id: str,
    list_id: str,
    user_id: str,
    role: WorkspaceRole,
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
    level = await resolve_list_permission(session, task_list, user_id, role)
    if not level_at_least(level, PermissionLevel.VIEW):
        raise AppError(403, "FORBIDDEN", "You don't have access to this List")
    statuses = await list_statuses_for_list(session, task_list.id)
    channel_id = await session.scalar(
        select(ChatChannel.id).where(
            ChatChannel.list_id == task_list.id,
            ChatChannel.is_list_primary.is_(True),
        )
    )
    await session.commit()
    # The user can see this List via an explicit List/Folder-level share
    # without having access to its parent Space at all - don't leak the
    # private Space's real name to them in that case.
    space_level = await resolve_space_permission(session, space, user_id, role)
    has_space_access = level_at_least(space_level, PermissionLevel.VIEW)
    return {
        "id": task_list.id,
        "name": task_list.name,
        "space": {
            "id": space.id,
            "name": space.name if has_space_access else "Shared with me",
            "color": space.color,
            "accessible": has_space_access,
        },
        "statuses": statuses,
        "hasOwnStatusConfig": task_list.status_config is not None,
        "channelId": channel_id,
        "canShare": is_workspace_admin(role),
        "canManageStructure": _can_manage_structure(level, role),
        "isPrivate": task_list.is_private,
    }


async def list_tasks_for_list(
    session: AsyncSession,
    workspace_id: str,
    user_id: str,
    role: WorkspaceRole,
    list_id: str,
) -> dict:
    task_list = await session.scalar(
        select(TaskList)
        .join(Space)
        .where(TaskList.id == list_id, Space.workspace_id == workspace_id)
        .options(selectinload(TaskList.space))
    )
    if not task_list:
        raise AppError(404, "NOT_FOUND", "List not found")
    await require_list_permission(
        session, task_list, user_id, role, PermissionLevel.VIEW
    )
    tasks = (
        await session.scalars(
            select(Task)
            .where(Task.list_id == list_id, Task.parent_task_id.is_(None))
            .options(*_TASK_LOAD)
            .order_by(Task.updated_at.desc())
        )
    ).all()
    names = await _assignee_name_map(session, list(tasks))
    return {"data": [map_task(t, user_id, names) for t in tasks]}


async def create_task(
    session: AsyncSession,
    workspace_id: str,
    user_id: str,
    role: WorkspaceRole,
    list_id: str,
    body: CreateTaskBody,
) -> dict:
    task_list = await session.scalar(
        select(TaskList)
        .join(Space)
        .where(TaskList.id == list_id, Space.workspace_id == workspace_id)
        .options(selectinload(TaskList.space))
    )
    if not task_list:
        raise AppError(404, "NOT_FOUND", "List not found")
    await require_list_permission(
        session, task_list, user_id, role, PermissionLevel.EDIT
    )
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
    actor_name = await _resolve_user_name(session, user_id)
    _record_task_activity(
        task,
        actor_name=actor_name,
        activity_kind="task_created",
        preview=f"{actor_name} created this task",
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


async def create_subtask(
    session: AsyncSession,
    workspace_id: str,
    user_id: str,
    role: WorkspaceRole,
    parent_task_id: str,
    body: CreateSubtaskBody,
) -> dict:
    parent = await session.scalar(
        select(Task)
        .join(Task.task_list)
        .join(TaskList.space)
        .where(Task.id == parent_task_id, Space.workspace_id == workspace_id)
        .options(selectinload(Task.task_list).selectinload(TaskList.space))
    )
    if not parent:
        raise AppError(404, "NOT_FOUND", "Task not found")
    await require_list_permission(
        session, parent.task_list, user_id, role, PermissionLevel.EDIT
    )
    if parent.parent_task_id:
        raise AppError(400, "VALIDATION_ERROR", "Nested subtasks are not supported")

    await ensure_list_statuses(session, parent.list_id)
    default_status = await default_status_for_list(session, parent.list_id)
    now = datetime.now(timezone.utc)
    task = Task(
        list_id=parent.list_id,
        parent_task_id=parent_task_id,
        name=body.name.strip(),
        updated_at=now,
        status_id=default_status.id if default_status else None,
        status_color=default_status.color if default_status else "#87909e",
    )
    actor_name = await _resolve_user_name(session, user_id)
    _record_task_activity(
        task,
        actor_name=actor_name,
        activity_kind="task_created",
        preview=f"{actor_name} created this task",
    )
    _record_task_activity(
        parent,
        actor_name=actor_name,
        activity_kind="task_subtask_created",
        preview=f"{actor_name} added subtask \"{task.name}\"",
    )
    session.add(task)
    await session.commit()
    refreshed = await session.scalar(
        select(Task).where(Task.id == task.id).options(*_TASK_LOAD)
    )
    mapped = map_subtask_summary(refreshed, user_id)
    await broadcast_task_event(
        workspace_id=workspace_id,
        action="created",
        task_id=refreshed.id,
        list_id=refreshed.list_id,
        task=map_task(refreshed, user_id),
    )
    return mapped


async def add_task_dependency(
    session: AsyncSession,
    workspace_id: str,
    user_id: str,
    role: WorkspaceRole,
    task_id: str,
    body: CreateTaskDependencyBody,
) -> dict:
    task = await _get_editable_task(session, workspace_id, user_id, role, task_id)

    if body.related_task_id == task_id:
        raise AppError(400, "VALIDATION_ERROR", "A task cannot depend on itself")

    related = await session.scalar(
        select(Task)
        .join(Task.task_list)
        .join(TaskList.space)
        .where(Task.id == body.related_task_id, Space.workspace_id == workspace_id)
        .options(
            selectinload(Task.task_list).selectinload(TaskList.space),
            selectinload(Task.list_status),
        )
    )
    if not related:
        raise AppError(404, "NOT_FOUND", "Related task not found")
    await require_list_permission(
        session, related.task_list, user_id, role, PermissionLevel.VIEW
    )

    dependency = TaskDependency(
        task_id=task_id, related_task_id=body.related_task_id, dependency_type=body.type
    )
    session.add(dependency)
    actor_name = await _resolve_user_name(session, user_id)
    relation_label = {
        "blocking": f"is now blocking \"{related.name}\"",
        "blocked_by": f"is now waiting on \"{related.name}\"",
        "linked": f"is now linked to \"{related.name}\"",
    }[body.type]
    _record_task_activity(
        task,
        actor_name=actor_name,
        activity_kind="task_dependency_added",
        preview=f"{actor_name} added a dependency: this task {relation_label}",
    )
    await session.commit()

    return {
        "id": dependency.id,
        "type": body.type,
        "task": map_subtask_summary(related, user_id),
    }


async def add_checklist(
    session: AsyncSession,
    workspace_id: str,
    user_id: str,
    role: WorkspaceRole,
    task_id: str,
    body: CreateChecklistBody,
) -> dict:
    task = await session.scalar(
        select(Task)
        .join(Task.task_list)
        .join(TaskList.space)
        .where(Task.id == task_id, Space.workspace_id == workspace_id)
        .options(selectinload(Task.task_list).selectinload(TaskList.space))
    )
    if not task:
        raise AppError(404, "NOT_FOUND", "Task not found")
    await require_list_permission(
        session, task.task_list, user_id, role, PermissionLevel.EDIT
    )

    max_position = await session.scalar(
        select(func.max(TaskChecklist.position)).where(TaskChecklist.task_id == task_id)
    )
    next_position = (max_position or -1) + 1

    checklist = TaskChecklist(
        task_id=task_id, name=body.name.strip(), position=next_position
    )
    session.add(checklist)
    actor_name = await _resolve_user_name(session, user_id)
    _record_task_activity(
        task,
        actor_name=actor_name,
        activity_kind="task_checklist_created",
        preview=f"{actor_name} added checklist \"{checklist.name}\"",
    )
    await session.commit()
    await session.refresh(checklist, attribute_names=["items"])

    return map_checklist(checklist)


async def update_checklist(
    session: AsyncSession,
    workspace_id: str,
    user_id: str,
    role: WorkspaceRole,
    task_id: str,
    checklist_id: str,
    body: UpdateChecklistBody,
) -> dict:
    task = await session.scalar(
        select(Task)
        .join(Task.task_list)
        .join(TaskList.space)
        .where(Task.id == task_id, Space.workspace_id == workspace_id)
        .options(selectinload(Task.task_list).selectinload(TaskList.space))
    )
    if not task:
        raise AppError(404, "NOT_FOUND", "Task not found")
    await require_list_permission(
        session, task.task_list, user_id, role, PermissionLevel.EDIT
    )

    checklist = await session.scalar(
        select(TaskChecklist).where(
            TaskChecklist.id == checklist_id, TaskChecklist.task_id == task_id
        )
    )
    if not checklist:
        raise AppError(404, "NOT_FOUND", "Checklist not found")

    if body.name is not None and body.name.strip() != checklist.name:
        old_name = checklist.name
        checklist.name = body.name.strip()
        actor_name = await _resolve_user_name(session, user_id)
        _record_task_activity(
            task,
            actor_name=actor_name,
            activity_kind="task_checklist_renamed",
            preview=f"{actor_name} renamed checklist \"{old_name}\" to \"{checklist.name}\"",
        )

    await session.commit()
    await session.refresh(checklist, attribute_names=["items"])
    return map_checklist(checklist)


async def delete_checklist(
    session: AsyncSession,
    workspace_id: str,
    user_id: str,
    role: WorkspaceRole,
    task_id: str,
    checklist_id: str,
) -> dict:
    task = await session.scalar(
        select(Task)
        .join(Task.task_list)
        .join(TaskList.space)
        .where(Task.id == task_id, Space.workspace_id == workspace_id)
        .options(selectinload(Task.task_list).selectinload(TaskList.space))
    )
    if not task:
        raise AppError(404, "NOT_FOUND", "Task not found")
    await require_list_permission(
        session, task.task_list, user_id, role, PermissionLevel.EDIT
    )

    checklist = await session.scalar(
        select(TaskChecklist).where(
            TaskChecklist.id == checklist_id, TaskChecklist.task_id == task_id
        )
    )
    if not checklist:
        raise AppError(404, "NOT_FOUND", "Checklist not found")
    actor_name = await _resolve_user_name(session, user_id)
    _record_task_activity(
        task,
        actor_name=actor_name,
        activity_kind="task_checklist_deleted",
        preview=f"{actor_name} deleted checklist \"{checklist.name}\"",
    )
    await session.delete(checklist)
    await session.commit()
    return {"ok": True}


async def _get_editable_task(
    session: AsyncSession, workspace_id: str, user_id: str, role: WorkspaceRole, task_id: str
) -> Task:
    task = await session.scalar(
        select(Task)
        .join(Task.task_list)
        .join(TaskList.space)
        .where(Task.id == task_id, Space.workspace_id == workspace_id)
        .options(selectinload(Task.task_list).selectinload(TaskList.space))
    )
    if not task:
        raise AppError(404, "NOT_FOUND", "Task not found")
    await require_list_permission(
        session, task.task_list, user_id, role, PermissionLevel.EDIT
    )
    return task


async def _validate_checklist_assignee(
    session: AsyncSession, workspace_id: str, assignee_id: str | None
) -> None:
    if not assignee_id:
        return
    members = await workspace_service.list_workspace_members(session, workspace_id)
    if assignee_id not in {m["id"] for m in members}:
        raise AppError(400, "VALIDATION_ERROR", "Invalid assignee")


async def add_checklist_item(
    session: AsyncSession,
    workspace_id: str,
    user_id: str,
    role: WorkspaceRole,
    task_id: str,
    checklist_id: str,
    body: CreateChecklistItemBody,
) -> dict:
    task = await _get_editable_task(session, workspace_id, user_id, role, task_id)
    checklist = await session.scalar(
        select(TaskChecklist).where(
            TaskChecklist.id == checklist_id, TaskChecklist.task_id == task_id
        )
    )
    if not checklist:
        raise AppError(404, "NOT_FOUND", "Checklist not found")
    await _validate_checklist_assignee(session, workspace_id, body.assignee_id)

    item = TaskChecklistItem(
        checklist_id=checklist_id,
        text=body.text.strip(),
        assignee_id=body.assignee_id,
        is_checked=body.is_checked,
    )
    session.add(item)
    actor_name = await _resolve_user_name(session, user_id)
    _record_task_activity(
        task,
        actor_name=actor_name,
        activity_kind="task_checklist_item_added",
        preview=f"{actor_name} added \"{item.text}\" to checklist \"{checklist.name}\"",
    )
    await session.commit()
    refreshed = await session.scalar(
        select(TaskChecklistItem)
        .where(TaskChecklistItem.id == item.id)
        .options(selectinload(TaskChecklistItem.assignee))
    )
    return map_checklist_item(refreshed)


async def update_checklist_item(
    session: AsyncSession,
    workspace_id: str,
    user_id: str,
    role: WorkspaceRole,
    task_id: str,
    checklist_id: str,
    item_id: str,
    body: UpdateChecklistItemBody,
) -> dict:
    task = await _get_editable_task(session, workspace_id, user_id, role, task_id)
    checklist = await session.scalar(
        select(TaskChecklist).where(
            TaskChecklist.id == checklist_id, TaskChecklist.task_id == task_id
        )
    )
    if not checklist:
        raise AppError(404, "NOT_FOUND", "Checklist not found")

    item = await session.scalar(
        select(TaskChecklistItem).where(
            TaskChecklistItem.id == item_id, TaskChecklistItem.checklist_id == checklist_id
        )
    )
    if not item:
        raise AppError(404, "NOT_FOUND", "Checklist item not found")

    actor_name = await _resolve_user_name(session, user_id)
    if "text" in body.model_fields_set and body.text is not None:
        new_text = body.text.strip()
        if new_text != item.text:
            _record_task_activity(
                task,
                actor_name=actor_name,
                activity_kind="task_checklist_item_renamed",
                preview=f"{actor_name} renamed checklist item \"{item.text}\" to \"{new_text}\"",
            )
            item.text = new_text
    if "is_checked" in body.model_fields_set and body.is_checked is not None:
        if body.is_checked != item.is_checked:
            item.is_checked = body.is_checked
            _record_task_activity(
                task,
                actor_name=actor_name,
                activity_kind=(
                    "task_checklist_item_checked"
                    if body.is_checked
                    else "task_checklist_item_unchecked"
                ),
                preview=(
                    f"{actor_name} checked \"{item.text}\""
                    if body.is_checked
                    else f"{actor_name} unchecked \"{item.text}\""
                ),
            )
    if "assignee_id" in body.model_fields_set:
        await _validate_checklist_assignee(session, workspace_id, body.assignee_id)
        item.assignee_id = body.assignee_id

    await session.commit()
    refreshed = await session.scalar(
        select(TaskChecklistItem)
        .where(TaskChecklistItem.id == item.id)
        .options(selectinload(TaskChecklistItem.assignee))
    )
    return map_checklist_item(refreshed)


async def delete_checklist_item(
    session: AsyncSession,
    workspace_id: str,
    user_id: str,
    role: WorkspaceRole,
    task_id: str,
    checklist_id: str,
    item_id: str,
) -> dict:
    task = await _get_editable_task(session, workspace_id, user_id, role, task_id)
    checklist = await session.scalar(
        select(TaskChecklist).where(
            TaskChecklist.id == checklist_id, TaskChecklist.task_id == task_id
        )
    )
    if not checklist:
        raise AppError(404, "NOT_FOUND", "Checklist not found")

    item = await session.scalar(
        select(TaskChecklistItem).where(
            TaskChecklistItem.id == item_id, TaskChecklistItem.checklist_id == checklist_id
        )
    )
    if not item:
        raise AppError(404, "NOT_FOUND", "Checklist item not found")
    actor_name = await _resolve_user_name(session, user_id)
    _record_task_activity(
        task,
        actor_name=actor_name,
        activity_kind="task_checklist_item_deleted",
        preview=f"{actor_name} deleted \"{item.text}\" from checklist \"{checklist.name}\"",
    )
    await session.delete(item)
    await session.commit()
    return {"ok": True}


async def list_tasks(
    session: AsyncSession,
    workspace_id: str,
    user_id: str,
    role: WorkspaceRole,
    filter_name: str | None,
    search: str | None = None,
) -> dict:
    if filter_name == "personal":
        await ensure_personal_space(session, workspace_id)
        await session.commit()
    visible = await visible_space_ids(session, workspace_id, user_id, role)
    filters = _task_filters(workspace_id, user_id, filter_name, search)
    if visible is not None:
        filters.append(Space.id.in_(visible))
    tasks = (
        await session.scalars(
            select(Task)
            .join(Task.task_list)
            .join(TaskList.space)
            .where(*filters)
            .options(*_TASK_LOAD)
            .order_by(Task.updated_at.desc())
        )
    ).all()
    names = await _assignee_name_map(session, list(tasks))
    return {"data": [map_task(t, user_id, names) for t in tasks]}


async def get_task(
    session: AsyncSession,
    workspace_id: str,
    user_id: str,
    role: WorkspaceRole,
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
    await require_list_permission(
        session, task.task_list, user_id, role, PermissionLevel.VIEW
    )
    names = await _assignee_name_map(session, task)
    payload = map_task(task, user_id, names)
    payload["inLineup"] = await is_task_in_lineup(
        session, workspace_id, user_id, task_id
    )
    payload["isFollowing"] = await is_task_followed_by(
        session, task_id, user_id
    )
    subtasks = (
        await session.scalars(
            select(Task)
            .where(Task.parent_task_id == task_id)
            .options(*_TASK_LOAD)
            .order_by(Task.created_at.asc())
        )
    ).all()
    payload["subtasks"] = [map_subtask_summary(st, user_id) for st in subtasks]

    from app.services.task_attachment_service import map_task_attachment

    attachments = (
        await session.scalars(
            select(TaskAttachment)
            .where(
                TaskAttachment.task_id == task_id,
                TaskAttachment.workspace_id == workspace_id,
                TaskAttachment.status == "ready",
                TaskAttachment.comment_id.is_(None),
            )
            .order_by(TaskAttachment.created_at.asc())
        )
    ).all()
    payload["attachments"] = [map_task_attachment(a) for a in attachments]

    from app.services.task_time_service import get_task_time_state

    payload.update(await get_task_time_state(session, workspace_id, user_id, task_id))
    return payload


async def update_task(
    session: AsyncSession,
    workspace_id: str,
    user_id: str,
    role: WorkspaceRole,
    task_id: str,
    body: UpdateTaskBody,
) -> dict:
    task = await _get_editable_task(session, workspace_id, user_id, role, task_id)
    original_name = task.name
    original_description = task.description
    original_status_id = task.status_id
    original_status = task.status
    original_status_row = (
        await session.scalar(select(ListStatus).where(ListStatus.id == original_status_id))
        if original_status_id
        else None
    )
    original_status_label = _status_label(original_status, original_status_row)
    original_priority = task.priority
    original_due_date = task.due_date
    original_start_date = task.start_date
    original_time_estimate_minutes = task.time_estimate_minutes
    original_list_id = task.list_id
    original_list_name = task.task_list.name

    old_assignee_ids: set[str] = set(task.assignee_ids) if body.assignee_ids is not None else set()
    old_follower_ids: set[str] = set(task.follower_ids)
    auto_followed_via_assignment: set[str] = set()

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

    if body.start_date is not None:
        if body.start_date.strip() == "":
            task.start_date = None
        else:
            raw = body.start_date.replace("Z", "+00:00")
            parsed = datetime.fromisoformat(raw)
            task.start_date = (
                parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)
            )

    if task.start_date and task.due_date:
        # DB-loaded datetimes can come back tz-naive (asyncpg quirk on
        # timestamptz columns) while freshly-parsed ones above are always
        # forced aware - both already represent UTC instants, so strip
        # tzinfo before comparing rather than mixing aware/naive.
        start_cmp = task.start_date.replace(tzinfo=None)
        due_cmp = task.due_date.replace(tzinfo=None)
        if start_cmp > due_cmp:
            raise AppError(
                400, "VALIDATION_ERROR", "Start date must be on or before the due date"
            )

    if "time_estimate_minutes" in body.model_fields_set:
        can_see_estimate, _ = await get_member_time_flags(session, workspace_id, user_id)
        if not can_see_estimate:
            raise AppError(
                403, "FORBIDDEN", "Time estimates are disabled for your account"
            )
        task.time_estimate_minutes = body.time_estimate_minutes
    if body.assignee_ids is not None:
        members = await workspace_service.list_workspace_members(
            session, workspace_id
        )
        allowed = {m["id"] for m in members}
        for uid in body.assignee_ids:
            if uid not in allowed:
                raise AppError(400, "VALIDATION_ERROR", "Invalid assignee")
        task.assignee_ids = list(dict.fromkeys(body.assignee_ids))

    if body.follower_ids is not None:
        members = await workspace_service.list_workspace_members(
            session, workspace_id
        )
        allowed = {m["id"] for m in members}
        for uid in body.follower_ids:
            if uid not in allowed:
                raise AppError(400, "VALIDATION_ERROR", "Invalid follower")
        task.follower_ids = list(dict.fromkeys(body.follower_ids))

    if body.assignee_ids is not None:
        # Assigning someone auto-follows them, same as real ClickUp - keeps
        # this after the follower_ids block so it wins even when both
        # fields are patched in the same request. Tracked separately so the
        # activity log below only records "assigned", not a second
        # "added follower" entry for the same action.
        newly_followed = [uid for uid in task.assignee_ids if uid not in task.follower_ids]
        if newly_followed:
            task.follower_ids = [*task.follower_ids, *newly_followed]
            auto_followed_via_assignment.update(newly_followed)

    if "priority" in body.model_fields_set:
        task.priority = (
            TaskPriority(body.priority.upper()) if body.priority else None
        )

    moved_to_list_name: str | None = None
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
        moved_to_list_name = target_list.name
        # task.task_list was eager-loaded above for the permission check;
        # SQLAlchemy won't refresh an already-populated relationship on the
        # later re-select, so map_task's `task.task_list.id` would keep
        # pointing at the old list unless we expire it here.
        session.expire(task, ["task_list"])

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
    names = await _assignee_name_map(session, refreshed)
    mapped = map_task(refreshed, user_id, names)

    actor_name = await _resolve_user_name(session, user_id)
    logged_activity = False
    # Assignees and followers get an Inbox (and, if enabled, desktop)
    # notification for the field changes below - resolved once up front and
    # reused across all of them rather than re-querying per field.
    field_change_recipients = await task_notification_recipients(
        session, task_id=task_id, exclude_user_id=user_id
    )
    field_change_notifications: list = []
    if task.status_id != original_status_id or task.status != original_status:
        new_status_label = _status_label(refreshed.status, refreshed.list_status)
        status_change_preview = (
            f"{actor_name} changed status from {original_status_label} to {new_status_label}"
        )
        _record_task_activity(
            refreshed,
            actor_name=actor_name,
            activity_kind="task_status_changed",
            preview=status_change_preview,
        )
        logged_activity = True
        field_change_notifications += await create_task_activity_notifications(
            session,
            workspace_id=workspace_id,
            actor_user_id=user_id,
            task_name=task.name,
            task_id=task_id,
            recipient_ids=field_change_recipients,
            title=f"Status changed: {task.name}",
            preview_template=status_change_preview,
            activity_kind="task_status_changed",
        )
    if task.name != original_name:
        _record_task_activity(
            refreshed,
            actor_name=actor_name,
            activity_kind="task_renamed",
            preview=f'{actor_name} renamed "{original_name}" to "{task.name}"',
        )
        logged_activity = True
    if task.description != original_description:
        _record_task_activity(
            refreshed,
            actor_name=actor_name,
            activity_kind="task_description_changed",
            preview=f"{actor_name} updated the description",
        )
        logged_activity = True
    if task.priority != original_priority:
        old_priority_label = _priority_label(original_priority)
        new_priority_label = _priority_label(task.priority)
        if original_priority is None:
            preview = f"{actor_name} set priority to {new_priority_label}"
        elif task.priority is None:
            preview = f"{actor_name} removed priority (was {old_priority_label})"
        else:
            preview = f"{actor_name} changed priority from {old_priority_label} to {new_priority_label}"
        _record_task_activity(
            refreshed,
            actor_name=actor_name,
            activity_kind="task_priority_changed",
            preview=preview,
        )
        logged_activity = True
        field_change_notifications += await create_task_activity_notifications(
            session,
            workspace_id=workspace_id,
            actor_user_id=user_id,
            task_name=task.name,
            task_id=task_id,
            recipient_ids=field_change_recipients,
            title=f"Priority changed: {task.name}",
            preview_template=preview,
            activity_kind="task_priority_changed",
        )
    if task.due_date != original_due_date:
        old_due_label = format_due_date(original_due_date) or "no due date"
        new_due_label = format_due_date(task.due_date) or "no due date"
        if original_due_date is None:
            preview = f"{actor_name} set due date to {new_due_label}"
        elif task.due_date is None:
            preview = f"{actor_name} removed the due date"
        else:
            preview = f"{actor_name} changed due date from {old_due_label} to {new_due_label}"
        _record_task_activity(
            refreshed,
            actor_name=actor_name,
            activity_kind="task_due_date_changed",
            preview=preview,
        )
        logged_activity = True
        field_change_notifications += await create_task_activity_notifications(
            session,
            workspace_id=workspace_id,
            actor_user_id=user_id,
            task_name=task.name,
            task_id=task_id,
            recipient_ids=field_change_recipients,
            title=f"Due date changed: {task.name}",
            preview_template=preview,
            activity_kind="task_due_date_changed",
        )
    if task.start_date != original_start_date:
        old_start_label = format_due_date(original_start_date) or "no start date"
        new_start_label = format_due_date(task.start_date) or "no start date"
        if original_start_date is None:
            preview = f"{actor_name} set start date to {new_start_label}"
        elif task.start_date is None:
            preview = f"{actor_name} removed the start date"
        else:
            preview = f"{actor_name} changed start date from {old_start_label} to {new_start_label}"
        _record_task_activity(
            refreshed,
            actor_name=actor_name,
            activity_kind="task_start_date_changed",
            preview=preview,
        )
        logged_activity = True
        field_change_notifications += await create_task_activity_notifications(
            session,
            workspace_id=workspace_id,
            actor_user_id=user_id,
            task_name=task.name,
            task_id=task_id,
            recipient_ids=field_change_recipients,
            title=f"Start date changed: {task.name}",
            preview_template=preview,
            activity_kind="task_start_date_changed",
        )
    if task.time_estimate_minutes != original_time_estimate_minutes:
        old_estimate_label = _time_estimate_label(original_time_estimate_minutes)
        new_estimate_label = _time_estimate_label(task.time_estimate_minutes)
        if original_time_estimate_minutes is None:
            estimate_preview = f"{actor_name} set time estimate to {new_estimate_label}"
        elif task.time_estimate_minutes is None:
            estimate_preview = f"{actor_name} removed the time estimate (was {old_estimate_label})"
        else:
            estimate_preview = (
                f"{actor_name} changed time estimate from {old_estimate_label} to {new_estimate_label}"
            )
        _record_task_activity(
            refreshed,
            actor_name=actor_name,
            activity_kind="task_time_estimate_changed",
            preview=estimate_preview,
        )
        logged_activity = True
        field_change_notifications += await create_task_activity_notifications(
            session,
            workspace_id=workspace_id,
            actor_user_id=user_id,
            task_name=task.name,
            task_id=task_id,
            recipient_ids=field_change_recipients,
            title=f"Time estimate changed: {task.name}",
            preview_template=estimate_preview,
            activity_kind="task_time_estimate_changed",
        )
    if task.list_id != original_list_id and moved_to_list_name:
        _record_task_activity(
            refreshed,
            actor_name=actor_name,
            activity_kind="task_list_changed",
            preview=f'{actor_name} moved this task from "{original_list_name}" to "{moved_to_list_name}"',
        )
        logged_activity = True
    if body.assignee_ids is not None:
        new_assignee_ids = set(refreshed.assignee_ids)
        added_assignees = new_assignee_ids - old_assignee_ids
        removed_assignees = old_assignee_ids - new_assignee_ids
        assignee_names = await _user_name_map(
            session, added_assignees | removed_assignees
        )
        for uid in added_assignees:
            assignee_added_preview = (
                f"{actor_name} added assignee {assignee_names.get(uid, 'Someone')}"
            )
            _record_task_activity(
                refreshed,
                actor_name=actor_name,
                activity_kind="task_assignee_added",
                preview=assignee_added_preview,
            )
            logged_activity = True
            field_change_notifications += await create_task_activity_notifications(
                session,
                workspace_id=workspace_id,
                actor_user_id=user_id,
                task_name=task.name,
                task_id=task_id,
                recipient_ids=field_change_recipients,
                title=f"Assignee added: {task.name}",
                preview_template=assignee_added_preview,
                activity_kind="task_assignee_added",
            )
        for uid in removed_assignees:
            assignee_removed_preview = (
                f"{actor_name} removed assignee {assignee_names.get(uid, 'Someone')}"
            )
            _record_task_activity(
                refreshed,
                actor_name=actor_name,
                activity_kind="task_assignee_removed",
                preview=assignee_removed_preview,
            )
            logged_activity = True
            field_change_notifications += await create_task_activity_notifications(
                session,
                workspace_id=workspace_id,
                actor_user_id=user_id,
                task_name=task.name,
                task_id=task_id,
                recipient_ids=field_change_recipients,
                title=f"Assignee removed: {task.name}",
                preview_template=assignee_removed_preview,
                activity_kind="task_assignee_removed",
            )
    new_follower_ids = set(refreshed.follower_ids)
    added_followers = new_follower_ids - old_follower_ids - auto_followed_via_assignment
    removed_followers = old_follower_ids - new_follower_ids
    if added_followers or removed_followers:
        follower_names = await _user_name_map(
            session, added_followers | removed_followers
        )
        for uid in added_followers:
            _record_task_activity(
                refreshed,
                actor_name=actor_name,
                activity_kind="task_followed",
                preview=f"{actor_name} added follower: {follower_names.get(uid, 'Someone')}",
            )
            logged_activity = True
        for uid in removed_followers:
            _record_task_activity(
                refreshed,
                actor_name=actor_name,
                activity_kind="task_unfollowed",
                preview=f"{actor_name} removed follower: {follower_names.get(uid, 'Someone')}",
            )
            logged_activity = True
    if logged_activity:
        await session.commit()

    if assignment_notifications:
        await emit_home_notifications(
            session, workspace_id, assignment_notifications
        )
    if field_change_notifications:
        await emit_home_notifications(
            session, workspace_id, field_change_notifications
        )
    await broadcast_task_event(
        workspace_id=workspace_id,
        action="updated",
        task_id=task_id,
        list_id=refreshed.list_id,
        task=mapped,
    )
    from app.services.task_time_service import get_task_time_state

    mapped.update(
        await get_task_time_state(session, workspace_id, user_id, task_id)
    )
    return mapped


async def delete_task(
    session: AsyncSession,
    workspace_id: str,
    user_id: str,
    role: WorkspaceRole,
    task_id: str,
) -> dict:
    task = await session.scalar(
        select(Task)
        .join(Task.task_list)
        .join(TaskList.space)
        .where(Task.id == task_id, Space.workspace_id == workspace_id)
        .options(selectinload(Task.task_list).selectinload(TaskList.space))
    )
    if not task:
        raise AppError(404, "NOT_FOUND", "Task not found")
    await require_list_permission(
        session, task.task_list, user_id, role, PermissionLevel.EDIT
    )
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
                "createdAt": as_aware_utc(p.created_at).isoformat(),
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
        "createdAt": as_aware_utc(loaded.created_at).isoformat(),
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
    names = await _assignee_name_map(session, list(rows))
    return {"data": [map_task(t, user_id, names) for t in rows]}


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
    ids = await session.scalar(select(Task.follower_ids).where(Task.id == task_id))
    return user_id in (ids or [])


async def follow_task(
    session: AsyncSession,
    workspace_id: str,
    user_id: str,
    task_id: str,
) -> dict:
    task = await _get_workspace_task(session, workspace_id, task_id)
    if user_id not in task.follower_ids:
        task.follower_ids = [*task.follower_ids, user_id]
        await session.commit()
    return {"ok": True, "following": True}


async def unfollow_task(
    session: AsyncSession,
    workspace_id: str,
    user_id: str,
    task_id: str,
) -> dict:
    task = await _get_workspace_task(session, workspace_id, task_id)
    if user_id in task.follower_ids:
        task.follower_ids = [uid for uid in task.follower_ids if uid != user_id]
        await session.commit()
    return {"ok": True, "following": False}


async def list_task_activity(
    session: AsyncSession,
    workspace_id: str,
    user_id: str,
    task_id: str,
    limit: int = 50,
) -> dict:
    # Task.activity is a shared, append-only JSONB log (every viewer sees the
    # same full history, including their own actions) - unlike InboxItem,
    # which is a per-user notification inbox and never records the actor's
    # own actions. See scripts/migrate_task_activity_log.sql.
    task = await _get_workspace_task(session, workspace_id, task_id)
    href = f"/home/tasks/{task_id}"
    entries = list(task.activity or [])
    entries.sort(key=lambda e: e.get("createdAt") or "", reverse=True)
    return {
        "data": [
            {
                "id": entry.get("id"),
                "type": entry.get("type", "activity"),
                "title": entry.get("title"),
                "preview": entry.get("preview"),
                "source": entry.get("source"),
                "href": href,
                "createdAt": entry.get("createdAt"),
                "activityKind": entry.get("activityKind"),
            }
            for entry in entries[:limit]
        ]
    }


async def list_task_notifications(
    session: AsyncSession,
    workspace_id: str,
    user_id: str,
    task_id: str,
    limit: int = 50,
) -> dict:
    await _get_workspace_task(session, workspace_id, task_id)
    href = f"/home/tasks/{task_id}"
    rows = (
        await session.scalars(
            select(InboxItem)
            .where(
                InboxItem.workspace_id == workspace_id,
                InboxItem.user_id == user_id,
                InboxItem.href == href,
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
            InboxItem.href == href,
            InboxItem.unread.is_(True),
        )
    )
    return {
        "unreadCount": int(unread_count or 0),
        "data": [
            {
                "id": row.id,
                "type": map_inbox_type(row.type),
                "title": row.title,
                "preview": row.preview,
                "source": row.source,
                "createdAt": as_aware_utc(row.created_at).isoformat(),
                "unread": row.unread,
                "href": row.href,
                "activityKind": row.activity_kind,
            }
            for row in rows
        ],
    }


async def mark_task_notifications_read(
    session: AsyncSession, workspace_id: str, user_id: str, task_id: str
) -> dict:
    await _get_workspace_task(session, workspace_id, task_id)
    href = f"/home/tasks/{task_id}"
    result = await session.execute(
        update(InboxItem)
        .where(
            InboxItem.workspace_id == workspace_id,
            InboxItem.user_id == user_id,
            InboxItem.href == href,
            InboxItem.unread.is_(True),
        )
        .values(unread=False)
    )
    await session.commit()
    return {"updated": int(result.rowcount or 0)}


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
                inbox_visible_clause(),
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
            inbox_visible_clause(),
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
                "createdAt": as_aware_utc(item.created_at).isoformat(),
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
