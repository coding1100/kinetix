import asyncio

from sqlalchemy import delete, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from datetime import datetime, timezone

from app.core.errors import AppError
from app.db.models.chat import ChatChannel
from app.db.models.enums import PermissionLevel, WorkspaceRole
from app.db.models.home import (
    Folder,
    FolderMember,
    ListMember,
    Space,
    SpaceMember,
    Task,
    TaskAttachment,
    TaskComment,
    TaskList,
)
from app.db.models.workspace import WorkspaceMember
from app.db.models.enums import MemberStatus
from app.schemas.spaces import (
    CreateFolderBody,
    CreateListBody,
    CreateSpaceBody,
    CreateTaskCommentBody,
    ShareMemberBody,
    UpdateFolderBody,
    UpdateListBody,
    UpdateSpaceBody,
    UpdateTaskCommentBody,
)
from app.services.home_service import (
    _SPACE_LOAD,
    _TASK_LOAD,
    _active_member_count,
    _assignee_name_map,
    _build_space_payload,
    _list_count_for_space,
)
from app.services.chat_service import (
    create_list_channel,
    sync_list_channel_members_for_space,
)
from app.services.home_helpers import map_list_entry, map_task
from app.services.list_status_service import ensure_list_statuses
from app.services.notification_service import (
    create_resource_share_notification,
    create_task_comment_mention_notifications,
    create_task_comment_notifications,
    create_task_comment_reply_notifications,
    emit_home_notifications,
)
from app.services.space_permissions import (
    DEFAULT_LEVEL_BY_ROLE,
    get_space_or_403,
    level_at_least,
    require_space_permission,
)
from app.services.folder_list_permissions import (
    require_folder_permission,
    require_list_permission,
    resolve_share_target,
)
from app.socket.emit import broadcast_channel_renamed


def _member_row_payload(row: SpaceMember | FolderMember | ListMember) -> dict:
    return {
        "userId": row.user_id,
        "name": row.user.full_name if row.user else None,
        "email": row.user.email if row.user else row.email,
        "permissionLevel": row.permission_level.value,
        "status": row.status.value,
    }


def _require_can_create_space(role: WorkspaceRole) -> None:
    if not level_at_least(DEFAULT_LEVEL_BY_ROLE.get(role), PermissionLevel.EDIT) and role not in (
        WorkspaceRole.OWNER,
        WorkspaceRole.SUPER_ADMIN,
    ):
        raise AppError(403, "FORBIDDEN", "You don't have permission to create a Space")


async def _folder_with_space(
    session: AsyncSession, workspace_id: str, folder_id: str
) -> Folder:
    folder = await session.scalar(
        select(Folder)
        .join(Space)
        .where(Folder.id == folder_id, Space.workspace_id == workspace_id)
        .options(selectinload(Folder.space))
    )
    if not folder:
        raise AppError(404, "NOT_FOUND", "Folder not found")
    return folder


async def _list_with_space(
    session: AsyncSession, workspace_id: str, list_id: str
) -> TaskList:
    task_list = await session.scalar(
        select(TaskList)
        .join(Space)
        .where(TaskList.id == list_id, Space.workspace_id == workspace_id)
        .options(selectinload(TaskList.space))
    )
    if not task_list:
        raise AppError(404, "NOT_FOUND", "List not found")
    return task_list


async def _task_with_space(
    session: AsyncSession, workspace_id: str, task_id: str
) -> Task:
    task = await session.scalar(
        select(Task)
        .join(TaskList)
        .join(Space)
        .where(Task.id == task_id, Space.workspace_id == workspace_id)
        .options(selectinload(Task.task_list).selectinload(TaskList.space))
    )
    if not task:
        raise AppError(404, "NOT_FOUND", "Task not found")
    return task


async def create_space(
    session: AsyncSession,
    workspace_id: str,
    user_id: str,
    role: WorkspaceRole,
    body: CreateSpaceBody,
) -> dict:
    _require_can_create_space(role)
    space = Space(
        workspace_id=workspace_id,
        name=body.name.strip(),
        color=body.color or "#7B68EE",
        description=body.description,
        is_private=body.is_private,
    )
    session.add(space)
    await session.flush()
    if body.is_private:
        # Creator always keeps explicit EDIT on their own private Space.
        session.add(
            SpaceMember(
                space_id=space.id,
                user_id=user_id,
                permission_level=PermissionLevel.EDIT,
            )
        )
    await session.commit()
    refreshed = await session.scalar(
        select(Space).where(Space.id == space.id).options(*_SPACE_LOAD)
    )
    member_count = await _active_member_count(session, workspace_id)
    return await _build_space_payload(
        session, refreshed, member_count, 0, user_id, role
    )


