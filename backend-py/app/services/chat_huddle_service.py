from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.errors import AppError
from app.core.utils import as_aware_utc
from app.db.models.chat_surfaces import ChatHuddle, ChatHuddleParticipant
from app.schemas.chat import StartHuddleBody, UpdateHuddleBody, ToggleHuddleParticipantBody
from app.services.chat_service import _assert_channel_member
from app.services.workspace_permissions import (
    get_active_workspace_role,
    is_workspace_admin as _role_is_workspace_admin,
)


def _participant_payload(participant: ChatHuddleParticipant) -> dict:
    user = participant.user
    return {
        "id": user.id,
        "fullName": user.full_name,
        "avatarUrl": user.avatar_url,
        "isDisabled": user.is_disabled,
        "joinedAt": as_aware_utc(participant.joined_at).isoformat(),
        "leftAt": as_aware_utc(participant.left_at).isoformat()
        if participant.left_at
        else None,
        "isMuted": participant.is_muted,
    }


def _huddle_payload(huddle: ChatHuddle, current_user_id: str | None = None) -> dict:
    active_participants = [
        p for p in huddle.participants if p.left_at is None
    ]
    return {
        "id": huddle.id,
        "channelId": huddle.channel_id,
        "workspaceId": huddle.workspace_id,
        "title": huddle.title,
        "notes": huddle.notes,
        "isActive": huddle.is_active,
        "startedAt": as_aware_utc(huddle.started_at).isoformat(),
        "endedAt": as_aware_utc(huddle.ended_at).isoformat() if huddle.ended_at else None,
        "startedById": huddle.started_by_id,
        "endedById": huddle.ended_by_id,
        "participantCount": len(active_participants),
        "participants": [_participant_payload(p) for p in active_participants],
        "currentUserJoined": any(
            p.user_id == current_user_id and p.left_at is None
            for p in active_participants
        ),
        "createdAt": as_aware_utc(huddle.created_at).isoformat(),
        "updatedAt": as_aware_utc(huddle.updated_at).isoformat(),
    }


async def _active_huddle(
    session: AsyncSession, workspace_id: str, channel_id: str
) -> ChatHuddle | None:
    return await session.scalar(
        select(ChatHuddle)
        .where(
            ChatHuddle.workspace_id == workspace_id,
            ChatHuddle.channel_id == channel_id,
            ChatHuddle.is_active.is_(True),
        )
        .options(selectinload(ChatHuddle.participants).selectinload(ChatHuddleParticipant.user))
        .order_by(ChatHuddle.started_at.desc())
    )


async def _recent_huddles(
    session: AsyncSession, workspace_id: str, channel_id: str, limit: int = 5
) -> list[ChatHuddle]:
    return list(
        (
            await session.scalars(
                select(ChatHuddle)
                .where(
                    ChatHuddle.workspace_id == workspace_id,
                    ChatHuddle.channel_id == channel_id,
                )
                .options(selectinload(ChatHuddle.participants).selectinload(ChatHuddleParticipant.user))
                .order_by(ChatHuddle.started_at.desc())
                .limit(limit)
            )
        ).all()
    )


async def list_huddles(
    session: AsyncSession, workspace_id: str, user_id: str, channel_id: str
) -> dict:
    member = await _assert_channel_member(session, channel_id, user_id)
    if member.channel.workspace_id != workspace_id:
        raise AppError(404, "NOT_FOUND", "Channel not found")

    current = await _active_huddle(session, workspace_id, channel_id)
    recent = await _recent_huddles(session, workspace_id, channel_id)
    return {
        "current": _huddle_payload(current, user_id) if current else None,
        "data": [_huddle_payload(h, user_id) for h in recent],
    }


