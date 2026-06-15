from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.errors import AppError
from app.core.utils import unique_workspace_slug
from app.db.models.enums import MemberStatus, WorkspaceRole
from app.db.models.workspace import Workspace, WorkspaceMember
from app.socket.presence import get_presence
from app.schemas.workspace import CreateWorkspaceBody, UpdateWorkspaceMemberBody


def _workspace_json(ws: Workspace) -> dict:
    return {
        "id": ws.id,
        "name": ws.name,
        "slug": ws.slug,
        "createdAt": ws.created_at.isoformat() if ws.created_at else None,
        "updatedAt": ws.updated_at.isoformat() if ws.updated_at else None,
    }


async def list_workspaces(session: AsyncSession, user_id: str) -> list[dict]:
    rows = (
        await session.scalars(
            select(WorkspaceMember)
            .where(
                WorkspaceMember.user_id == user_id,
                WorkspaceMember.status == MemberStatus.ACTIVE,
            )
            .options(selectinload(WorkspaceMember.workspace))
            .order_by(WorkspaceMember.joined_at.asc())
        )
    ).all()
    return [
        {
            "id": m.workspace.id,
            "name": m.workspace.name,
            "slug": m.workspace.slug,
            "role": m.role.value,
            "joinedAt": m.joined_at.isoformat() if m.joined_at else None,
        }
        for m in rows
    ]


async def create_workspace(
    session: AsyncSession, user_id: str, body: CreateWorkspaceBody
) -> dict:
    async def slug_exists(slug: str) -> bool:
        return (
            await session.scalar(select(Workspace).where(Workspace.slug == slug))
        ) is not None

    slug = await unique_workspace_slug(body.name, slug_exists)
    workspace = Workspace(name=body.name, slug=slug)
    session.add(workspace)
    await session.flush()
    session.add(
        WorkspaceMember(
            workspace_id=workspace.id,
            user_id=user_id,
            role=WorkspaceRole.OWNER,
            status=MemberStatus.ACTIVE,
        )
    )
    await session.commit()
    await session.refresh(workspace)
    return _workspace_json(workspace)


async def get_workspace(
    session: AsyncSession, workspace_id: str, user_id: str
) -> dict:
    membership = await session.scalar(
        select(WorkspaceMember)
        .where(
            WorkspaceMember.workspace_id == workspace_id,
            WorkspaceMember.user_id == user_id,
        )
        .options(selectinload(WorkspaceMember.workspace))
    )
    if not membership or membership.status != MemberStatus.ACTIVE:
        raise AppError(403, "FORBIDDEN", "Access denied")

    count = await session.scalar(
        select(func.count())
        .select_from(WorkspaceMember)
        .where(
            WorkspaceMember.workspace_id == workspace_id,
            WorkspaceMember.status == MemberStatus.ACTIVE,
        )
    )
    ws = membership.workspace
    return {
        "id": ws.id,
        "name": ws.name,
        "slug": ws.slug,
        "role": membership.role.value,
        "memberCount": count or 0,
    }


async def update_workspace(
    session: AsyncSession, workspace_id: str, user_id: str, name: str | None
) -> dict:
    membership = await session.scalar(
        select(WorkspaceMember).where(
            WorkspaceMember.workspace_id == workspace_id,
            WorkspaceMember.user_id == user_id,
        )
    )
    if not membership or membership.role not in (
        WorkspaceRole.OWNER,
        WorkspaceRole.ADMIN,
    ):
        raise AppError(
            403, "FORBIDDEN", "Only owners and admins can update workspace"
        )
    if not name:
        raise AppError(400, "VALIDATION_ERROR", "Nothing to update")

    ws = await session.get(Workspace, workspace_id)
    if not ws:
        raise AppError(404, "NOT_FOUND", "Workspace not found")
    ws.name = name
    await session.commit()
    await session.refresh(ws)
    return _workspace_json(ws)


def map_workspace_member_json(
    membership: WorkspaceMember, workspace_id: str
) -> dict:
    user = membership.user
    return {
        "id": user.id,
        "membershipId": membership.id,
        "email": user.email,
        "fullName": user.full_name,
        "avatarUrl": user.avatar_url,
        "role": membership.role.value,
        "status": membership.status.value,
        "joinedAt": membership.joined_at.isoformat() if membership.joined_at else None,
        "presence": get_presence(workspace_id, user.id),
    }


async def get_active_member_json(
    session: AsyncSession, workspace_id: str, user_id: str
) -> dict:
    membership = await session.scalar(
        select(WorkspaceMember)
        .where(
            WorkspaceMember.workspace_id == workspace_id,
            WorkspaceMember.user_id == user_id,
            WorkspaceMember.status == MemberStatus.ACTIVE,
        )
        .options(selectinload(WorkspaceMember.user))
    )
    if not membership:
        raise AppError(404, "NOT_FOUND", "Workspace member not found")
    return map_workspace_member_json(membership, workspace_id)


async def list_workspace_members(session: AsyncSession, workspace_id: str) -> list[dict]:
    rows = (
        await session.scalars(
            select(WorkspaceMember)
            .where(
                WorkspaceMember.workspace_id == workspace_id,
                WorkspaceMember.status == MemberStatus.ACTIVE,
            )
            .options(selectinload(WorkspaceMember.user))
            .order_by(WorkspaceMember.joined_at.asc())
        )
    ).all()
    return [map_workspace_member_json(m, workspace_id) for m in rows]


