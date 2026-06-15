"""Chat feature extensions — pins, DM prefs, global search, group DM management."""

from __future__ import annotations

import asyncio
from datetime import datetime, timezone

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.errors import AppError
from app.db.models.chat import (
    ChatChannel,
    ChatChannelMember,
    ChatMessage,
    DirectConversation,
    DirectParticipant,
)
from app.db.models.enums import MemberStatus
from app.db.models.user import User
from app.db.models.workspace import WorkspaceMember
from app.services.chat_helpers import map_message, map_search_message
from app.services.chat_service import (
    _MESSAGE_LIST_LOAD,
    _assert_channel_member,
    _assert_dm_participant,
    _thread_counts_for_messages,
)
from app.socket.emit import broadcast_dm_joined

_GLOBAL_SEARCH_LIMIT = 50
_DEFAULT_PAGE_SIZE = 50


def _normalize_notification_level(value: str | None) -> str:
    upper = (value or "MENTIONS").upper()
    if upper not in ("ALL", "MENTIONS", "NONE"):
        return "MENTIONS"
    return upper


async def _read_receipt_user_ids(
    session: AsyncSession,
    *,
    channel_id: str | None,
    conversation_id: str | None,
    message: ChatMessage,
    exclude_user_id: str,
) -> list[str]:
    if channel_id:
        members = (
            await session.scalars(
                select(ChatChannelMember).where(
                    ChatChannelMember.channel_id == channel_id
                )
            )
        ).all()
        return [
            m.user_id
            for m in members
            if m.user_id != exclude_user_id
            and m.last_read_at
            and m.last_read_at >= message.created_at
        ]
    if conversation_id:
        participants = (
            await session.scalars(
                select(DirectParticipant).where(
                    DirectParticipant.conversation_id == conversation_id
                )
            )
        ).all()
        return [
            p.user_id
            for p in participants
            if p.user_id != exclude_user_id
            and p.last_read_at
            and p.last_read_at >= message.created_at
        ]
    return []


async def list_paginated_root_messages(
    session: AsyncSession,
    workspace_id: str,
    user_id: str,
    *,
    channel_id: str | None = None,
    conversation_id: str | None = None,
    limit: int | None = None,
    before: str | None = None,
) -> dict:
    if channel_id:
        member = await _assert_channel_member(session, channel_id, user_id)
        if member.channel.workspace_id != workspace_id:
            raise AppError(404, "NOT_FOUND", "Channel not found")
    elif conversation_id:
        participant = await _assert_dm_participant(session, conversation_id, user_id)
        if participant.conversation.workspace_id != workspace_id:
            raise AppError(404, "NOT_FOUND", "Conversation not found")
    else:
        raise AppError(400, "BAD_REQUEST", "Channel or conversation required")

    clauses = [ChatMessage.parent_id.is_(None)]
    if channel_id:
        clauses.append(ChatMessage.channel_id == channel_id)
    else:
        clauses.append(ChatMessage.conversation_id == conversation_id)

    if before:
        ref = await session.scalar(select(ChatMessage).where(ChatMessage.id == before))
        if ref:
            clauses.append(ChatMessage.created_at < ref.created_at)

    q = (
        select(ChatMessage)
        .where(*clauses)
        .options(*_MESSAGE_LIST_LOAD)
        .order_by(ChatMessage.created_at.desc())
    )
    page_size = limit if limit and limit > 0 else None
    if page_size:
        q = q.limit(page_size + 1)

    rows = list((await session.scalars(q)).all())
    has_more = bool(page_size and len(rows) > page_size)
    if has_more:
        rows = rows[:page_size]
    rows.reverse()

    thread_counts = await _thread_counts_for_messages(session, [m.id for m in rows])
    data = []
    for m in rows:
        payload = map_message(m, user_id, thread_count=thread_counts.get(m.id, 0))
        if m.pinned_at:
            payload["pinnedAt"] = m.pinned_at.isoformat()
        read_by = await _read_receipt_user_ids(
            session,
            channel_id=channel_id,
            conversation_id=conversation_id,
            message=m,
            exclude_user_id=m.author_id,
        )
        if read_by:
            payload["readByUserIds"] = read_by
        data.append(payload)

    next_before = rows[0].id if has_more and rows else None
    return {"data": data, "hasMore": has_more, "nextBefore": next_before}


async def search_workspace_messages(
    session: AsyncSession, workspace_id: str, user_id: str, query: str
) -> dict:
    term = query.strip()
    if not term:
        return {"data": []}

    member_channel_ids = (
        await session.scalars(
            select(ChatChannelMember.channel_id)
            .join(ChatChannel)
            .where(
                ChatChannelMember.user_id == user_id,
                ChatChannel.workspace_id == workspace_id,
            )
        )
    ).all()
    dm_ids = (
        await session.scalars(
            select(DirectParticipant.conversation_id)
            .join(DirectConversation)
            .where(
                DirectParticipant.user_id == user_id,
                DirectConversation.workspace_id == workspace_id,
            )
        )
    ).all()

    if not member_channel_ids and not dm_ids:
        return {"data": []}

    pattern = f"%{term}%"
    access = []
    if member_channel_ids:
        access.append(ChatMessage.channel_id.in_(member_channel_ids))
    if dm_ids:
        access.append(ChatMessage.conversation_id.in_(dm_ids))

    messages = list(
        (
            await session.scalars(
                select(ChatMessage)
                .join(ChatMessage.author)
                .where(
                    ChatMessage.workspace_id == workspace_id,
                    or_(*access),
                    or_(
                        ChatMessage.body.ilike(pattern),
                        User.full_name.ilike(pattern),
                    ),
                )
                .options(*_MESSAGE_LIST_LOAD)
                .order_by(ChatMessage.created_at.desc())
                .limit(_GLOBAL_SEARCH_LIMIT)
            )
        ).all()
    )

    thread_counts = await _thread_counts_for_messages(
        session, [m.id for m in messages if m.parent_id is None]
    )

    data = []
    for msg in messages:
        hit = map_search_message(
            msg,
            user_id,
            thread_count=thread_counts.get(msg.id, 0) if not msg.parent_id else 0,
        )
        if msg.channel_id:
            hit["kind"] = "channel"
            hit["conversationId"] = msg.channel_id
        else:
            hit["kind"] = "dm"
            hit["conversationId"] = msg.conversation_id
        data.append(hit)

    return {"data": data}