async def start_huddle(
    session: AsyncSession,
    workspace_id: str,
    user_id: str,
    channel_id: str,
    body: StartHuddleBody,
) -> dict:
    member = await _assert_channel_member(session, channel_id, user_id)
    if member.channel.workspace_id != workspace_id:
        raise AppError(404, "NOT_FOUND", "Channel not found")

    current = await _active_huddle(session, workspace_id, channel_id)
    if current:
        raise AppError(409, "CONFLICT", "A huddle is already active")

    now = datetime.now(timezone.utc)
    huddle = ChatHuddle(
        workspace_id=workspace_id,
        channel_id=channel_id,
        title=body.title.strip(),
        notes=body.notes,
        is_active=True,
        started_at=now,
        updated_at=now,
        started_by_id=user_id,
    )
    session.add(huddle)
    await session.flush()
    session.add(
        ChatHuddleParticipant(
            huddle_id=huddle.id,
            user_id=user_id,
            joined_at=now,
            is_muted=False,
        )
    )
    await session.commit()
    loaded = await session.scalar(
        select(ChatHuddle)
        .where(ChatHuddle.id == huddle.id)
        .options(selectinload(ChatHuddle.participants).selectinload(ChatHuddleParticipant.user))
    )
    assert loaded is not None
    return _huddle_payload(loaded, user_id)


async def update_huddle(
    session: AsyncSession,
    workspace_id: str,
    user_id: str,
    channel_id: str,
    huddle_id: str,
    body: UpdateHuddleBody,
) -> dict:
    member = await _assert_channel_member(session, channel_id, user_id)
    if member.channel.workspace_id != workspace_id:
        raise AppError(404, "NOT_FOUND", "Channel not found")

    huddle = await session.scalar(
        select(ChatHuddle)
        .where(
            ChatHuddle.id == huddle_id,
            ChatHuddle.workspace_id == workspace_id,
            ChatHuddle.channel_id == channel_id,
        )
        .options(selectinload(ChatHuddle.participants).selectinload(ChatHuddleParticipant.user))
    )
    if not huddle:
        raise AppError(404, "NOT_FOUND", "Huddle not found")

    if body.title is not None:
        huddle.title = body.title.strip()
    if body.notes is not None:
        huddle.notes = body.notes
    if body.isActive is not None:
        huddle.is_active = body.isActive
        if not body.isActive and huddle.ended_at is None:
            huddle.ended_at = datetime.now(timezone.utc)
            huddle.ended_by_id = user_id
    huddle.updated_at = datetime.now(timezone.utc)
    await session.commit()
    await session.refresh(huddle)
    loaded = await session.scalar(
        select(ChatHuddle)
        .where(ChatHuddle.id == huddle.id)
        .options(selectinload(ChatHuddle.participants).selectinload(ChatHuddleParticipant.user))
    )
    assert loaded is not None
    return _huddle_payload(loaded, user_id)


async def join_huddle(
    session: AsyncSession,
    workspace_id: str,
    user_id: str,
    channel_id: str,
    huddle_id: str,
) -> dict:
    member = await _assert_channel_member(session, channel_id, user_id)
    if member.channel.workspace_id != workspace_id:
        raise AppError(404, "NOT_FOUND", "Channel not found")
    huddle = await session.scalar(
        select(ChatHuddle)
        .where(
            ChatHuddle.id == huddle_id,
            ChatHuddle.workspace_id == workspace_id,
            ChatHuddle.channel_id == channel_id,
        )
        .options(selectinload(ChatHuddle.participants).selectinload(ChatHuddleParticipant.user))
    )
    if not huddle or not huddle.is_active:
        raise AppError(404, "NOT_FOUND", "Huddle not found")

    participant = await session.scalar(
        select(ChatHuddleParticipant).where(
            ChatHuddleParticipant.huddle_id == huddle_id,
            ChatHuddleParticipant.user_id == user_id,
        )
    )
    now = datetime.now(timezone.utc)
    if participant:
        participant.left_at = None
        participant.joined_at = now
        participant.is_muted = False
    else:
        session.add(
            ChatHuddleParticipant(
                huddle_id=huddle_id,
                user_id=user_id,
                joined_at=now,
                is_muted=False,
            )
        )
    huddle.updated_at = now
    await session.commit()
    loaded = await session.scalar(
        select(ChatHuddle)
        .where(ChatHuddle.id == huddle.id)
        .options(selectinload(ChatHuddle.participants).selectinload(ChatHuddleParticipant.user))
    )
    assert loaded is not None
    return _huddle_payload(loaded, user_id)


