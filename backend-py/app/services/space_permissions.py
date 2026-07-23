"""Space-level content permissions (ClickUp-aligned).

Workspace roles (workspace_permissions.py) govern people/workspace/team
management. This module governs access to *content* — Spaces and everything
under them (Folders, Lists, Tasks). There is no ambient default: a Space,
public or private, grants access to nobody except through an explicit
SpaceMember row. "Public" currently has no functional effect on access (no
browse/join feature exists yet) — it only means the name-uniqueness and
future-discoverability rules apply to it the same as private Spaces.
"""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AppError
from app.db.models.enums import MemberStatus, PermissionLevel, WorkspaceRole
from app.db.models.home import Space, SpaceMember
from app.db.models.workspace import WorkspaceMember

_LEVEL_RANK = {
    PermissionLevel.VIEW: 1,
    PermissionLevel.COMMENT: 2,
    PermissionLevel.EDIT: 3,
}

def level_at_least(level: PermissionLevel | None, needed: PermissionLevel) -> bool:
    if level is None:
        return False
    return _LEVEL_RANK[level] >= _LEVEL_RANK[needed]


async def _space_member_override(
    session: AsyncSession, space_id: str, user_id: str
) -> PermissionLevel | None:
    row = await session.scalar(
        select(SpaceMember.permission_level).where(
            SpaceMember.space_id == space_id, SpaceMember.user_id == user_id
        )
    )
    return row


async def resolve_space_permission(
    session: AsyncSession,
    space: Space,
    user_id: str,
    role: WorkspaceRole,
) -> PermissionLevel | None:
    """The effective permission level `user_id` (with `role`) has on `space`.

    The creator always has EDIT, unconditionally. Otherwise, no ambient
    default for any role, public or private - an explicit SpaceMember row
    (a "Share") is the only other source of access. `role` is accepted for
    signature-compatibility with callers/tests but no longer affects the
    result.
    """
    if space.created_by_id and space.created_by_id == user_id:
        return PermissionLevel.EDIT
    return await _space_member_override(session, space.id, user_id)


async def require_space_permission(
    session: AsyncSession,
    space: Space,
    user_id: str,
    role: WorkspaceRole,
    needed: PermissionLevel,
) -> None:
    level = await resolve_space_permission(session, space, user_id, role)
    if not level_at_least(level, needed):
        raise AppError(403, "FORBIDDEN", "You don't have access to this Space")


async def get_space_or_403(
    session: AsyncSession,
    workspace_id: str,
    space_id: str,
    user_id: str,
    role: WorkspaceRole,
    needed: PermissionLevel,
) -> Space:
    space = await session.scalar(
        select(Space).where(Space.id == space_id, Space.workspace_id == workspace_id)
    )
    if not space:
        raise AppError(404, "NOT_FOUND", "Space not found")
    await require_space_permission(session, space, user_id, role, needed)
    return space


async def visible_space_ids(
    session: AsyncSession,
    workspace_id: str,
    user_id: str,
    role: WorkspaceRole,
) -> set[str] | None:
    """Space ids `user_id` has at least VIEW on."""
    spaces = (
        await session.scalars(
            select(Space).where(Space.workspace_id == workspace_id)
        )
    ).all()
    visible: set[str] = set()
    for space in spaces:
        level = await resolve_space_permission(session, space, user_id, role)
        if level_at_least(level, PermissionLevel.VIEW):
            visible.add(space.id)
    return visible


async def user_ids_with_space_access(
    session: AsyncSession, workspace_id: str, space: Space
) -> set[str]:
    """Active workspace member ids with at least VIEW on `space`.

    Source of truth for a list-primary channel's membership - a list's
    channel members should mirror whoever can see the list's Space, and this
    needs re-running whenever workspace/space membership changes (see
    sync_list_channel_members_for_space in chat_service.py).
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
        level = await resolve_space_permission(
            session, space, member.user_id, member.role
        )
        if level_at_least(level, PermissionLevel.VIEW):
            result.add(member.user_id)
    return result