async def update_space(
    session: AsyncSession,
    workspace_id: str,
    space_id: str,
    user_id: str,
    role: WorkspaceRole,
    body: UpdateSpaceBody,
) -> dict:
    space = await get_space_or_403(
        session, workspace_id, space_id, user_id, role, PermissionLevel.EDIT
    )
    if body.name is not None:
        space.name = body.name.strip()
    if body.color is not None:
        space.color = body.color
    if body.description is not None:
        space.description = body.description or None
    if body.is_private is not None:
        space.is_private = body.is_private
    await session.commit()
    refreshed = await session.scalar(
        select(Space)
        .where(Space.id == space_id)
        .options(*_SPACE_LOAD)
    )
    member_count = await _active_member_count(session, workspace_id)
    list_count = await _list_count_for_space(session, space_id)
    return await _build_space_payload(
        session, refreshed, member_count, list_count, user_id, role
    )


async def delete_space(
    session: AsyncSession,
    workspace_id: str,
    space_id: str,
    user_id: str,
    role: WorkspaceRole,
) -> dict:
    space = await get_space_or_403(
        session, workspace_id, space_id, user_id, role, PermissionLevel.EDIT
    )
    if space.is_personal:
        raise AppError(400, "VALIDATION_ERROR", "Cannot delete the Personal space")
    await session.delete(space)
    await session.commit()
    return {"ok": True}


async def list_space_members(
    session: AsyncSession,
    workspace_id: str,
    space_id: str,
    user_id: str,
    role: WorkspaceRole,
) -> dict:
    space = await get_space_or_403(
        session, workspace_id, space_id, user_id, role, PermissionLevel.VIEW
    )
    rows = (
        await session.scalars(
            select(SpaceMember)
            .where(SpaceMember.space_id == space.id)
            .options(selectinload(SpaceMember.user))
        )
    ).all()
    return {
        "isPrivate": space.is_private,
        "data": [_member_row_payload(row) for row in rows],
    }


async def add_space_member(
    session: AsyncSession,
    workspace_id: str,
    space_id: str,
    user_id: str,
    role: WorkspaceRole,
    body: ShareMemberBody,
) -> dict:
    space = await get_space_or_403(
        session, workspace_id, space_id, user_id, role, PermissionLevel.EDIT
    )
    target_user_id, target_email, status = await resolve_share_target(
        session, workspace_id, body.user_id, body.email
    )

    existing = await session.scalar(
        select(SpaceMember).where(
            SpaceMember.space_id == space.id,
            SpaceMember.user_id == target_user_id
            if target_user_id
            else SpaceMember.email == target_email,
        )
    )
    if existing:
        existing.permission_level = body.permission_level
        existing.status = status
    else:
        session.add(
            SpaceMember(
                space_id=space.id,
                user_id=target_user_id,
                email=target_email,
                status=status,
                permission_level=body.permission_level,
            )
        )
    await session.commit()
    await sync_list_channel_members_for_space(session, workspace_id, space)
    if target_user_id and status == MemberStatus.ACTIVE:
        notifications = await create_resource_share_notification(
            session,
            workspace_id=workspace_id,
            recipient_id=target_user_id,
            actor_user_id=user_id,
            resource_type="space",
            resource_name=space.name,
            href=f"/home/spaces/{space.id}",
        )
        await session.commit()
        if notifications:
            await emit_home_notifications(session, workspace_id, notifications)
    return await list_space_members(session, workspace_id, space_id, user_id, role)


async def remove_space_member(
    session: AsyncSession,
    workspace_id: str,
    space_id: str,
    target: str,
    user_id: str,
    role: WorkspaceRole,
) -> dict:
    space = await get_space_or_403(
        session, workspace_id, space_id, user_id, role, PermissionLevel.EDIT
    )
    await session.execute(
        delete(SpaceMember).where(
            SpaceMember.space_id == space.id,
            (SpaceMember.user_id == target)
            | ((SpaceMember.user_id.is_(None)) & (SpaceMember.email == target)),
        )
    )
    await session.commit()
    await sync_list_channel_members_for_space(session, workspace_id, space)
    return {"ok": True}


