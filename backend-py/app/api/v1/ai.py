from fastapi import APIRouter, Request
from pydantic import BaseModel, Field

from app.config import get_settings
from app.core.rate_limit import throttle
from app.deps.auth import CurrentUserDep, DbSession
from app.deps.workspace import WorkspaceMemberDep
from app.services import catch_up_service, rag_knowledge_service

router = APIRouter(prefix="/workspaces/{workspace_id}/ai", tags=["ai"])


class CatchUpBody(BaseModel):
    conversationType: str = Field(..., description="'channel' or 'dm'")
    conversationId: str
    limit: int = Field(default=50, ge=5, le=200)


class KnowledgeQueryBody(BaseModel):
    query: str = Field(..., min_length=1, max_length=1000)
    topK: int = Field(default=4, ge=1, le=10)


@router.post("/catch-up")
async def catch_up(
    body: CatchUpBody,
    workspace_id: str,
    request: Request,
    session: DbSession,
    user: CurrentUserDep,
    member: WorkspaceMemberDep,
):
    settings = get_settings()
    await throttle(
        request,
        scope="ai.catch_up",
        ip_limit=settings.ai_catch_up_ip_limit,
        account_limit=settings.ai_catch_up_account_limit,
        account=user.id,
        window_seconds=settings.ai_rate_limit_window_seconds,
    )
    result = await catch_up_service.generate_conversation_catch_up(
        session=session,
        workspace_id=member.id,
        user_id=user.id,
        conversation_type=body.conversationType,
        conversation_id=body.conversationId,
        limit=body.limit,
    )
    return result


@router.post("/knowledge-query")
async def knowledge_query(
    body: KnowledgeQueryBody,
    workspace_id: str,
    request: Request,
    session: DbSession,
    user: CurrentUserDep,
    member: WorkspaceMemberDep,
):
    settings = get_settings()
    await throttle(
        request,
        scope="ai.knowledge_query",
        ip_limit=settings.ai_knowledge_query_ip_limit,
        account_limit=settings.ai_knowledge_query_account_limit,
        account=user.id,
        window_seconds=settings.ai_rate_limit_window_seconds,
    )
    result = await rag_knowledge_service.query_company_knowledge_base(
        session=session,
        workspace_id=member.id,
        user_id=user.id,
        query=body.query,
        top_k=body.topK,
    )
    return result
