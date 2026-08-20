from fastapi import APIRouter, Request
from pydantic import BaseModel, Field

from app.deps.auth import CurrentUserDep, DbSession
from app.services import rag_knowledge_service

router = APIRouter(prefix="/admin/knowledge-base", tags=["admin-knowledge"])


class CreateDocumentBody(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    category: str = Field(default="General", max_length=100)
    content: str = Field(..., min_length=1)
    fileType: str = Field(default="text", max_length=50)


@router.post("/documents", status_code=201)
async def create_document(
    body: CreateDocumentBody,
    request: Request,
    session: DbSession,
    user: CurrentUserDep,
):
    workspace_id = request.headers.get("x-workspace-id")
    if not workspace_id and user.workspaces:
        workspace_id = user.workspaces[0].id

    doc = await rag_knowledge_service.create_company_document(
        session=session,
        workspace_id=workspace_id or "",
        user_id=user.id,
        title=body.title,
        category=body.category,
        content=body.content,
        file_type=body.fileType,
    )
    return {
        "id": doc.id,
        "title": doc.title,
        "category": doc.category,
        "fileType": doc.file_type,
        "createdAt": doc.created_at.isoformat(),
    }


@router.get("/documents")
async def list_documents(
    request: Request,
    session: DbSession,
    user: CurrentUserDep,
):
    workspace_id = request.headers.get("x-workspace-id")
    if not workspace_id and user.workspaces:
        workspace_id = user.workspaces[0].id

    docs = await rag_knowledge_service.list_company_documents(
        session=session, workspace_id=workspace_id or ""
    )
    return {
        "data": [
            {
                "id": d.id,
                "title": d.title,
                "category": d.category,
                "fileType": d.file_type,
                "createdAt": d.created_at.isoformat(),
            }
            for d in docs
        ]
    }


@router.delete("/documents/{document_id}")
async def delete_document(
    document_id: str,
    request: Request,
    session: DbSession,
    user: CurrentUserDep,
):
    workspace_id = request.headers.get("x-workspace-id")
    if not workspace_id and user.workspaces:
        workspace_id = user.workspaces[0].id

    await rag_knowledge_service.delete_company_document(
        session=session,
        workspace_id=workspace_id or "",
        document_id=document_id,
    )
    return {"ok": True}