async def create_folder(
    session: AsyncSession,
    workspace_id: str,
    space_id: str,
    user_id: str,
    role: WorkspaceRole,
    body: CreateFolderBody,
) -> dict:
    space = await get_space_or_403(
        session, workspace_id, space_id, user_id, role, PermissionLevel.EDIT
    )
    max_order = await session.scalar(
        select(func.max(Folder.sort_order)).where(Folder.space_id == space_id)
    )
    folder = Folder(
        space_id=space.id,
        name=body.name.strip(),
        sort_order=int(max_order or 0) + 1,
    )
    session.add(folder)
    await session.commit()
    return {"id": folder.id, "name": folder.name, "lists": [], "canShare": True}


async def update_folder(
    session: AsyncSession,
    workspace_id: str,
    folder_id: str,
    user_id: str,
    role: WorkspaceRole,
    body: UpdateFolderBody,
) -> dict:
    folder = await _folder_with_space(session, workspace_id, folder_id)
    await require_folder_permission(
        session, folder, user_id, role, PermissionLevel.EDIT
    )
    if body.name is not None:
        folder.name = body.name.strip()
    await session.commit()
    return {"id": folder.id, "name": folder.name, "canShare": True}


async def delete_folder(
    session: AsyncSession,
    workspace_id: str,
    folder_id: str,
    user_id: str,
    role: WorkspaceRole,
) -> dict:
    folder = await _folder_with_space(session, workspace_id, folder_id)
    await require_folder_permission(
        session, folder, user_id, role, PermissionLevel.EDIT
    )
    await session.delete(folder)
    await session.commit()
    return {"ok": True}


async def list_folder_members(
    session: AsyncSession,
    workspace_id: str,
    folder_id: str,
    user_id: str,
    role: WorkspaceRole,
) -> dict:
    folder = await _folder_with_space(session, workspace_id, folder_id)
    await require_folder_permission(
        session, folder, user_id, role, PermissionLevel.VIEW
    )
    rows = (
        await session.scalars(
            select(FolderMember)
            .where(FolderMember.folder_id == folder.id)
            .options(selectinload(FolderMember.user))
        )
    ).all()
    return {"data": [_member_row_payload(row) for row in rows]}


async def add_folder_member(
    session: AsyncSession,
    workspace_id: str,
    folder_id: str,
    user_id: str,
    role: WorkspaceRole,
    body: ShareMemberBody,
) -> dict:
    folder = await _folder_with_space(session, workspace_id, folder_id)
    await require_folder_permission(
        session, folder, user_id, role, PermissionLevel.EDIT
    )
    target_user_id, target_email, status = await resolve_share_target(
        session, workspace_id, body.user_id, body.email
    )

    existing = await session.scalar(
        select(FolderMember).where(
            FolderMember.folder_id == folder.id,
            FolderMember.user_id == target_user_id
            if target_user_id
            else FolderMember.email == target_email,
        )
    )
    if existing:
        existing.permission_level = body.permission_level
        existing.status = status
    else:
        session.add(
            FolderMember(
                folder_id=folder.id,
                user_id=target_user_id,
                email=target_email,
                status=status,
                permission_level=body.permission_level,
            )
        )
    await session.commit()
    await sync_list_channel_members_for_space(session, workspace_id, folder.space)
    if target_user_id and status == MemberStatus.ACTIVE:
        notifications = await create_resource_share_notification(
            session,
            workspace_id=workspace_id,
            recipient_id=target_user_id,
            actor_user_id=user_id,
            resource_type="folder",
            resource_name=folder.name,
            href="/home",
        )
        await session.commit()
        if notifications:
            await emit_home_notifications(session, workspace_id, notifications)
    return await list_folder_members(session, workspace_id, folder_id, user_id, role)


async def remove_folder_member(
    session: AsyncSession,
    workspace_id: str,
    folder_id: str,
    target: str,
    user_id: str,
    role: WorkspaceRole,
) -> dict:
    folder = await _folder_with_space(session, workspace_id, folder_id)
    await require_folder_permission(
        session, folder, user_id, role, PermissionLevel.EDIT
    )
    await session.execute(
        delete(FolderMember).where(
            FolderMember.folder_id == folder.id,
            (FolderMember.user_id == target)
            | ((FolderMember.user_id.is_(None)) & (FolderMember.email == target)),
        )
    )
    await session.commit()
    await sync_list_channel_members_for_space(session, workspace_id, folder.space)
    return {"ok": True}


