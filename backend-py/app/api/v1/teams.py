from fastapi import APIRouter, Query, status

from app.deps.auth import CurrentUserDep, DbSession
from app.deps.workspace import WorkspaceMemberDep
from app.schemas.team import AddTeamMemberBody, CreateTeamBody, UpdateTeamBody
from app.services import team_service

router = APIRouter(prefix="/workspaces/{workspace_id}/teams", tags=["teams"])


@router.get("")
async def list_teams(
    workspace_id: str,
    session: DbSession,
    user: CurrentUserDep,
    _member: WorkspaceMemberDep,
    sort: str = Query("name", pattern="^(name|created|members)$"),
    order: str = Query("asc", pattern="^(asc|desc)$"),
):
    data = await team_service.list_teams(
        session, workspace_id, sort=sort, order=order
    )
    return {"data": data}


@router.get("/mine")
async def list_my_teams(
    workspace_id: str,
    session: DbSession,
    user: CurrentUserDep,
    _member: WorkspaceMemberDep,
):
    data = await team_service.list_my_teams(session, workspace_id, user.id)
    return {"data": data}


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_team(
    body: CreateTeamBody,
    workspace_id: str,
    session: DbSession,
    user: CurrentUserDep,
    _member: WorkspaceMemberDep,
):
    return await team_service.create_team(session, workspace_id, user.id, body)


@router.get("/{team_id}")
async def get_team(
    workspace_id: str,
    team_id: str,
    session: DbSession,
    user: CurrentUserDep,
    _member: WorkspaceMemberDep,
):
    return await team_service.get_team(session, workspace_id, team_id)


@router.patch("/{team_id}")
async def update_team(
    body: UpdateTeamBody,
    workspace_id: str,
    team_id: str,
    session: DbSession,
    user: CurrentUserDep,
    member: WorkspaceMemberDep,
):
    return await team_service.update_team(
        session, workspace_id, team_id, user.id, member.role, body
    )


@router.delete("/{team_id}")
async def delete_team(
    workspace_id: str,
    team_id: str,
    session: DbSession,
    user: CurrentUserDep,
    member: WorkspaceMemberDep,
):
    return await team_service.delete_team(
        session, workspace_id, team_id, user.id, member.role
    )


@router.post("/{team_id}/members")
async def add_team_member(
    body: AddTeamMemberBody,
    workspace_id: str,
    team_id: str,
    session: DbSession,
    user: CurrentUserDep,
    member: WorkspaceMemberDep,
):
    return await team_service.add_team_member(
        session, workspace_id, team_id, user.id, member.role, body
    )


@router.delete("/{team_id}/members/{target_user_id}")
async def remove_team_member(
    workspace_id: str,
    team_id: str,
    target_user_id: str,
    session: DbSession,
    user: CurrentUserDep,
    member: WorkspaceMemberDep,
):
    return await team_service.remove_team_member(
        session, workspace_id, team_id, target_user_id, user.id, member.role
    )
