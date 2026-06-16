import re
import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.core.errors import AppError
from app.db.models.home import Space, Task, TaskAttachment, TaskList
from app.services.s3_service import object_exists, presign_get, presign_put, put_object

_SAFE_NAME_RE = re.compile(r"[^a-zA-Z0-9._-]+")


def _sanitize_filename(name: str) -> str:
    base = (name or "file").strip().replace("\\", "/").split("/")[-1]
    cleaned = _SAFE_NAME_RE.sub("_", base).strip("._")
    return (cleaned or "file")[:180]


async def _assert_task_in_workspace(
    session: AsyncSession, workspace_id: str, task_id: str
) -> Task:
    task = await session.scalar(
        select(Task)
        .join(Task.task_list)
        .join(TaskList.space)
        .where(Task.id == task_id, Space.workspace_id == workspace_id)
    )
    if not task:
        raise AppError(404, "NOT_FOUND", "Task not found")
    return task


async def presign_upload(
    session: AsyncSession,
    workspace_id: str,
    user_id: str,
    task_id: str,
    *,
    file_name: str,
    mime_type: str,
    size_bytes: int,
) -> dict:
    settings = get_settings()
    if not settings.s3_configured:
        raise AppError(503, "SERVICE_UNAVAILABLE", "File storage is not configured")

    if size_bytes <= 0 or size_bytes > settings.attachment_max_bytes:
        raise AppError(400, "VALIDATION_ERROR", "File exceeds size limit")

    await _assert_task_in_workspace(session, workspace_id, task_id)

    attachment_id = str(uuid.uuid4())
    safe_name = _sanitize_filename(file_name)
    storage_key = (
        f"workspaces/{workspace_id}/tasks/{task_id}/{attachment_id}/{safe_name}"
    )

    row = TaskAttachment(
        id=attachment_id,
        task_id=task_id,
        workspace_id=workspace_id,
        uploader_id=user_id,
        storage_key=storage_key,
        file_name=safe_name,
        mime_type=mime_type.strip() or "application/octet-stream",
        size_bytes=size_bytes,
        status="pending",
    )
    session.add(row)
    await session.commit()

    upload_url = presign_put(storage_key, row.mime_type)
    return {
        "attachmentId": attachment_id,
        "uploadUrl": upload_url,
        "storageKey": storage_key,
        "expiresIn": settings.s3_presign_expires_seconds,
    }


async def upload_file_content(
    session: AsyncSession,
    workspace_id: str,
    user_id: str,
    attachment_id: str,
    data: bytes,
    content_type: str | None = None,
) -> dict:
    row = await session.scalar(
        select(TaskAttachment).where(
            TaskAttachment.id == attachment_id,
            TaskAttachment.workspace_id == workspace_id,
        )
    )
    if not row or row.uploader_id != user_id:
        raise AppError(404, "NOT_FOUND", "Attachment not found")
    if row.status not in {"pending", "ready"}:
        raise AppError(400, "VALIDATION_ERROR", "Attachment is no longer uploadable")

    settings = get_settings()
    if len(data) <= 0 or len(data) > settings.attachment_max_bytes:
        raise AppError(400, "VALIDATION_ERROR", "File exceeds size limit")

    mime = (content_type or row.mime_type or "application/octet-stream").strip()
    put_object(row.storage_key, data, mime)
    row.mime_type = mime
    row.size_bytes = len(data)
    row.status = "ready"
    await session.commit()
    return {"ok": True, "attachmentId": attachment_id, "status": "ready"}


def map_task_attachment(row: TaskAttachment) -> dict:
    download_url = None
    if row.status == "ready":
        try:
            download_url = presign_get(row.storage_key, row.file_name)
        except Exception:
            download_url = None
    return {
        "id": row.id,
        "fileName": row.file_name,
        "mimeType": row.mime_type,
        "sizeBytes": row.size_bytes,
        "status": row.status,
        "downloadUrl": download_url,
        "createdAt": row.created_at.isoformat() if row.created_at else None,
    }