async def create_list(
    session: AsyncSession,
    workspace_id: str,
    space_id: str,
    user_id: str,
    role: WorkspaceRole,
    body: CreateListBody,
) -> dict:
    space = await get_space_or_403(
        session, workspace_id, space_id, user_id, role, PermissionLevel.VIEW
    )
    folder_id = body.folder_id
    if folder_id:
        folder = await session.scalar(
            select(Folder)
            .where(Folder.id == folder_id, Folder.space_id == space_id)
            .options(selectinload(Folder.space))
        )
        if not folder:
            raise AppError(404, "NOT_FOUND", "Folder not found")
        await require_folder_permission(
            session, folder, user_id, role, PermissionLevel.EDIT
        )
    else:
        await require_space_permission(
            session, space, user_id, role, PermissionLevel.EDIT
        )
    max_order = await session.scalar(
        select(func.max(TaskList.sort_order)).where(TaskList.space_id == space_id)
    )
    task_list = TaskList(
        space_id=space.id,
        folder_id=folder_id,
        name=body.name.strip(),
        sort_order=int(max_order or 0) + 1,
    )
    session.add(task_list)
    await session.flush()
    await ensure_list_statuses(session, task_list.id)
    await session.commit()
    # Every list is mandatory 1:1 with its own chat channel - see
    # chat_service.create_list_channel.
    await create_list_channel(session, workspace_id, task_list, space, user_id)
    return map_list_entry(task_list, 0, can_share=True)


async def update_list(
    session: AsyncSession,
    workspace_id: str,
    list_id: str,
    user_id: str,
    role: WorkspaceRole,
    body: UpdateListBody,
) -> dict:
    task_list = await _list_with_space(session, workspace_id, list_id)
    await require_list_permission(
        session, task_list, user_id, role, PermissionLevel.EDIT
    )
    renamed = False
    if body.name is not None:
        task_list.name = body.name.strip()
        renamed = True
    await session.commit()

    if renamed:
        # List name is the source of truth for its primary channel's name
        # (two-way sync - the reverse direction lives in
        # chat_service.update_channel). Best-effort: a list rename should
        # never fail just because the channel side hit a name conflict.
        channel = await session.scalar(
            select(ChatChannel).where(
                ChatChannel.list_id == list_id,
                ChatChannel.is_list_primary.is_(True),
            )
        )
        if channel and channel.name != task_list.name:
            name = task_list.name
            if await session.scalar(
                select(ChatChannel).where(
                    ChatChannel.workspace_id == workspace_id,
                    ChatChannel.name == name,
                    ChatChannel.id != channel.id,
                )
            ):
                name = f"{name}-{list_id[:6]}"
            channel.name = name
            await session.commit()
            asyncio.create_task(
                broadcast_channel_renamed(
                    workspace_id=workspace_id, channel_id=channel.id, name=name
                )
            )

    count = await session.scalar(
        select(func.count()).select_from(Task).where(Task.list_id == list_id)
    )
    return map_list_entry(task_list, int(count or 0), can_share=True)


async def delete_list(
    session: AsyncSession,
    workspace_id: str,
    list_id: str,
    user_id: str,
    role: WorkspaceRole,
) -> dict:
    task_list = await _list_with_space(session, workspace_id, list_id)
    await require_list_permission(
        session, task_list, user_id, role, PermissionLevel.EDIT
    )
    if task_list.space.is_personal and task_list.name == "Personal List":
        raise AppError(400, "VALIDATION_ERROR", "Cannot delete the Personal list")
    await session.delete(task_list)
    await session.commit()
    return {"ok": True}


async def list_list_members(
    session: AsyncSession,
    workspace_id: str,
    list_id: str,
    user_id: str,
    role: WorkspaceRole,
) -> dict:
    task_list = await _list_with_space(session, workspace_id, list_id)
    await require_list_permission(
        session, task_list, user_id, role, PermissionLevel.VIEW
    )
    rows = (
        await session.scalars(
            select(ListMember)
            .where(ListMember.list_id == task_list.id)
            .options(selectinload(ListMember.user))
        )
    ).all()
    return {"data": [_member_row_payload(row) for row in rows]}