async def leave_huddle(
    session: AsyncSession,
    workspace_id: str,
    user_id: str,
    channel_id: str,
    huddle_id: str,
) -> dict:
    member = await _assert_channel_member(session, channel_id, user_id)
    if member.channel.workspace_id != workspace_id:
        raise AppError(404, "NOT_FOUND", "Channel not found")
    huddle = await session.scalar(
        select(ChatHuddle)
        .where(
            ChatHuddle.id == huddle_id,
            ChatHuddle.workspace_id == workspace_id,
            ChatHuddle.channel_id == channel_id,
        )
        .options(selectinload(ChatHuddle.participants).selectinload(ChatHuddleParticipant.user))
    )
    if not huddle:
        raise AppError(404, "NOT_FOUND", "Huddle not found")

    participant = await session.scalar(
        select(ChatHuddleParticipant).where(
            ChatHuddleParticipant.huddle_id == huddle_id,
            ChatHuddleParticipant.user_id == user_id,
        )
    )
    if participant:
        participant.left_at = datetime.now(timezone.utc)
        participant.is_muted = False
        huddle.updated_at = datetime.now(timezone.utc)
        await session.commit()

    loaded = await session.scalar(
        select(ChatHuddle)
        .where(ChatHuddle.id == huddle.id)
        .options(selectinload(ChatHuddle.participants).selectinload(ChatHuddleParticipant.user))
    )
    assert loaded is not None
    return _huddle_payload(loaded, user_id)


async def end_huddle(
    session: AsyncSession,
    workspace_id: str,
    user_id: str,
    channel_id: str,
    huddle_id: str,
) -> dict:
    member = await _assert_channel_member(session, channel_id, user_id)
    if member.channel.workspace_id != workspace_id:
        raise AppError(404, "NOT_FOUND", "Channel not found")
    huddle = await session.scalar(
        select(ChatHuddle)
        .where(
            ChatHuddle.id == huddle_id,
            ChatHuddle.workspace_id == workspace_id,
            ChatHuddle.channel_id == channel_id,
        )
        .options(selectinload(ChatHuddle.participants).selectinload(ChatHuddleParticipant.user))
    )
    if not huddle:
        raise AppError(404, "NOT_FOUND", "Huddle not found")

    role = await get_active_workspace_role(session, workspace_id, user_id)
    is_admin = bool(role and _role_is_workspace_admin(role))
    can_end = is_admin or huddle.started_by_id == user_id
    if not can_end:
        raise AppError(
            403,
            "FORBIDDEN",
            "Only the starter or a workspace admin can end a huddle",
        )

    now = datetime.now(timezone.utc)
    huddle.is_active = False
    huddle.ended_at = now
    huddle.ended_by_id = user_id
    huddle.updated_at = now
    for participant in huddle.participants:
        if participant.left_at is None:
            participant.left_at = now
    await session.commit()
    loaded = await session.scalar(
        select(ChatHuddle)
        .where(ChatHuddle.id == huddle.id)
        .options(selectinload(ChatHuddle.participants).selectinload(ChatHuddleParticipant.user))
    )
    assert loaded is not None
    return _huddle_payload(loaded, user_id)


async def set_huddle_participant_muted(
    session: AsyncSession,
    workspace_id: str,
    user_id: str,
    channel_id: str,
    huddle_id: str,
    body: ToggleHuddleParticipantBody,
) -> dict:
    member = await _assert_channel_member(session, channel_id, user_id)
    if member.channel.workspace_id != workspace_id:
        raise AppError(404, "NOT_FOUND", "Channel not found")
    huddle = await session.scalar(
        select(ChatHuddle)
        .where(
            ChatHuddle.id == huddle_id,
            ChatHuddle.workspace_id == workspace_id,
            ChatHuddle.channel_id == channel_id,
        )
        .options(selectinload(ChatHuddle.participants).selectinload(ChatHuddleParticipant.user))
    )
    if not huddle:
        raise AppError(404, "NOT_FOUND", "Huddle not found")
    participant = await session.scalar(
        select(ChatHuddleParticipant).where(
            ChatHuddleParticipant.huddle_id == huddle_id,
            ChatHuddleParticipant.user_id == user_id,
        )
    )
    if not participant:
        raise AppError(404, "NOT_FOUND", "Participant not found")
    if body.muted is not None:
        participant.is_muted = body.muted
    huddle.updated_at = datetime.now(timezone.utc)
    await session.commit()
    loaded = await session.scalar(
        select(ChatHuddle)
        .where(ChatHuddle.id == huddle.id)
        .options(selectinload(ChatHuddle.participants).selectinload(ChatHuddleParticipant.user))
    )
    assert loaded is not None
    return _huddle_payload(loaded, user_id)
