"""Folder/List-level content permissions.

Extends space_permissions.py one/two levels down: a Folder or List can carry
its own explicit member override (FolderMember/ListMember), scoped tighter
than — or in addition to — whatever the parent Space grants. Resolution
always falls through to the parent when there's no override, so a Folder or
List's effective permission is never *less* than what the Space already
allows; overrides exist to grant *more* (e.g. share a single List with
someone who has no Space access at all).
"""

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AppError
from app.db.models.enums import MemberStatus, PermissionLevel, WorkspaceRole
from app.db.models.home import (
    Folder,
    FolderMember,
    ListMember,
    Space,
    SpaceMember,
    TaskList,
)
from app.db.models.invite import Invite
from app.db.models.user import User
from app.db.models.workspace import WorkspaceMember
from app.services.space_permissions import (
    level_at_least,
    resolve_space_permission,
)
from app.services.workspace_permissions import is_privileged


async def resolve_share_target(
    session: AsyncSession,
    workspace_id: str,
    user_id: str | None,
    email: str | None,
) -> tuple[str | None, str | None, MemberStatus]:
    """Resolve a ShareMemberBody's userId/email into a
    (userId, email, status) triple for a *Member row.

    userId given: must be an active workspace member, grant is immediate.
    email given: an active member's email grants immediately (real userId,
    no pending state); an email with a pending, unexpired workspace Invite
    creates a pending grant (userId=None, status=INVITED) that gets
    materialized when that invite is accepted (see resolve_pending_shares).
    Anything else is rejected — sharing never silently invites someone.
    """
    if user_id:
        active = await session.scalar(
            select(WorkspaceMember.user_id).where(
                WorkspaceMember.workspace_id == workspace_id,
                WorkspaceMember.user_id == user_id,
                WorkspaceMember.status == MemberStatus.ACTIVE,
            )
        )
        if not active:
            raise AppError(
                400, "VALIDATION_ERROR", "User is not an active workspace member"
            )
        return user_id, None, MemberStatus.ACTIVE

    assert email is not None
    normalized = email.strip().lower()

    member_user_id = await session.scalar(
        select(WorkspaceMember.user_id)
        .join(User, User.id == WorkspaceMember.user_id)
        .where(
            WorkspaceMember.workspace_id == workspace_id,
            WorkspaceMember.status == MemberStatus.ACTIVE,
            func.lower(User.email) == normalized,
        )
    )
    if member_user_id:
        return member_user_id, None, MemberStatus.ACTIVE

    invite = await session.scalar(
        select(Invite).where(
            Invite.workspace_id == workspace_id,
            func.lower(Invite.email) == normalized,
            Invite.accepted_at.is_(None),
        )
    )
    if invite:
        expires_at = invite.expires_at
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        if expires_at >= datetime.now(timezone.utc):
            return None, normalized, MemberStatus.INVITED

    raise AppError(
        400, "VALIDATION_ERROR", "Invite this person to the workspace first"
    )


async def _folder_member_override(
    session: AsyncSession, folder_id: str, user_id: str
) -> PermissionLevel | None:
    return await session.scalar(
        select(FolderMember.permission_level).where(
            FolderMember.folder_id == folder_id,
            FolderMember.user_id == user_id,
            FolderMember.status == MemberStatus.ACTIVE,
        )
    )


async def _list_member_override(
    session: AsyncSession, list_id: str, user_id: str
) -> PermissionLevel | None:
    return await session.scalar(
        select(ListMember.permission_level).where(
            ListMember.list_id == list_id,
            ListMember.user_id == user_id,
            ListMember.status == MemberStatus.ACTIVE,
        )
    )


async def resolve_folder_permission(
    session: AsyncSession,
    folder: Folder,
    user_id: str,
    role: WorkspaceRole,
) -> PermissionLevel | None:
    """The effective permission level `user_id` (with `role`) has on `folder`."""
    if is_privileged(role):
        return PermissionLevel.EDIT

    override = await _folder_member_override(session, folder.id, user_id)
    space_level = await resolve_space_permission(session, folder.space, user_id, role)
    if override is None:
        return space_level
    if space_level is None:
        return override
    return override if level_at_least(override, space_level) else space_level