async def add_list_member(
    session: AsyncSession,
    workspace_id: str,
    list_id: str,
    user_id: str,
    role: WorkspaceRole,
    body: ShareMemberBody,
) -> dict:
    task_list = await _list_with_space(session, workspace_id, list_id)
    await require_list_permission(
        session, task_list, user_id, role, PermissionLevel.EDIT
    )
    target_user_id, target_email, status = await resolve_share_target(
        session, workspace_id, body.user_id, body.email
    )

    existing = await session.scalar(
        select(ListMember).where(
            ListMember.list_id == task_list.id,
            ListMember.user_id == target_user_id
            if target_user_id
            else ListMember.email == target_email,
        )
    )
    if existing:
        existing.permission_level = body.permission_level
        existing.status = status
    else:
        session.add(
            ListMember(
                list_id=task_list.id,
                user_id=target_user_id,
                email=target_email,
                status=status,
                permission_level=body.permission_level,
            )
        )
    await session.commit()
    await sync_list_channel_members_for_space(session, workspace_id, task_list.space)
    if target_user_id and status == MemberStatus.ACTIVE:
        notifications = await create_resource_share_notification(
            session,
            workspace_id=workspace_id,
            recipient_id=target_user_id,
            actor_user_id=user_id,
            resource_type="list",
            resource_name=task_list.name,
            href=f"/home/l/{task_list.id}",
        )
        await session.commit()
        if notifications:
            await emit_home_notifications(session, workspace_id, notifications)
    return await list_list_members(session, workspace_id, list_id, user_id, role)


async def remove_list_member(
    session: AsyncSession,
    workspace_id: str,
    list_id: str,
    target: str,
    user_id: str,
    role: WorkspaceRole,
) -> dict:
    task_list = await _list_with_space(session, workspace_id, list_id)
    await require_list_permission(
        session, task_list, user_id, role, PermissionLevel.EDIT
    )
    await session.execute(
        delete(ListMember).where(
            ListMember.list_id == task_list.id,
            (ListMember.user_id == target)
            | ((ListMember.user_id.is_(None)) & (ListMember.email == target)),
        )
    )
    await session.commit()
    await sync_list_channel_members_for_space(session, workspace_id, task_list.space)
    return {"ok": True}


async def _resolve_comment_thread_root(
    session: AsyncSession, parent_comment_id: str
) -> TaskComment:
    parent = await session.scalar(
        select(TaskComment).where(TaskComment.id == parent_comment_id)
    )
    if not parent:
        raise AppError(404, "NOT_FOUND", "Parent comment not found")
    root = parent
    while root.parent_comment_id:
        next_root = await session.scalar(
            select(TaskComment).where(TaskComment.id == root.parent_comment_id)
        )
        if not next_root:
            break
        root = next_root
    return root


