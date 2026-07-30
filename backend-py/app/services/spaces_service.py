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
from app.db.models.user import User
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
from app.services.list_status_service import ensure_list_statuses, serialize_status_config
from app.services.notification_service import (
    create_resource_share_notification,
    create_resource_unshare_notification,
    create_task_comment_mention_notifications,
    emit_home_notifications,
)
from app.services.space_permissions import (
    get_space_or_403,
    require_space_permission,
)
from app.services.folder_list_permissions import (
    require_folder_permission,
    require_list_permission,
    resolve_share_target,
    user_ids_with_list_access,
)
from app.services.workspace_permissions import is_workspace_admin
from app.socket.emit import (
    broadcast_channel_privacy_changed,
    broadcast_channel_renamed,
    broadcast_resource_access_granted,
    broadcast_resource_access_removed,
)


def _member_row_payload(row: SpaceMember | FolderMember | ListMember) -> dict:
    return {
        "userId": row.user_id,
        "name": row.user.full_name if row.user else None,
        "email": row.user.email if row.user else row.email,
        "permissionLevel": row.permission_level.value,
        "status": row.status.value,
        "implicit": False,
    }


def _creator_row_payload(created_by) -> dict:
    """Synthetic "who has access" row for a Space/Folder/List's creator -
    they have EDIT unconditionally (see resolve_space_permission) and never
    get a real SpaceMember/FolderMember/ListMember row, so the real rows
    alone would never show them in the share list."""
    return {
        "userId": created_by.id,
        "name": created_by.full_name,
        "email": created_by.email,
        "permissionLevel": PermissionLevel.EDIT.value,
        "status": "ACTIVE",
        "implicit": True,
    }


def _require_can_create_space(role: WorkspaceRole) -> None:
    if role in (WorkspaceRole.GUEST, WorkspaceRole.LIMITED_MEMBER):
        raise AppError(403, "FORBIDDEN", "You don't have permission to create a Space")


def _require_can_edit_structure(role: WorkspaceRole) -> None:
    """Rename/Delete/create-child-Folder-or-List are structural,
    workspace-shape-changing actions (Delete especially - cascades and
    destroys everything nested), not just editing content within a
    resource. Real content EDIT access (checked separately, per-resource,
    at each call site) isn't enough on its own - a Guest or Limited
    Member must never get these even with an explicit EDIT override,
    mirroring _require_can_create_space's existing Guest/Limited Member
    exclusion for creating a Space in the first place."""
    if role in (WorkspaceRole.GUEST, WorkspaceRole.LIMITED_MEMBER):
        raise AppError(
            403,
            "FORBIDDEN",
            "Guests and Limited Members can't create, rename, or delete Spaces/Folders/Lists",
        )


async def _get_space(session: AsyncSession, workspace_id: str, space_id: str) -> Space:
    space = await session.scalar(
        select(Space).where(Space.id == space_id, Space.workspace_id == workspace_id)
    )
    if not space:
        raise AppError(404, "NOT_FOUND", "Space not found")
    return space


async def _target_workspace_role(
    session: AsyncSession, workspace_id: str, target_user_id: str | None
) -> WorkspaceRole | None:
    if not target_user_id:
        return None
    return await session.scalar(
        select(WorkspaceMember.role).where(
            WorkspaceMember.workspace_id == workspace_id,
            WorkspaceMember.user_id == target_user_id,
        )
    )


