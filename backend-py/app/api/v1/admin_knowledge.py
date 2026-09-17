import os
import re
import zlib
from fastapi import APIRouter, File, Form, UploadFile
from pydantic import BaseModel, Field

from app.core.errors import AppError
from app.deps.auth import CurrentUserDep, DbSession
from app.deps.workspace import WorkspaceMemberDep
from app.services import rag_knowledge_service

router = APIRouter(prefix="/workspaces/{workspace_id}/admin/knowledge-base", tags=["admin-knowledge"])


def extract_text_from_file_bytes(filename: str, data: bytes) -> str:
    ext = os.path.splitext(filename)[1].lower()
    if ext == ".pdf":
        extracted: list[str] = []
        # Find all stream objects
        streams = re.findall(b"stream[\r\n]+(.*?)[\r\n]+endstream", data, re.DOTALL)
        for s in streams:
            chunk = s
            try:
                chunk = zlib.decompress(s)
            except Exception:
                pass
            # Look for literal string text operations: (text) Tj
            tjs = re.findall(rb"\((.*?)\)\s*Tj", chunk)
            for t in tjs:
                try:
                    dec = t.decode("utf-8", errors="ignore").strip()
                    if dec:
                        extracted.append(dec)
                except Exception:
                    pass
            # Look for bracketed array text [(text)...] TJ
            array_tjs = re.findall(rb"\[(.*?)\]\s*TJ", chunk)
            for at in array_tjs:
                sub_strings = re.findall(rb"\((.*?)\)", at)
                for st in sub_strings:
                    try:
                        dec = st.decode("utf-8", errors="ignore").strip()
                        if dec:
                            extracted.append(dec)
                    except Exception:
                        pass
        full_text = " ".join(extracted).strip()
        if len(full_text) > 30:
            return full_text
        # Fallback: scan for readable ASCII tokens
        tokens = re.findall(rb"[A-Za-z0-9 ,.!?:;\-_/]{4,}", data)
        readable = [t.decode("ascii", errors="ignore").strip() for t in tokens if len(t.strip()) > 3]
        return " ".join(readable)

    # Standard text, markdown, json, csv
    try:
        return data.decode("utf-8")
    except UnicodeDecodeError:
        return data.decode("latin-1", errors="replace")


class CreateDocumentBody(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    category: str = Field(default="General", max_length=100)
    content: str = Field(..., min_length=1)
    fileType: str = Field(default="text", max_length=50)


@router.post("/documents", status_code=201)
async def create_document(
    body: CreateDocumentBody,
    workspace_id: str,
    session: DbSession,
    user: CurrentUserDep,
    member: WorkspaceMemberDep,
):
    doc = await rag_knowledge_service.create_company_document(
        session=session,
        workspace_id=member.id,
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


@router.post("/upload", status_code=201)
async def upload_document(
    workspace_id: str,
    session: DbSession,
    user: CurrentUserDep,
    member: WorkspaceMemberDep,
    file: UploadFile = File(...),
    title: str | None = Form(None),
    category: str = Form("General"),
):
    contents = await file.read()
    if not contents:
        raise AppError(400, "BAD_REQUEST", "Uploaded file is empty")

    filename = file.filename or "uploaded_document"
    doc_title = (title or "").strip()
    if not doc_title:
        base = os.path.splitext(filename)[0]
        doc_title = base.replace("-", " ").replace("_", " ").title()

    extracted_text = extract_text_from_file_bytes(filename, contents).strip()
    if not extracted_text:
        raise AppError(400, "BAD_REQUEST", f"Could not extract readable text from '{filename}'")

    file_ext = os.path.splitext(filename)[1].lower().lstrip(".") or "text"
    doc = await rag_knowledge_service.create_company_document(
        session=session,
        workspace_id=member.id,
        user_id=user.id,
        title=doc_title,
        category=category or "General",
        content=extracted_text,
        file_type=file_ext,
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
    workspace_id: str,
    session: DbSession,
    user: CurrentUserDep,
    member: WorkspaceMemberDep,
):
    docs = await rag_knowledge_service.list_company_documents(
        session=session, workspace_id=member.id
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
    workspace_id: str,
    session: DbSession,
    user: CurrentUserDep,
    member: WorkspaceMemberDep,
):
    await rag_knowledge_service.delete_company_document(
        session=session,
        workspace_id=member.id,
        document_id=document_id,
    )
    return {"ok": True}