async def add_task_comment(
    session: AsyncSession,
    workspace_id: str,
    user_id: str,
    role: WorkspaceRole,
    task_id: str,
    body: CreateTaskCommentBody,
) -> dict:
    if not body.has_content:
        raise AppError(400, "VALIDATION_ERROR", "Comment body or attachment is required")

    task = await _task_with_space(session, workspace_id, task_id)
    await require_list_permission(
        session, task.task_list, user_id, role, PermissionLevel.COMMENT
    )

    parent_author_id: str | None = None
    thread_parent_id: str | None = None
    if body.parent_comment_id:
        direct_parent = await session.scalar(
            select(TaskComment).where(
                TaskComment.id == body.parent_comment_id,
                TaskComment.task_id == task_id,
            )
        )
        if not direct_parent:
            raise AppError(404, "NOT_FOUND", "Parent comment not found")
        parent_author_id = direct_parent.user_id
        thread_root = await _resolve_comment_thread_root(
            session, body.parent_comment_id
        )
        thread_parent_id = thread_root.id

    follower_ids = list(task.follower_ids)

    comment = TaskComment(
        task_id=task_id,
        user_id=user_id,
        body=body.body.strip(),
        parent_comment_id=thread_parent_id,
    )
    session.add(comment)
    await session.flush()

    if body.attachment_ids:
        await session.execute(
            update(TaskAttachment)
            .where(
                TaskAttachment.id.in_(body.attachment_ids),
                TaskAttachment.task_id == task_id,
                TaskAttachment.workspace_id == workspace_id,
                TaskAttachment.uploader_id == user_id,
            )
            .values(comment_id=comment.id)
        )

    comment_preview = body.body.strip() or "📎 Attachment"
    comment_notifications: list[tuple[str, object]] = []
    reply_notifications: list[tuple[str, object]] = []

    if thread_parent_id:
        reply_notifications = await create_task_comment_reply_notifications(
            session,
            workspace_id=workspace_id,
            actor_user_id=user_id,
            task_name=task.name,
            task_id=task_id,
            parent_author_id=parent_author_id or "",
            comment_preview=comment_preview,
        )
    else:
        comment_notifications = await create_task_comment_notifications(
            session,
            workspace_id=workspace_id,
            actor_user_id=user_id,
            task_name=task.name,
            task_id=task_id,
            comment_preview=comment_preview,
            follower_ids=follower_ids,
        )

    already_notified = {uid for uid, _ in comment_notifications + reply_notifications}
    mention_notifications = await create_task_comment_mention_notifications(
        session,
        workspace_id=workspace_id,
        actor_user_id=user_id,
        task_name=task.name,
        task_id=task_id,
        comment_body=body.body.strip(),
        already_notified_ids=already_notified,
    )

    await session.commit()
    all_notifications = comment_notifications + reply_notifications + mention_notifications
    if all_notifications:
        await emit_home_notifications(session, workspace_id, all_notifications)

    refreshed = await session.scalar(
        select(Task).where(Task.id == task_id).options(*_TASK_LOAD)
    )
    names = await _assignee_name_map(session, refreshed)
    payload = map_task(refreshed, user_id, names)

    from app.services.task_attachment_service import map_task_attachment

    task_attachments = (
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
    payload["attachments"] = [map_task_attachment(a) for a in task_attachments]

    from app.services.task_time_service import get_task_time_state

    payload.update(await get_task_time_state(session, workspace_id, user_id, task_id))
    return payload


async def update_task_comment(
    session: AsyncSession,
    workspace_id: str,
    user_id: str,
    task_id: str,
    comment_id: str,
    body: UpdateTaskCommentBody,
) -> dict:
    comment = await session.scalar(
        select(TaskComment)
        .join(Task)
        .join(TaskList)
        .join(Space)
        .where(
            TaskComment.id == comment_id,
            TaskComment.task_id == task_id,
            Space.workspace_id == workspace_id,
        )
    )
    if not comment:
        raise AppError(404, "NOT_FOUND", "Comment not found")
    if comment.user_id != user_id:
        raise AppError(403, "FORBIDDEN", "You can only edit your own comments")

    comment.body = body.body.strip()
    comment.updated_at = datetime.now(timezone.utc)
    await session.commit()

    refreshed = await session.scalar(
        select(Task).where(Task.id == task_id).options(*_TASK_LOAD)
    )
    names = await _assignee_name_map(session, refreshed)
    payload = map_task(refreshed, user_id, names)
    from app.services.task_attachment_service import map_task_attachment
    from app.services.task_time_service import get_task_time_state

    task_attachments = (
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
    payload["attachments"] = [map_task_attachment(a) for a in task_attachments]
    payload.update(await get_task_time_state(session, workspace_id, user_id, task_id))
    return payload


async def delete_task_comment(
    session: AsyncSession,
    workspace_id: str,
    user_id: str,
    task_id: str,
    comment_id: str,
) -> dict:
    comment = await session.scalar(
        select(TaskComment)
        .join(Task)
        .join(TaskList)
        .join(Space)
        .where(
            TaskComment.id == comment_id,
            TaskComment.task_id == task_id,
            Space.workspace_id == workspace_id,
        )
    )
    if not comment:
        raise AppError(404, "NOT_FOUND", "Comment not found")
    if comment.user_id != user_id:
        raise AppError(403, "FORBIDDEN", "You can only delete your own comments")

    await session.delete(comment)
    await session.commit()

    refreshed = await session.scalar(
        select(Task).where(Task.id == task_id).options(*_TASK_LOAD)
    )
    names = await _assignee_name_map(session, refreshed)
    payload = map_task(refreshed, user_id, names)
    from app.services.task_attachment_service import map_task_attachment
    from app.services.task_time_service import get_task_time_state

    task_attachments = (
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
    payload["attachments"] = [map_task_attachment(a) for a in task_attachments]
    payload.update(await get_task_time_state(session, workspace_id, user_id, task_id))
    return payload
