from fastapi import APIRouter, HTTPException, Query, status

from app.deps.auth import CurrentUserDep, DbSession
from app.deps.workspace import WorkspaceMemberDep
from app.schemas.planning import (
    CreateAutomationRuleBody,
    CreatePortfolioBody,
    CreateTemplateBody,
    CreateWhiteboardBody,
    InstantiateTemplateBody,
    UpdateAutomationRuleBody,
    UpdatePortfolioBody,
    UpdateWhiteboardBody,
)
from app.services import planning_service

router = APIRouter(prefix="/workspaces/{workspace_id}", tags=["planning"])


# --- TEMPLATES ---
@router.get("/templates")
async def get_templates(
    workspace_id: str,
    session: DbSession,
    _user: CurrentUserDep,
    _member: WorkspaceMemberDep,
    scope: str | None = Query(None),
):
    return await planning_service.list_templates(session, workspace_id, scope)


@router.post("/templates")
async def post_template(
    body: CreateTemplateBody,
    workspace_id: str,
    session: DbSession,
    user: CurrentUserDep,
    _member: WorkspaceMemberDep,
):
    return await planning_service.create_template(session, workspace_id, user.id, body)


@router.post("/templates/{template_id}/instantiate")
async def post_instantiate_template(
    body: InstantiateTemplateBody,
    workspace_id: str,
    template_id: str,
    session: DbSession,
    user: CurrentUserDep,
    _member: WorkspaceMemberDep,
):
    try:
        return await planning_service.instantiate_template(session, workspace_id, user.id, template_id, body)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


# --- PORTFOLIOS ---
@router.get("/portfolios")
async def get_portfolios(
    workspace_id: str,
    session: DbSession,
    _user: CurrentUserDep,
    _member: WorkspaceMemberDep,
):
    return await planning_service.list_portfolios(session, workspace_id)


@router.post("/portfolios")
async def post_portfolio(
    body: CreatePortfolioBody,
    workspace_id: str,
    session: DbSession,
    user: CurrentUserDep,
    _member: WorkspaceMemberDep,
):
    return await planning_service.create_portfolio(session, workspace_id, user.id, body)


@router.get("/portfolios/{portfolio_id}/summary")
async def get_portfolio_summary(
    workspace_id: str,
    portfolio_id: str,
    session: DbSession,
    _user: CurrentUserDep,
    _member: WorkspaceMemberDep,
):
    try:
        return await planning_service.get_portfolio_summary(session, workspace_id, portfolio_id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


# --- GANTT CHART & MILESTONES ---
@router.get("/planning/gantt")
async def get_gantt(
    workspace_id: str,
    session: DbSession,
    _user: CurrentUserDep,
    _member: WorkspaceMemberDep,
    spaceId: str | None = Query(None),
    listId: str | None = Query(None),
):
    return await planning_service.get_gantt_data(session, workspace_id, spaceId, listId)


# --- WORKLOAD MANAGEMENT ---
@router.get("/planning/workload")
async def get_workload(
    workspace_id: str,
    session: DbSession,
    _user: CurrentUserDep,
    _member: WorkspaceMemberDep,
):
    return await planning_service.get_workload_summary(session, workspace_id)


# --- AUTOMATIONS ---
@router.get("/automations")
async def get_automations(
    workspace_id: str,
    session: DbSession,
    _user: CurrentUserDep,
    _member: WorkspaceMemberDep,
):
    return await planning_service.list_automations(session, workspace_id)


@router.post("/automations")
async def post_automation(
    body: CreateAutomationRuleBody,
    workspace_id: str,
    session: DbSession,
    _user: CurrentUserDep,
    _member: WorkspaceMemberDep,
):
    return await planning_service.create_automation(session, workspace_id, body)


# --- WHITEBOARDS ---
@router.get("/whiteboards")
async def get_whiteboards(
    workspace_id: str,
    session: DbSession,
    _user: CurrentUserDep,
    _member: WorkspaceMemberDep,
):
    return await planning_service.list_whiteboards(session, workspace_id)


@router.post("/whiteboards")
async def post_whiteboard(
    body: CreateWhiteboardBody,
    workspace_id: str,
    session: DbSession,
    user: CurrentUserDep,
    _member: WorkspaceMemberDep,
):
    return await planning_service.create_whiteboard(session, workspace_id, user.id, body)


@router.patch("/whiteboards/{whiteboard_id}")
async def patch_whiteboard(
    body: UpdateWhiteboardBody,
    workspace_id: str,
    whiteboard_id: str,
    session: DbSession,
    _user: CurrentUserDep,
    _member: WorkspaceMemberDep,
):
    try:
        return await planning_service.update_whiteboard(session, workspace_id, whiteboard_id, body)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