async def set_channel_pinned(
    session: AsyncSession,
    workspace_id: str,
    user_id: str,
    channel_id: str,
    pinned: bool,
) -> dict:
    member = await _assert_channel_member(session, channel_id, user_id)
    if member.channel.workspace_id != workspace_id:
        raise AppError(404, "NOT_FOUND", "Channel not found")
    member.pinned_at = datetime.now(timezone.utc) if pinned else None
    await session.commit()
    return {"ok": True, "pinned": pinned}


async def set_message_pinned(
    session: AsyncSession,
    workspace_id: str,
    user_id: str,
    message_id: str,
    pinned: bool,
) -> dict:
    message = await session.scalar(
        select(ChatMessage)
        .where(ChatMessage.id == message_id, ChatMessage.workspace_id == workspace_id)
        .options(*_MESSAGE_LIST_LOAD)
    )
    if not message:
        raise AppError(404, "NOT_FOUND", "Message not found")
    if message.channel_id:
        await _assert_channel_member(session, message.channel_id, user_id)
    elif message.conversation_id:
        await _assert_dm_participant(session, message.conversation_id, user_id)
    else:
        raise AppError(404, "NOT_FOUND", "Message not found")

    message.pinned_at = datetime.now(timezone.utc) if pinned else None
    message.pinned_by_id = user_id if pinned else None
    await session.commit()
    return map_message(message, user_id, thread_count=0)


async def update_dm_participant(
    session: AsyncSession,
    workspace_id: str,
    user_id: str,
    conversation_id: str,
    *,
    starred: bool | None = None,
    hidden: bool | None = None,
) -> dict:
    participant = await _assert_dm_participant(session, conversation_id, user_id)
    if participant.conversation.workspace_id != workspace_id:
        raise AppError(404, "NOT_FOUND", "Conversation not found")
    if starred is not None:
        participant.starred = starred
    if hidden is not None:
        participant.is_hidden = hidden
    await session.commit()
    return {
        "ok": True,
        "starred": participant.starred,
        "hidden": participant.is_hidden,
    }


async def update_dm(
    session: AsyncSession,
    workspace_id: str,
    user_id: str,
    conversation_id: str,
    name: str,
) -> dict:
    participant = await _assert_dm_participant(session, conversation_id, user_id)
    conv = participant.conversation
    if conv.workspace_id != workspace_id:
        raise AppError(404, "NOT_FOUND", "Conversation not found")
    if not conv.is_group:
        raise AppError(400, "BAD_REQUEST", "Only group DMs can be renamed")
    conv.name = name.strip()
    await session.commit()
    return {"id": conv.id, "name": conv.name}


async def add_dm_participants(
    session: AsyncSession,
    workspace_id: str,
    user_id: str,
    conversation_id: str,
    user_ids: list[str],
) -> dict:
    participant = await _assert_dm_participant(session, conversation_id, user_id)
    conv = participant.conversation
    if conv.workspace_id != workspace_id:
        raise AppError(404, "NOT_FOUND", "Conversation not found")
    if not conv.is_group:
        raise AppError(400, "BAD_REQUEST", "Not a group conversation")

    existing = {p.user_id for p in conv.participants}
    added: list[str] = []
    for uid in user_ids:
        if uid in existing:
            continue
        wm = await session.scalar(
            select(WorkspaceMember).where(
                WorkspaceMember.workspace_id == workspace_id,
                WorkspaceMember.user_id == uid,
                WorkspaceMember.status == MemberStatus.ACTIVE,
            )
        )
        if not wm:
            continue
        session.add(
            DirectParticipant(conversation_id=conversation_id, user_id=uid)
        )
        existing.add(uid)
        added.append(uid)

    await session.commit()
    if added:
        asyncio.create_task(
            broadcast_dm_joined(
                workspace_id=workspace_id,
                user_ids=added,
                conversation_id=conversation_id,
            )
        )
    return {"ok": True, "addedUserIds": added}


async def remove_dm_participant(
    session: AsyncSession,
    workspace_id: str,
    user_id: str,
    conversation_id: str,
    target_user_id: str,
) -> dict:
    participant = await _assert_dm_participant(session, conversation_id, user_id)
    conv = participant.conversation
    if conv.workspace_id != workspace_id:
        raise AppError(404, "NOT_FOUND", "Conversation not found")
    if not conv.is_group:
        raise AppError(400, "BAD_REQUEST", "Not a group conversation")

    target = await session.scalar(
        select(DirectParticipant).where(
            DirectParticipant.conversation_id == conversation_id,
            DirectParticipant.user_id == target_user_id,
        )
    )
    if not target:
        raise AppError(404, "NOT_FOUND", "Participant not found")

    remaining = len(conv.participants)
    if remaining <= 2:
        raise AppError(400, "BAD_REQUEST", "Group must keep at least 2 members")
    if target_user_id != user_id and remaining <= 3:
        raise AppError(
            400, "BAD_REQUEST", "Group must keep at least 3 members to remove others"
        )

    await session.delete(target)
    await session.commit()
    return {"ok": True}
