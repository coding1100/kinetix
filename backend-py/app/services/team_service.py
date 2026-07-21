"""Workspace teams: CRUD, membership, and member team lookups."""

from __future__ import annotations

import uuid

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.models.enums import MemberStatus, TeamRole, WorkspaceRole
from app.db.models.team import Team, TeamMember
from app.db.models.workspace import WorkspaceMember
from app.core.errors import AppError
from app.schemas.team import AddTeamMemberBody, CreateTeamBody, UpdateTeamBody

TEAM_COLORS = [
    "#7B68EE",
    "#F97316",
    "#22C55E",
    "#3B82F6",
    "#EC4899",
    "#14B8A6",
    "#EAB308",
    "#8B5CF6",
]


def _default_icon(name: str) -> str:
    stripped = name.strip()
    return stripped[0].upper() if stripped else "T"


def _member_preview(member: TeamMember) -> dict:
    user = member.user
    return {
        "id": user.id,
        "fullName": user.full_name,
        "avatarUrl": user.avatar_url,
        "role": member.role.value,
    }


def _team_summary(team: Team) -> dict:
    members = team.members or []
    return {
        "id": team.id,
        "name": team.name,
        "color": team.color,
        "icon": team.icon or _default_icon(team.name),
        "description": team.description,
        "memberCount": len(members),
        "membersPreview": [_member_preview(m) for m in members[:5]],
        "createdAt": team.created_at.isoformat() if team.created_at else None,
        "createdBy": (
            {
                "id": team.created_by.id,
                "fullName": team.created_by.full_name,
                "avatarUrl": team.created_by.avatar_url,
            }
            if team.created_by
            else None
        ),
    }


def _team_detail(team: Team) -> dict:
    body = _team_summary(team)
    body["members"] = [_member_preview(m) for m in (team.members or [])]
    body["updatedAt"] = team.updated_at.isoformat() if team.updated_at else None
    return body


async def _get_team(
    session: AsyncSession, workspace_id: str, team_id: str
) -> Team | None:
    return await session.scalar(
        select(Team)
        .where(Team.id == team_id, Team.workspace_id == workspace_id)
        .options(
            selectinload(Team.members).selectinload(TeamMember.user),
            selectinload(Team.created_by),
        )
        .execution_options(populate_existing=True)
    )


async def _assert_workspace_member(
    session: AsyncSession, workspace_id: str, user_id: str
) -> WorkspaceMember:
    member = await session.scalar(
        select(WorkspaceMember).where(
            WorkspaceMember.workspace_id == workspace_id,
            WorkspaceMember.user_id == user_id,
            WorkspaceMember.status == MemberStatus.ACTIVE,
        )
    )
    if not member:
        raise AppError(403, "FORBIDDEN", "Not a workspace member")
    return member


async def _assert_can_manage_team(
    session: AsyncSession,
    workspace_id: str,
    actor_id: str,
    actor_role: WorkspaceRole,
    team_id: str,
) -> None:
    from app.services.workspace_permissions import can_manage_teams

    if can_manage_teams(actor_role):
        return
    lead = await session.scalar(
        select(TeamMember).where(
            TeamMember.team_id == team_id,
            TeamMember.user_id == actor_id,
            TeamMember.role == TeamRole.LEAD,
        )
    )
    if not lead:
        raise AppError(403, "FORBIDDEN", "Only workspace admins or team leads can manage this team")


async def _validate_member_ids(
    session: AsyncSession, workspace_id: str, user_ids: list[str]
) -> None:
    if not user_ids:
        return
    unique = list(dict.fromkeys(user_ids))
    count = await session.scalar(
        select(func.count())
        .select_from(WorkspaceMember)
        .where(
            WorkspaceMember.workspace_id == workspace_id,
            WorkspaceMember.user_id.in_(unique),
            WorkspaceMember.status == MemberStatus.ACTIVE,
        )
    )
    if count != len(unique):
        raise AppError(400, "VALIDATION_ERROR", "One or more members are not in this workspace")


async def list_teams(
    session: AsyncSession,
    workspace_id: str,
    *,
    sort: str = "name",
    order: str = "asc",
) -> list[dict]:
    if sort == "members":
        stmt = (
            select(Team)
            .where(Team.workspace_id == workspace_id)
            .outerjoin(TeamMember)
            .group_by(Team.id)
            .options(
                selectinload(Team.members).selectinload(TeamMember.user),
                selectinload(Team.created_by),
            )
            .order_by(
                func.count(TeamMember.id).desc()
                if order == "desc"
                else func.count(TeamMember.id).asc()
            )
        )
    elif sort == "created":
        stmt = (
            select(Team)
            .where(Team.workspace_id == workspace_id)
            .options(
                selectinload(Team.members).selectinload(TeamMember.user),
                selectinload(Team.created_by),
            )
            .order_by(
                Team.created_at.desc() if order == "desc" else Team.created_at.asc()
            )
        )
    else:
        stmt = (
            select(Team)
            .where(Team.workspace_id == workspace_id)
            .options(
                selectinload(Team.members).selectinload(TeamMember.user),
                selectinload(Team.created_by),
            )
            .order_by(Team.name.desc() if order == "desc" else Team.name.asc())
        )

    rows = (await session.scalars(stmt)).unique().all()
    return [_team_summary(t) for t in rows]


