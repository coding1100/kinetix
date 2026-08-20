from fastapi import APIRouter, Request
from pydantic import BaseModel, Field

from app.deps.auth import CurrentUserDep, DbSession
from app.services import catch_up_service, rag_knowledge_service

router = APIRouter(prefix="/ai", tags=["ai"])


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
    request: Request,
    session: DbSession,
    user: CurrentUserDep,
):
    workspace_id = request.headers.get("x-workspace-id")
    if not workspace_id and user.workspaces:
        workspace_id = user.workspaces[0].id

    result = await catch_up_service.generate_conversation_catch_up(
        session=session,
        workspace_id=workspace_id or "",
        user_id=user.id,
        conversation_type=body.conversationType,
        conversation_id=body.conversationId,
        limit=body.limit,
    )
    return result


@router.post("/knowledge-query")
async def knowledge_query(
    body: KnowledgeQueryBody,
    request: Request,
    session: DbSession,
    user: CurrentUserDep,
):
    workspace_id = request.headers.get("x-workspace-id")
    if not workspace_id and user.workspaces:
        workspace_id = user.workspaces[0].id

    result = await rag_knowledge_service.query_company_knowledge_base(
        session=session,
        workspace_id=workspace_id or "",
        user_id=user.id,
        query=body.query,
        top_k=body.topK,
    )
    return result
