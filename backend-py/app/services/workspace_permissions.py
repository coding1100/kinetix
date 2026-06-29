"""Workspace role hierarchy and permission helpers (ClickUp-aligned)."""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.enums import MemberStatus, WorkspaceRole
from app.db.models.workspace import WorkspaceMember

ROLE_RANK: dict[WorkspaceRole, int] = {
    WorkspaceRole.OWNER: 100,
    WorkspaceRole.SUPER_ADMIN: 90,
    WorkspaceRole.ADMIN: 80,
    WorkspaceRole.MEMBER: 50,
    WorkspaceRole.LIMITED_MEMBER: 30,
    WorkspaceRole.GUEST: 10,
}

OWNER_ONLY_ROLES = frozenset({WorkspaceRole.OWNER})
PRIVILEGED_ROLES = frozenset({WorkspaceRole.OWNER, WorkspaceRole.SUPER_ADMIN})
MANAGE_PEOPLE_ROLES = frozenset(
    {WorkspaceRole.OWNER, WorkspaceRole.SUPER_ADMIN, WorkspaceRole.ADMIN}
)


async def get_active_workspace_role(
    session: AsyncSession, workspace_id: str, user_id: str
) -> WorkspaceRole | None:
    role = await session.scalar(
        select(WorkspaceMember.role).where(
            WorkspaceMember.workspace_id == workspace_id,
            WorkspaceMember.user_id == user_id,
            WorkspaceMember.status == MemberStatus.ACTIVE,
        )
    )
    return role


def is_owner(role: WorkspaceRole | None) -> bool:
    return role == WorkspaceRole.OWNER


def is_super_admin(role: WorkspaceRole | None) -> bool:
    return role == WorkspaceRole.SUPER_ADMIN


def is_privileged(role: WorkspaceRole | None) -> bool:
    return role in PRIVILEGED_ROLES if role else False


def is_workspace_admin(role: WorkspaceRole | None) -> bool:
    return role in MANAGE_PEOPLE_ROLES if role else False


def can_manage_people(role: WorkspaceRole | None) -> bool:
    return is_workspace_admin(role)


def can_manage_teams(role: WorkspaceRole | None) -> bool:
    return is_workspace_admin(role)


def can_assign_role(actor_role: WorkspaceRole, new_role: WorkspaceRole) -> bool:
    if actor_role == WorkspaceRole.OWNER:
        return True
    if actor_role == WorkspaceRole.SUPER_ADMIN:
        return new_role not in (WorkspaceRole.OWNER, WorkspaceRole.SUPER_ADMIN)
    if actor_role == WorkspaceRole.ADMIN:
        return new_role in (
            WorkspaceRole.MEMBER,
            WorkspaceRole.GUEST,
            WorkspaceRole.LIMITED_MEMBER,
        )
    return False


def can_edit_member(actor_role: WorkspaceRole, target_role: WorkspaceRole) -> bool:
    if actor_role == WorkspaceRole.OWNER:
        return True
    if actor_role == WorkspaceRole.SUPER_ADMIN:
        return target_role not in (WorkspaceRole.OWNER, WorkspaceRole.SUPER_ADMIN)
    if actor_role == WorkspaceRole.ADMIN:
        return target_role not in (
            WorkspaceRole.OWNER,
            WorkspaceRole.SUPER_ADMIN,
            WorkspaceRole.ADMIN,
        )
    return False


def can_delete_workspace(role: WorkspaceRole | None) -> bool:
    return is_owner(role)


def can_transfer_ownership(role: WorkspaceRole | None) -> bool:
    return is_owner(role)


async def has_privileged_workspace_access(
    session: AsyncSession, workspace_id: str, user_id: str
) -> bool:
    role = await get_active_workspace_role(session, workspace_id, user_id)
    return is_privileged(role)