async def list_my_teams(
    session: AsyncSession, workspace_id: str, user_id: str
) -> list[dict]:
    rows = (
        await session.scalars(
            select(Team)
            .join(TeamMember, TeamMember.team_id == Team.id)
            .where(
                Team.workspace_id == workspace_id,
                TeamMember.user_id == user_id,
            )
            .options(
                selectinload(Team.members).selectinload(TeamMember.user),
                selectinload(Team.created_by),
            )
            .order_by(Team.name.asc())
        )
    ).unique().all()
    return [_team_summary(t) for t in rows]


async def get_team(
    session: AsyncSession, workspace_id: str, team_id: str
) -> dict:
    team = await _get_team(session, workspace_id, team_id)
    if not team:
        raise AppError(404, "NOT_FOUND", "Team not found")
    return _team_detail(team)


async def create_team(
    session: AsyncSession,
    workspace_id: str,
    actor_id: str,
    body: CreateTeamBody,
) -> dict:
    await _assert_workspace_member(session, workspace_id, actor_id)
    member_ids = list(dict.fromkeys(body.member_ids))
    if actor_id not in member_ids:
        member_ids.insert(0, actor_id)
    await _validate_member_ids(session, workspace_id, member_ids)

    color = body.color or TEAM_COLORS[len(member_ids) % len(TEAM_COLORS)]
    team = Team(
        id=str(uuid.uuid4()),
        workspace_id=workspace_id,
        name=body.name.strip(),
        color=color,
        icon=body.icon or _default_icon(body.name),
        description=body.description,
        created_by_id=actor_id,
    )
    session.add(team)
    await session.flush()

    for uid in member_ids:
        role = TeamRole.LEAD if uid == actor_id else TeamRole.MEMBER
        session.add(
            TeamMember(
                id=str(uuid.uuid4()),
                team_id=team.id,
                user_id=uid,
                role=role,
            )
        )

    await session.commit()
    new_team_id = team.id
    refreshed = await _get_team(session, workspace_id, new_team_id)
    assert refreshed is not None
    return _team_detail(refreshed)


async def update_team(
    session: AsyncSession,
    workspace_id: str,
    team_id: str,
    actor_id: str,
    actor_role: WorkspaceRole,
    body: UpdateTeamBody,
) -> dict:
    team = await _get_team(session, workspace_id, team_id)
    if not team:
        raise AppError(404, "NOT_FOUND", "Team not found")
    await _assert_can_manage_team(session, workspace_id, actor_id, actor_role, team_id)

    if body.name is not None:
        team.name = body.name.strip()
    if body.color is not None:
        team.color = body.color
    if body.icon is not None:
        team.icon = body.icon
    if body.description is not None:
        team.description = body.description

    await session.commit()
    refreshed = await _get_team(session, workspace_id, team_id)
    assert refreshed is not None
    return _team_detail(refreshed)


async def delete_team(
    session: AsyncSession,
    workspace_id: str,
    team_id: str,
    actor_id: str,
    actor_role: WorkspaceRole,
) -> dict:
    team = await _get_team(session, workspace_id, team_id)
    if not team:
        raise AppError(404, "NOT_FOUND", "Team not found")
    await _assert_can_manage_team(session, workspace_id, actor_id, actor_role, team_id)
    await session.delete(team)
    await session.commit()
    return {"ok": True}


async def add_team_member(
    session: AsyncSession,
    workspace_id: str,
    team_id: str,
    actor_id: str,
    actor_role: WorkspaceRole,
    body: AddTeamMemberBody,
) -> dict:
    team = await _get_team(session, workspace_id, team_id)
    if not team:
        raise AppError(404, "NOT_FOUND", "Team not found")
    await _assert_can_manage_team(session, workspace_id, actor_id, actor_role, team_id)
    await _validate_member_ids(session, workspace_id, [body.user_id])

    existing = await session.scalar(
        select(TeamMember).where(
            TeamMember.team_id == team_id,
            TeamMember.user_id == body.user_id,
        )
    )
    if existing:
        raise AppError(409, "CONFLICT", "User is already on this team")

    session.add(
        TeamMember(
            id=str(uuid.uuid4()),
            team_id=team_id,
            user_id=body.user_id,
            role=body.role,
        )
    )
    await session.commit()
    return await get_team(session, workspace_id, team_id)


async def remove_team_member(
    session: AsyncSession,
    workspace_id: str,
    team_id: str,
    target_user_id: str,
    actor_id: str,
    actor_role: WorkspaceRole,
) -> dict:
    team = await _get_team(session, workspace_id, team_id)
    if not team:
        raise AppError(404, "NOT_FOUND", "Team not found")
    await _assert_can_manage_team(session, workspace_id, actor_id, actor_role, team_id)

    row = await session.scalar(
        select(TeamMember).where(
            TeamMember.team_id == team_id,
            TeamMember.user_id == target_user_id,
        )
    )
    if not row:
        raise AppError(404, "NOT_FOUND", "Team member not found")

    await session.delete(row)
    await session.commit()
    return await get_team(session, workspace_id, team_id)


async def member_teams_map(
    session: AsyncSession, workspace_id: str
) -> dict[str, list[dict]]:
    rows = (
        await session.execute(
            select(TeamMember.user_id, Team.id, Team.name, Team.color, Team.icon)
            .join(Team, Team.id == TeamMember.team_id)
            .where(Team.workspace_id == workspace_id)
            .order_by(Team.name.asc())
        )
    ).all()
    out: dict[str, list[dict]] = {}
    for user_id, team_id, name, color, icon in rows:
        out.setdefault(user_id, []).append(
            {
                "id": team_id,
                "name": name,
                "color": color,
                "icon": icon or _default_icon(name),
            }
        )
    return out