async def resolve_list_permission(
    session: AsyncSession,
    task_list: TaskList,
    user_id: str,
    role: WorkspaceRole,
) -> PermissionLevel | None:
    """The effective permission level `user_id` (with `role`) has on `task_list`.

    Falls through List override -> Folder override (if the list is inside
    one) -> Space default, taking the highest applicable level at each step
    (an override only ever widens access, never narrows it below what the
    parent already grants).
    """
    if is_privileged(role):
        return PermissionLevel.EDIT

    parent_level: PermissionLevel | None
    if task_list.folder_id:
        parent_level = await _folder_member_override(
            session, task_list.folder_id, user_id
        )
        space_level = await resolve_space_permission(
            session, task_list.space, user_id, role
        )
        if parent_level is None or (
            space_level is not None and level_at_least(space_level, parent_level)
        ):
            parent_level = space_level
    else:
        parent_level = await resolve_space_permission(
            session, task_list.space, user_id, role
        )

    override = await _list_member_override(session, task_list.id, user_id)
    if override is None:
        return parent_level
    if parent_level is None:
        return override
    return override if level_at_least(override, parent_level) else parent_level


async def require_folder_permission(
    session: AsyncSession,
    folder: Folder,
    user_id: str,
    role: WorkspaceRole,
    needed: PermissionLevel,
) -> None:
    level = await resolve_folder_permission(session, folder, user_id, role)
    if not level_at_least(level, needed):
        raise AppError(403, "FORBIDDEN", "You don't have access to this Folder")


async def require_list_permission(
    session: AsyncSession,
    task_list: TaskList,
    user_id: str,
    role: WorkspaceRole,
    needed: PermissionLevel,
) -> None:
    level = await resolve_list_permission(session, task_list, user_id, role)
    if not level_at_least(level, needed):
        raise AppError(403, "FORBIDDEN", "You don't have access to this List")


async def user_ids_with_list_access(
    session: AsyncSession, workspace_id: str, task_list: TaskList
) -> set[str]:
    """Active workspace member ids with at least VIEW on `task_list`.

    Like space_permissions.user_ids_with_space_access, but per-list — used
    to sync a list's primary chat channel membership so a Folder/List-only
    grant (no Space access) still gets that person into the channel.
    """
    members = (
        await session.scalars(
            select(WorkspaceMember).where(
                WorkspaceMember.workspace_id == workspace_id,
                WorkspaceMember.status == MemberStatus.ACTIVE,
            )
        )
    ).all()
    result: set[str] = set()
    for member in members:
        level = await resolve_list_permission(
            session, task_list, member.user_id, member.role
        )
        if level_at_least(level, PermissionLevel.VIEW):
            result.add(member.user_id)
    return result


async def resolve_pending_shares(
    session: AsyncSession, workspace_id: str, email: str, user_id: str
) -> None:
    """Convert any pending (email-only) share grants for `email` into real
    grants for `user_id`, across Space/Folder/List. Called right after a
    workspace Invite is accepted, before re-syncing chat channel membership.
    """
    normalized = email.strip().lower()

    space_rows = (
        await session.scalars(
            select(SpaceMember)
            .join(Space)
            .where(
                Space.workspace_id == workspace_id,
                SpaceMember.status == MemberStatus.INVITED,
                SpaceMember.user_id.is_(None),
                SpaceMember.email.isnot(None),
            )
        )
    ).all()
    for row in space_rows:
        if row.email.strip().lower() == normalized:
            row.user_id = user_id
            row.status = MemberStatus.ACTIVE

    folder_rows = (
        await session.scalars(
            select(FolderMember)
            .join(Folder)
            .join(Space)
            .where(
                Space.workspace_id == workspace_id,
                FolderMember.status == MemberStatus.INVITED,
                FolderMember.user_id.is_(None),
                FolderMember.email.isnot(None),
            )
        )
    ).all()
    for row in folder_rows:
        if row.email.strip().lower() == normalized:
            row.user_id = user_id
            row.status = MemberStatus.ACTIVE

    list_rows = (
        await session.scalars(
            select(ListMember)
            .join(TaskList)
            .join(Space)
            .where(
                Space.workspace_id == workspace_id,
                ListMember.status == MemberStatus.INVITED,
                ListMember.user_id.is_(None),
                ListMember.email.isnot(None),
            )
        )
    ).all()
    for row in list_rows:
        if row.email.strip().lower() == normalized:
            row.user_id = user_id
            row.status = MemberStatus.ACTIVE
