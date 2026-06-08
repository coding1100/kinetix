import re
import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.core.errors import AppError
from app.db.models.chat import MessageAttachment
from app.services.s3_service import object_exists, presign_get, presign_put, put_object

_ALLOWED_KINDS = frozenset({"file", "video", "clip", "doc", "audio"})
_SAFE_NAME_RE = re.compile(r"[^a-zA-Z0-9._-]+")


def _sanitize_filename(name: str) -> str:
    base = (name or "file").strip().replace("\\", "/").split("/")[-1]
    cleaned = _SAFE_NAME_RE.sub("_", base).strip("._")
    return (cleaned or "file")[:180]


async def _assert_attachment_context(
    session: AsyncSession,
    workspace_id: str,
    user_id: str,
    context_type: str,
    context_id: str,
) -> None:
    from app.services import chat_service

    if context_type == "channel":
        await chat_service._assert_channel_member(session, context_id, user_id)
        return
    if context_type == "dm":
        await chat_service._assert_dm_participant(session, context_id, user_id)
        return
    raise AppError(400, "VALIDATION_ERROR", "Invalid attachment context")


async def presign_upload(
    session: AsyncSession,
    workspace_id: str,
    user_id: str,
    *,
    file_name: str,
    mime_type: str,
    size_bytes: int,
    kind: str,
    context_type: str,
    context_id: str,
) -> dict:
    settings = get_settings()
    if not settings.s3_configured:
        raise AppError(503, "SERVICE_UNAVAILABLE", "File storage is not configured")

    if kind not in _ALLOWED_KINDS:
        raise AppError(400, "VALIDATION_ERROR", "Invalid attachment kind")
    if size_bytes <= 0 or size_bytes > settings.attachment_max_bytes:
        raise AppError(400, "VALIDATION_ERROR", "File exceeds size limit")

    await _assert_attachment_context(
        session, workspace_id, user_id, context_type, context_id
    )

    attachment_id = str(uuid.uuid4())
    safe_name = _sanitize_filename(file_name)
    storage_key = (
        f"workspaces/{workspace_id}/chat/{context_type}/{context_id}/"
        f"{attachment_id}/{safe_name}"
    )

    row = MessageAttachment(
        id=attachment_id,
        workspace_id=workspace_id,
        channel_id=context_id if context_type == "channel" else None,
        conversation_id=context_id if context_type == "dm" else None,
        uploader_id=user_id,
        storage_key=storage_key,
        file_name=safe_name,
        mime_type=mime_type.strip() or "application/octet-stream",
        size_bytes=size_bytes,
        kind=kind,
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
        select(MessageAttachment).where(
            MessageAttachment.id == attachment_id,
            MessageAttachment.workspace_id == workspace_id,
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


async def complete_upload(
    session: AsyncSession,
    workspace_id: str,
    user_id: str,
    attachment_id: str,
) -> dict:
    row = await session.scalar(
        select(MessageAttachment).where(
            MessageAttachment.id == attachment_id,
            MessageAttachment.workspace_id == workspace_id,
        )
    )
    if not row or row.uploader_id != user_id:
        raise AppError(404, "NOT_FOUND", "Attachment not found")
    if row.status != "pending":
        return {"ok": True, "attachmentId": attachment_id, "status": row.status}

    if not object_exists(row.storage_key):
        raise AppError(400, "VALIDATION_ERROR", "Upload not found in storage")

    row.status = "ready"
    await session.commit()
    return {"ok": True, "attachmentId": attachment_id, "status": "ready"}


async def link_attachments_to_message(
    session: AsyncSession,
    workspace_id: str,
    user_id: str,
    message_id: str,
    attachment_ids: list[str],
) -> None:
    if not attachment_ids:
        return

    unique_ids = list(dict.fromkeys(attachment_ids))
    rows = (
        await session.scalars(
            select(MessageAttachment).where(
                MessageAttachment.id.in_(unique_ids),
                MessageAttachment.workspace_id == workspace_id,
                MessageAttachment.uploader_id == user_id,
                MessageAttachment.message_id.is_(None),
            )
        )
    ).all()

    if len(rows) != len(unique_ids):
        raise AppError(400, "VALIDATION_ERROR", "Invalid or expired attachment")

    for row in rows:
        if row.status != "ready":
            if row.status == "pending" and object_exists(row.storage_key):
                row.status = "ready"
            else:
                raise AppError(400, "VALIDATION_ERROR", "Attachment upload incomplete")
        row.message_id = message_id

    await session.flush()


def map_attachment(row: MessageAttachment) -> dict:
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
        "kind": row.kind,
        "downloadUrl": download_url,
    }


async def list_channel_files(
    session: AsyncSession,
    workspace_id: str,
    user_id: str,
    channel_id: str,
) -> dict:
    from app.services import chat_service

    await chat_service._assert_channel_member(session, channel_id, user_id)
    rows = (
        await session.scalars(
            select(MessageAttachment)
            .where(
                MessageAttachment.workspace_id == workspace_id,
                MessageAttachment.channel_id == channel_id,
                MessageAttachment.message_id.is_not(None),
                MessageAttachment.status == "ready",
            )
            .order_by(MessageAttachment.created_at.desc())
            .limit(200)
        )
    ).all()
    return {"data": [map_attachment(r) for r in rows]}