def _require_can_manage_access(role: WorkspaceRole) -> None:
    """Only workspace admins can manage sharing (add/remove members) or
    toggle privacy on a Space/Folder/List - not just anyone with EDIT
    access to that resource. Matches can_manage_people/can_manage_teams'
    style (workspace_permissions.py)."""
    if not is_workspace_admin(role):
        raise AppError(
            403, "FORBIDDEN", "Only workspace admins can manage sharing"
        )


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
    trimmed_name = body.name.strip()
    existing = await session.scalar(
        select(Space).where(
            Space.workspace_id == workspace_id, Space.name == trimmed_name
        )
    )
    if existing:
        raise AppError(409, "CONFLICT", "A Space with this name already exists")
    space = Space(
        workspace_id=workspace_id,
        name=trimmed_name,
        color=body.color or "#7B68EE",
        description=body.description,
        is_private=body.is_private,
        created_by_id=user_id,
    )
    session.add(space)
    await session.flush()
    # Every new Space starts with one default, ordinary List - same shape
    # as a manually-created one (statuses + chat channel) - so it's never
    # empty. Not flagged/protected in any way, so the user can rename or
    # delete it like any other List.
    default_list = TaskList(
        space_id=space.id, name="List", sort_order=1, created_by_id=user_id
    )
    session.add(default_list)
    await session.flush()
    await ensure_list_statuses(session, default_list.id)
    await session.commit()
    # Every list is mandatory 1:1 with its own chat channel - see
    # chat_service.create_list_channel.
    await create_list_channel(session, workspace_id, default_list, space, user_id)
    refreshed = await session.scalar(
        select(Space).where(Space.id == space.id).options(*_SPACE_LOAD)
    )
    member_count = await _active_member_count(session, workspace_id)
    list_count = await _list_count_for_space(session, space.id)
    return await _build_space_payload(
        session, refreshed, member_count, list_count, user_id, role
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
    if (
        body.name is not None
        or body.color is not None
        or body.description is not None
        or body.status_config is not None
    ):
        _require_can_edit_structure(role)
    if body.status_config is not None:
        space.status_config = serialize_status_config(body.status_config)
    if body.name is not None:
        trimmed_name = body.name.strip()
        if trimmed_name != space.name:
            existing = await session.scalar(
                select(Space).where(
                    Space.workspace_id == workspace_id,
                    Space.name == trimmed_name,
                    Space.id != space.id,
                )
            )
            if existing:
                raise AppError(409, "CONFLICT", "A Space with this name already exists")
        space.name = trimmed_name
    if body.color is not None:
        space.color = body.color
    if body.description is not None:
        space.description = body.description or None
    privacy_changed = (
        body.is_private is not None and body.is_private != space.is_private
    )
    if privacy_changed:
        _require_can_manage_access(role)
        space.is_private = body.is_private
    await session.commit()
    if privacy_changed:
        # Narrowing/widening privacy changes who can see every List under
        # this Space - their primary chat channels need to be re-derived
        # too, or someone who lost/gained access stays stuck with their
        # old channel membership indefinitely (nothing else would ever
        # re-sync it otherwise).
        await sync_list_channel_members_for_space(session, workspace_id, space)
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
    _require_can_edit_structure(role)
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
    data = [_member_row_payload(row) for row in rows]
    if space.created_by_id:
        creator = await session.get(User, space.created_by_id)
        if creator:
            data.insert(0, _creator_row_payload(creator))
    return {"isPrivate": space.is_private, "data": data}


async def add_space_member(
    session: AsyncSession,
    workspace_id: str,
    space_id: str,
    user_id: str,
    role: WorkspaceRole,
    body: ShareMemberBody,
) -> dict:
    space = await _get_space(session, workspace_id, space_id)
    _require_can_manage_access(role)
    target_user_id, target_email, status = await resolve_share_target(
        session, workspace_id, body.user_id, body.email
    )

    target_role = await _target_workspace_role(session, workspace_id, target_user_id)
    if target_role == WorkspaceRole.GUEST:
        raise AppError(
            400,
            "VALIDATION_ERROR",
            "Guests can't be given access to a whole Space - share a Folder or List with them instead",
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
        await broadcast_resource_access_granted(
            workspace_id=workspace_id,
            user_ids=[target_user_id],
            resource_type="space",
            resource_id=space.id,
        )
    return await list_space_members(session, workspace_id, space_id, user_id, role)


async def remove_space_member(
    session: AsyncSession,
    workspace_id: str,
    space_id: str,
    target: str,
    user_id: str,
    role: WorkspaceRole,
) -> dict:
    space = await _get_space(session, workspace_id, space_id)
    _require_can_manage_access(role)
    target_role = await _target_workspace_role(session, workspace_id, target)
    result = await session.execute(
        delete(SpaceMember).where(
            SpaceMember.space_id == space.id,
            (SpaceMember.user_id == target)
            | ((SpaceMember.user_id.is_(None)) & (SpaceMember.email == target)),
        )
    )
    await session.commit()
    await sync_list_channel_members_for_space(session, workspace_id, space)
    if result.rowcount:
        if target_role is not None:
            notifications = await create_resource_unshare_notification(
                session,
                workspace_id=workspace_id,
                recipient_id=target,
                actor_user_id=user_id,
                resource_type="space",
                resource_name=space.name,
            )
            await session.commit()
            if notifications:
                await emit_home_notifications(session, workspace_id, notifications)
        await broadcast_resource_access_removed(
            workspace_id=workspace_id,
            user_ids=[target],
            resource_type="space",
            resource_id=space.id,
        )
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
    _require_can_edit_structure(role)
    max_order = await session.scalar(
        select(func.max(Folder.sort_order)).where(Folder.space_id == space_id)
    )
    folder = Folder(
        space_id=space.id,
        name=body.name.strip(),
        sort_order=int(max_order or 0) + 1,
        is_private=bool(body.is_private),
        created_by_id=user_id,
    )
    session.add(folder)
    await session.commit()
    return {
        "id": folder.id,
        "name": folder.name,
        "lists": [],
        "canShare": is_workspace_admin(role),
        "canManageStructure": role
        not in (WorkspaceRole.GUEST, WorkspaceRole.LIMITED_MEMBER),
        "isPrivate": folder.is_private,
    }


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
        _require_can_edit_structure(role)
        folder.name = body.name.strip()
    privacy_changed = (
        body.is_private is not None and body.is_private != folder.is_private
    )
    if privacy_changed:
        _require_can_manage_access(role)
        folder.is_private = body.is_private
    await session.commit()
    if privacy_changed:
        await sync_list_channel_members_for_space(session, workspace_id, folder.space)
    return {
        "id": folder.id,
        "name": folder.name,
        "canShare": is_workspace_admin(role),
        "canManageStructure": role
        not in (WorkspaceRole.GUEST, WorkspaceRole.LIMITED_MEMBER),
        "isPrivate": folder.is_private,
    }


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
    _require_can_edit_structure(role)
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
    data = [_member_row_payload(row) for row in rows]
    if folder.created_by_id:
        creator = await session.get(User, folder.created_by_id)
        if creator:
            data.insert(0, _creator_row_payload(creator))
    return {"isPrivate": folder.is_private, "data": data}


async def add_folder_member(
    session: AsyncSession,
    workspace_id: str,
    folder_id: str,
    user_id: str,
    role: WorkspaceRole,
    body: ShareMemberBody,
) -> dict:
    folder = await _folder_with_space(session, workspace_id, folder_id)
    _require_can_manage_access(role)
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
        await broadcast_resource_access_granted(
            workspace_id=workspace_id,
            user_ids=[target_user_id],
            resource_type="folder",
            resource_id=folder.id,
        )
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
    _require_can_manage_access(role)
    target_role = await _target_workspace_role(session, workspace_id, target)
    result = await session.execute(
        delete(FolderMember).where(
            FolderMember.folder_id == folder.id,
            (FolderMember.user_id == target)
            | ((FolderMember.user_id.is_(None)) & (FolderMember.email == target)),
        )
    )
    await session.commit()
    await sync_list_channel_members_for_space(session, workspace_id, folder.space)
    if result.rowcount:
        if target_role is not None:
            notifications = await create_resource_unshare_notification(
                session,
                workspace_id=workspace_id,
                recipient_id=target,
                actor_user_id=user_id,
                resource_type="folder",
                resource_name=folder.name,
            )
            await session.commit()
            if notifications:
                await emit_home_notifications(session, workspace_id, notifications)
        await broadcast_resource_access_removed(
            workspace_id=workspace_id,
            user_ids=[target],
            resource_type="folder",
            resource_id=folder.id,
        )
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
    _require_can_edit_structure(role)
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
        is_private=bool(body.is_private),
        created_by_id=user_id,
    )
    session.add(task_list)
    await session.flush()
    await ensure_list_statuses(session, task_list.id)
    await session.commit()
    # Every list is mandatory 1:1 with its own chat channel - see
    # chat_service.create_list_channel.
    await create_list_channel(session, workspace_id, task_list, space, user_id)
    return map_list_entry(
        task_list,
        0,
        can_share=is_workspace_admin(role),
        can_manage_structure=role
        not in (WorkspaceRole.GUEST, WorkspaceRole.LIMITED_MEMBER),
    )


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
        _require_can_edit_structure(role)
        task_list.name = body.name.strip()
        renamed = True
    if body.status_config is not None:
        _require_can_edit_structure(role)
        task_list.status_config = serialize_status_config(body.status_config)
    elif body.inherit_status_config:
        _require_can_edit_structure(role)
        task_list.status_config = None
    privacy_changed = (
        body.is_private is not None and body.is_private != task_list.is_private
    )
    if privacy_changed:
        _require_can_manage_access(role)
        task_list.is_private = body.is_private
    if body.status_config is not None or body.inherit_status_config:
        await session.flush()
        await ensure_list_statuses(session, list_id)
    await session.commit()
    if privacy_changed:
        await sync_list_channel_members_for_space(session, workspace_id, task_list.space)

    if renamed or privacy_changed:
        channel = await session.scalar(
            select(ChatChannel).where(
                ChatChannel.list_id == list_id,
                ChatChannel.is_list_primary.is_(True),
            )
        )
        if channel and privacy_changed:
            # Existing members who stay on the channel (not added/removed
            # by the resync above) never otherwise learn the List's own
            # is_private flipped - their cached sidebar entry's isPrivate
            # (which now mirrors the List, see _channel_payload) would
            # stay stale forever without this.
            asyncio.create_task(
                broadcast_channel_privacy_changed(
                    workspace_id=workspace_id,
                    channel_id=channel.id,
                    is_private=task_list.is_private,
                )
            )
        if renamed and channel and channel.name != task_list.name:
            # List name is the source of truth for its primary channel's
            # name (two-way sync - the reverse direction lives in
            # chat_service.update_channel). Best-effort: a list rename
            # should never fail just because the channel side hit a name
            # conflict.
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
    return map_list_entry(
        task_list,
        int(count or 0),
        can_share=is_workspace_admin(role),
        can_manage_structure=role
        not in (WorkspaceRole.GUEST, WorkspaceRole.LIMITED_MEMBER),
    )


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
    _require_can_edit_structure(role)
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
    data = [_member_row_payload(row) for row in rows]
    if task_list.created_by_id:
        creator = await session.get(User, task_list.created_by_id)
        if creator:
            data.insert(0, _creator_row_payload(creator))
    return {"isPrivate": task_list.is_private, "data": data}


async def list_list_assignable_members(
    session: AsyncSession,
    workspace_id: str,
    list_id: str,
    user_id: str,
    role: WorkspaceRole,
) -> dict:
    """Everyone who can actually see this list (explicit grant or inherited
    from its Folder/Space), for populating an assignee picker - not just the
    people with an explicit ListMember override (see list_list_members)."""
    task_list = await _list_with_space(session, workspace_id, list_id)
    await require_list_permission(
        session, task_list, user_id, role, PermissionLevel.VIEW
    )
    accessible_ids = await user_ids_with_list_access(session, workspace_id, task_list)
    if not accessible_ids:
        return {"data": []}
    rows = (
        await session.scalars(
            select(WorkspaceMember)
            .where(
                WorkspaceMember.workspace_id == workspace_id,
                WorkspaceMember.user_id.in_(accessible_ids),
                WorkspaceMember.status == MemberStatus.ACTIVE,
            )
            .options(selectinload(WorkspaceMember.user))
        )
    ).all()
    data = [
        {
            "id": m.user.id,
            "email": m.user.email,
            "fullName": m.user.full_name,
            "avatarUrl": m.user.avatar_url,
            "isDisabled": m.user.is_disabled,
        }
        for m in rows
        if not m.user.is_disabled
    ]
    return {"data": data}


async def add_list_member(
    session: AsyncSession,
    workspace_id: str,
    list_id: str,
    user_id: str,
    role: WorkspaceRole,
    body: ShareMemberBody,
) -> dict:
    task_list = await _list_with_space(session, workspace_id, list_id)
    _require_can_manage_access(role)
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
        await broadcast_resource_access_granted(
            workspace_id=workspace_id,
            user_ids=[target_user_id],
            resource_type="list",
            resource_id=task_list.id,
        )
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
    _require_can_manage_access(role)
    target_role = await _target_workspace_role(session, workspace_id, target)
    result = await session.execute(
        delete(ListMember).where(
            ListMember.list_id == task_list.id,
            (ListMember.user_id == target)
            | ((ListMember.user_id.is_(None)) & (ListMember.email == target)),
        )
    )
    await session.commit()
    await sync_list_channel_members_for_space(session, workspace_id, task_list.space)
    if result.rowcount:
        if target_role is not None:
            notifications = await create_resource_unshare_notification(
                session,
                workspace_id=workspace_id,
                recipient_id=target,
                actor_user_id=user_id,
                resource_type="list",
                resource_name=task_list.name,
            )
            await session.commit()
            if notifications:
                await emit_home_notifications(session, workspace_id, notifications)
        await broadcast_resource_access_removed(
            workspace_id=workspace_id,
            user_ids=[target],
            resource_type="list",
            resource_id=task_list.id,
        )
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
        thread_root = await _resolve_comment_thread_root(
            session, body.parent_comment_id
        )
        thread_parent_id = thread_root.id

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

    # Task comments/replies only notify the people @mentioned in them, not
    # every follower/parent-comment-author by default (see
    # create_task_comment_notifications / create_task_comment_reply_notifications
    # in notification_service.py - kept for reference, just not called here).
    comment_notifications: list[tuple[str, object]] = []
    reply_notifications: list[tuple[str, object]] = []

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
