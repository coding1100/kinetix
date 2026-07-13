"""Space-level content permissions (ClickUp-aligned).

Workspace roles (workspace_permissions.py) govern people/workspace/team
management. This module governs access to *content* — Spaces and everything
under them (Folders, Lists, Tasks) — which workspace roles alone don't
restrict: every active member gets EDIT by default, private Spaces and
explicit SpaceMember overrides narrow that.
"""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AppError
from app.db.models.enums import PermissionLevel, WorkspaceRole
from app.db.models.home import Space, SpaceMember
from app.services.workspace_permissions import is_privileged

_LEVEL_RANK = {
    PermissionLevel.VIEW: 1,
    PermissionLevel.COMMENT: 2,
    PermissionLevel.EDIT: 3,
}

# Default level a role gets on a *public* Space, absent any SpaceMember
# override. GUEST has no ambient default — a Guest with no explicit grant
# sees nothing, matching ClickUp's "Guests only access what's shared".
DEFAULT_LEVEL_BY_ROLE: dict[WorkspaceRole, PermissionLevel | None] = {
    WorkspaceRole.OWNER: PermissionLevel.EDIT,
    WorkspaceRole.SUPER_ADMIN: PermissionLevel.EDIT,
    WorkspaceRole.ADMIN: PermissionLevel.EDIT,
    WorkspaceRole.MEMBER: PermissionLevel.EDIT,
    WorkspaceRole.LIMITED_MEMBER: PermissionLevel.VIEW,
    WorkspaceRole.GUEST: None,
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
    """The effective permission level `user_id` (with `role`) has on `space`."""
    if is_privileged(role):
        # OWNER / SUPER_ADMIN: same bypass chat_service already grants for
        # private channels — always full access, no override needed.
        return PermissionLevel.EDIT

    override = await _space_member_override(session, space.id, user_id)
    if override is not None:
        return override

    if space.is_private:
        return None

    return DEFAULT_LEVEL_BY_ROLE.get(role)


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
    """Space ids `user_id` has at least VIEW on. `None` means "all of them"
    (used for OWNER/SUPER_ADMIN so callers can skip filtering)."""
    if is_privileged(role):
        return None

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