def _assert_can_manage_people(actor_role: WorkspaceRole) -> None:
    if actor_role not in (WorkspaceRole.OWNER, WorkspaceRole.ADMIN):
        raise AppError(
            403,
            "FORBIDDEN",
            "Only workspace owners and admins can manage people",
        )


def _assert_can_edit_target(actor_role: WorkspaceRole, target_role: WorkspaceRole) -> None:
    if actor_role == WorkspaceRole.ADMIN and target_role in (
        WorkspaceRole.OWNER,
        WorkspaceRole.ADMIN,
    ):
        raise AppError(
            403,
            "FORBIDDEN",
            "Admins cannot change owners or other admins",
        )


async def update_workspace_member(
    session: AsyncSession,
    workspace_id: str,
    actor_id: str,
    actor_role: WorkspaceRole,
    target_user_id: str,
    body: UpdateWorkspaceMemberBody,
) -> dict:
    _assert_can_manage_people(actor_role)

    if actor_role == WorkspaceRole.ADMIN and body.role in (
        WorkspaceRole.OWNER,
        WorkspaceRole.ADMIN,
    ):
        raise AppError(403, "FORBIDDEN", "Admins can only assign member or guest roles")

    target = await session.scalar(
        select(WorkspaceMember).where(
            WorkspaceMember.workspace_id == workspace_id,
            WorkspaceMember.user_id == target_user_id,
            WorkspaceMember.status == MemberStatus.ACTIVE,
        )
    )
    if not target:
        raise AppError(404, "NOT_FOUND", "Member not found")

    _assert_can_edit_target(actor_role, target.role)

    if target.role == WorkspaceRole.OWNER and body.role != WorkspaceRole.OWNER:
        owner_count = await session.scalar(
            select(func.count())
            .select_from(WorkspaceMember)
            .where(
                WorkspaceMember.workspace_id == workspace_id,
                WorkspaceMember.role == WorkspaceRole.OWNER,
                WorkspaceMember.status == MemberStatus.ACTIVE,
            )
        )
        if (owner_count or 0) <= 1:
            raise AppError(
                400,
                "VALIDATION_ERROR",
                "Cannot change role of the only workspace owner",
            )

    target.role = body.role
    await session.commit()
    return {"ok": True, "userId": target_user_id, "role": body.role.value}


async def remove_workspace_member(
    session: AsyncSession,
    workspace_id: str,
    actor_id: str,
    actor_role: WorkspaceRole,
    target_user_id: str,
) -> dict:
    _assert_can_manage_people(actor_role)

    target = await session.scalar(
        select(WorkspaceMember).where(
            WorkspaceMember.workspace_id == workspace_id,
            WorkspaceMember.user_id == target_user_id,
            WorkspaceMember.status == MemberStatus.ACTIVE,
        )
    )
    if not target:
        raise AppError(404, "NOT_FOUND", "Member not found")

    if target.role == WorkspaceRole.OWNER:
        raise AppError(403, "FORBIDDEN", "Cannot remove the workspace owner")

    _assert_can_edit_target(actor_role, target.role)

    if target_user_id == actor_id:
        raise AppError(
            400,
            "VALIDATION_ERROR",
            "Use another admin to remove yourself from the workspace",
        )

    await session.delete(target)
    await session.commit()
    return {"ok": True}


async def _get_active_owner_membership(
    session: AsyncSession, workspace_id: str, user_id: str
) -> WorkspaceMember:
    membership = await session.scalar(
        select(WorkspaceMember).where(
            WorkspaceMember.workspace_id == workspace_id,
            WorkspaceMember.user_id == user_id,
            WorkspaceMember.status == MemberStatus.ACTIVE,
        )
    )
    if not membership or membership.role != WorkspaceRole.OWNER:
        raise AppError(
            403,
            "FORBIDDEN",
            "Only the workspace owner can perform this action",
        )
    return membership


async def delete_workspace(
    session: AsyncSession,
    workspace_id: str,
    user_id: str,
    confirm_name: str,
) -> dict:
    await _get_active_owner_membership(session, workspace_id, user_id)

    ws = await session.get(Workspace, workspace_id)
    if not ws:
        raise AppError(404, "NOT_FOUND", "Workspace not found")

    if confirm_name.strip() != ws.name.strip():
        raise AppError(
            400,
            "VALIDATION_ERROR",
            "Workspace name does not match",
        )

    # ORM delete(ws) nullifies member FKs; use DB CASCADE instead.
    await session.execute(delete(Workspace).where(Workspace.id == workspace_id))
    await session.commit()
    return {"ok": True}


async def transfer_workspace_ownership(
    session: AsyncSession,
    workspace_id: str,
    actor_id: str,
    new_owner_user_id: str,
) -> dict:
    if actor_id == new_owner_user_id:
        raise AppError(
            400,
            "VALIDATION_ERROR",
            "Choose a different member to transfer ownership",
        )

    actor = await _get_active_owner_membership(session, workspace_id, actor_id)

    target = await session.scalar(
        select(WorkspaceMember).where(
            WorkspaceMember.workspace_id == workspace_id,
            WorkspaceMember.user_id == new_owner_user_id,
            WorkspaceMember.status == MemberStatus.ACTIVE,
        )
    )
    if not target:
        raise AppError(404, "NOT_FOUND", "Member not found")

    actor.role = WorkspaceRole.ADMIN
    target.role = WorkspaceRole.OWNER
    await session.commit()
    return {
        "ok": True,
        "newOwnerUserId": new_owner_user_id,
        "previousOwnerUserId": actor_id,
    }
