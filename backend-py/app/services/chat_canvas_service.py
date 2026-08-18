from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.errors import AppError
from app.core.utils import as_aware_utc
from app.db.models.chat import ChatChannel
from app.db.models.chat_surfaces import ChatChannelCanvas
from app.schemas.chat import UpdateCanvasBody
from app.services.chat_service import _assert_channel_member


def _canvas_payload(canvas: ChatChannelCanvas, updated_by_name: str | None = None) -> dict:
    return {
        "id": canvas.id,
        "channelId": canvas.channel_id,
        "workspaceId": canvas.workspace_id,
        "title": canvas.title,
        "body": canvas.body,
        "revision": canvas.revision,
        "updatedAt": as_aware_utc(canvas.updated_at).isoformat(),
        "updatedById": canvas.updated_by_id,
        "updatedByName": updated_by_name,
        "createdAt": as_aware_utc(canvas.created_at).isoformat(),
    }


async def get_canvas(
    session: AsyncSession, workspace_id: str, user_id: str, channel_id: str
) -> dict:
    member = await _assert_channel_member(session, channel_id, user_id)
    if member.channel.workspace_id != workspace_id:
        raise AppError(404, "NOT_FOUND", "Channel not found")

    canvas = await session.scalar(
        select(ChatChannelCanvas)
        .where(
            ChatChannelCanvas.workspace_id == workspace_id,
            ChatChannelCanvas.channel_id == channel_id,
        )
        .options(selectinload(ChatChannelCanvas.updated_by))
    )
    if not canvas:
        return {
            "id": None,
            "channelId": channel_id,
            "workspaceId": workspace_id,
            "title": "Canvas",
            "body": "",
            "revision": 0,
            "updatedAt": None,
            "updatedById": None,
            "updatedByName": None,
            "createdAt": None,
        }
    return _canvas_payload(canvas, canvas.updated_by.full_name if canvas.updated_by else None)


async def update_canvas(
    session: AsyncSession,
    workspace_id: str,
    user_id: str,
    channel_id: str,
    body: UpdateCanvasBody,
) -> dict:
    member = await _assert_channel_member(session, channel_id, user_id)
    if member.channel.workspace_id != workspace_id:
        raise AppError(404, "NOT_FOUND", "Channel not found")

    # Serializing updates on the parent channel also protects the initial
    # canvas insert, where there is no canvas row to lock yet.
    await session.scalar(
        select(ChatChannel.id)
        .where(
            ChatChannel.id == channel_id,
            ChatChannel.workspace_id == workspace_id,
        )
        .with_for_update()
    )

    canvas = await session.scalar(
        select(ChatChannelCanvas).where(
            ChatChannelCanvas.workspace_id == workspace_id,
            ChatChannelCanvas.channel_id == channel_id,
        )
    )
    current_revision = canvas.revision if canvas else 0
    if (
        body.expectedRevision is not None
        and body.expectedRevision != current_revision
    ):
        raise AppError(
            409,
            "CANVAS_CONFLICT",
            "This canvas changed in another session. Review the latest version before saving.",
        )

    now = datetime.now(timezone.utc)
    title = body.title.strip() or "Canvas"
    if not canvas:
        canvas = ChatChannelCanvas(
            workspace_id=workspace_id,
            channel_id=channel_id,
            title=title,
            body=body.body,
            revision=1,
            updated_at=now,
            updated_by_id=user_id,
        )
        session.add(canvas)
    else:
        canvas.title = title
        canvas.body = body.body
        canvas.revision += 1
        canvas.updated_at = now
        canvas.updated_by_id = user_id

    await session.commit()
    loaded = await session.scalar(
        select(ChatChannelCanvas)
        .where(ChatChannelCanvas.id == canvas.id)
        .options(selectinload(ChatChannelCanvas.updated_by))
    )
    assert loaded is not None
    return _canvas_payload(
        loaded, loaded.updated_by.full_name if loaded.updated_by else None
    )
