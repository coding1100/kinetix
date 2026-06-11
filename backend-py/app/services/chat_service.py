import asyncio
from datetime import datetime, timezone

from sqlalchemy import and_, delete, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.errors import AppError
from app.db.models.chat import (
    ChatChannel,
    ChatChannelMember,
    ChatMessage,
    DirectConversation,
    DirectParticipant,
    MessageReaction,
)
from app.db.models.enums import MemberStatus, WorkspaceRole
from app.db.models.user import User
from app.db.models.workspace import WorkspaceMember
from app.schemas.chat import (
    AddChannelMembersBody,
    CreateChannelBody,
    UpdateChannelBody,
    UpdateChannelMemberBody,
)
from app.services.attachment_service import link_attachments_to_message
from app.services.notification_service import (
    create_channel_access_notifications,
    create_channel_access_removed_notifications,
    create_channel_broadcast_notifications,
    create_channel_deleted_notifications,
    create_channel_follow_notifications,
    create_mention_notifications,
    create_thread_reply_notifications,
    emit_channel_access_notifications,
    emit_home_notifications,
)
from app.services.chat_helpers import (
    dm_display_name,
    map_message,
    map_message_broadcast,
    map_search_message,
)
from app.socket.emit import (
    broadcast_channel_joined,
    broadcast_channel_member_updated,
    broadcast_channel_removed,
    broadcast_chat_message,
    broadcast_chat_message_delete,
    broadcast_chat_message_edit,
    broadcast_chat_read,
    broadcast_chat_reaction,
)
from app.socket.presence import get_presence

_MESSAGE_LIST_LOAD = (
    selectinload(ChatMessage.author),
    selectinload(ChatMessage.reactions),
    selectinload(ChatMessage.attachments),
)

_MESSAGE_DETAIL_LOAD = _MESSAGE_LIST_LOAD + (selectinload(ChatMessage.replies),)

_MESSAGE_LOAD = _MESSAGE_DETAIL_LOAD

_MESSAGE_SEND_LOAD = _MESSAGE_LIST_LOAD


async def _thread_counts_for_messages(
    session: AsyncSession, message_ids: list[str]
) -> dict[str, int]:
    if not message_ids:
        return {}
    rows = (
        await session.execute(
            select(ChatMessage.parent_id, func.count())
            .where(ChatMessage.parent_id.in_(message_ids))
            .group_by(ChatMessage.parent_id)
        )
    ).all()
    return {str(row[0]): int(row[1]) for row in rows}


def _epoch() -> datetime:
    return datetime(1970, 1, 1, tzinfo=timezone.utc)


async def _unread_channel_count(
    session: AsyncSession,
    channel_id: str,
    user_id: str,
    last_read_at: datetime | None = None,
) -> int:
    last_read = last_read_at or _epoch()
    count = await session.scalar(
        select(func.count())
        .select_from(ChatMessage)
        .where(
            ChatMessage.channel_id == channel_id,
            ChatMessage.parent_id.is_(None),
            ChatMessage.author_id != user_id,
            ChatMessage.created_at > last_read,
        )
    )
    return int(count or 0)


async def _unread_dm_count(
    session: AsyncSession,
    conversation_id: str,
    user_id: str,
    last_read_at: datetime | None = None,
) -> int:
    last_read = last_read_at or _epoch()
    count = await session.scalar(
        select(func.count())
        .select_from(ChatMessage)
        .where(
            ChatMessage.conversation_id == conversation_id,
            ChatMessage.parent_id.is_(None),
            ChatMessage.author_id != user_id,
            ChatMessage.created_at > last_read,
        )
    )
    return int(count or 0)


async def _unread_channel_counts_batch(
    session: AsyncSession,
    memberships: list[ChatChannelMember],
    user_id: str,
) -> dict[str, int]:
    if not memberships:
        return {}

    channel_ids = [m.channel_id for m in memberships]
    rows = (
        await session.execute(
            select(ChatMessage.channel_id, func.count())
            .join(
                ChatChannelMember,
                and_(
                    ChatChannelMember.channel_id == ChatMessage.channel_id,
                    ChatChannelMember.user_id == user_id,
                ),
            )
            .where(
                ChatMessage.channel_id.in_(channel_ids),
                ChatMessage.parent_id.is_(None),
                ChatMessage.author_id != user_id,
                ChatMessage.created_at
                > func.coalesce(ChatChannelMember.last_read_at, _epoch()),
            )
            .group_by(ChatMessage.channel_id)
        )
    ).all()
    return {channel_id: int(count) for channel_id, count in rows}


async def _unread_dm_counts_batch(
    session: AsyncSession,
    participations: list[DirectParticipant],
    user_id: str,
) -> dict[str, int]:
    if not participations:
        return {}

    conversation_ids = [p.conversation_id for p in participations]
    rows = (
        await session.execute(
            select(ChatMessage.conversation_id, func.count())
            .join(
                DirectParticipant,
                and_(
                    DirectParticipant.conversation_id == ChatMessage.conversation_id,
                    DirectParticipant.user_id == user_id,
                ),
            )
            .where(
                ChatMessage.conversation_id.in_(conversation_ids),
                ChatMessage.parent_id.is_(None),
                ChatMessage.author_id != user_id,
                ChatMessage.created_at
                > func.coalesce(DirectParticipant.last_read_at, _epoch()),
            )
            .group_by(ChatMessage.conversation_id)
        )
    ).all()
    return {conversation_id: int(count) for conversation_id, count in rows}


async def _assert_channel_member(
    session: AsyncSession, channel_id: str, user_id: str
) -> ChatChannelMember:
    member = await session.scalar(
        select(ChatChannelMember)
        .where(
            ChatChannelMember.channel_id == channel_id,
            ChatChannelMember.user_id == user_id,
        )
        .options(selectinload(ChatChannelMember.channel))
    )
    if not member:
        raise AppError(404, "NOT_FOUND", "Channel not found")
    return member


async def _assert_dm_participant(
    session: AsyncSession, conversation_id: str, user_id: str
) -> DirectParticipant:
    participant = await session.scalar(
        select(DirectParticipant)
        .where(
            DirectParticipant.conversation_id == conversation_id,
            DirectParticipant.user_id == user_id,
        )
        .options(
            selectinload(DirectParticipant.conversation).selectinload(
                DirectConversation.participants
            ).selectinload(DirectParticipant.user)
        )
    )
    if not participant:
        raise AppError(404, "NOT_FOUND", "Conversation not found")
    return participant


def _channel_payload(
    channel: ChatChannel,
    member: ChatChannelMember,
    member_count: int,
    last_message: str,
    last_at: datetime,
    unread: int,
    *,
    can_delete: bool = False,
) -> dict:
    payload = {
        "id": channel.id,
        "name": channel.name,
        "memberCount": member_count,
        "lastMessage": last_message,
        "lastAt": last_at.isoformat(),
        "unread": unread,
        "starred": member.starred,
        "topic": channel.topic,
        "spaceLabel": channel.space_label,
        "isPrivate": channel.is_private,
        "isFollowing": member.is_following,
        "customIconColor": channel.custom_icon_color,
        "createdById": channel.created_by_id,
        "canDelete": can_delete,
        "notificationLevel": (
            getattr(member, "notification_level", None) or "MENTIONS"
        ).upper(),
    }
    if member.pinned_at:
        payload["pinnedAt"] = member.pinned_at.isoformat()
    return payload


async def _emit_channel_member_update(
    session: AsyncSession,
    workspace_id: str,
    channel_id: str,
    user_id: str,
    *,
    removed: bool = False,
) -> None:
    if removed:
        asyncio.create_task(
            broadcast_channel_member_updated(
                workspace_id=workspace_id,
                channel_id=channel_id,
                member={"id": user_id},
                removed=True,
            )
        )
        return

    row = await session.scalar(
        select(ChatChannelMember)
        .where(
            ChatChannelMember.channel_id == channel_id,
            ChatChannelMember.user_id == user_id,
        )
        .options(selectinload(ChatChannelMember.user))
    )
    if not row:
        return
    roles = await _workspace_role_map(session, workspace_id, [user_id])
    member_payload = _channel_member_json(row.user, row, roles.get(user_id))
    asyncio.create_task(
        broadcast_channel_member_updated(
            workspace_id=workspace_id,
            channel_id=channel_id,
            member=member_payload,
        )
    )


async def _emit_channel_joined(
    session: AsyncSession,
    workspace_id: str,
    channel: ChatChannel,
    user_ids: list[str],
) -> None:
    unique_ids = list(dict.fromkeys(user_ids))
    if not unique_ids:
        return

    member_count = await session.scalar(
        select(func.count())
        .select_from(ChatChannelMember)
        .where(ChatChannelMember.channel_id == channel.id)
    )
    last = await _latest_channel_message(session, channel.id)
    last_at = last.created_at if last else channel.created_at
    last_message = last.body if last else ""
    template_member = ChatChannelMember(
        channel_id=channel.id,
        user_id=unique_ids[0],
        starred=False,
        is_following=False,
    )
    channel_payload = _channel_payload(
        channel,
        template_member,
        int(member_count or 0),
        last_message,
        last_at,
        0,
    )
    await broadcast_channel_joined(
        workspace_id=workspace_id,
        user_ids=unique_ids,
        channel=channel_payload,
    )


async def _latest_channel_message(
    session: AsyncSession, channel_id: str
) -> ChatMessage | None:
    return await session.scalar(
        select(ChatMessage)
        .where(
            ChatMessage.channel_id == channel_id,
            ChatMessage.parent_id.is_(None),
        )
        .order_by(ChatMessage.created_at.desc())
        .limit(1)
    )


async def list_channels(
    session: AsyncSession, workspace_id: str, user_id: str
) -> dict:
    memberships = (
        await session.scalars(
            select(ChatChannelMember)
            .join(ChatChannelMember.channel)
            .where(
                ChatChannelMember.user_id == user_id,
                ChatChannel.workspace_id == workspace_id,
            )
            .options(selectinload(ChatChannelMember.channel))
        )
    ).all()

    if not memberships:
        return {"data": []}

    channel_ids = [m.channel_id for m in memberships]

    member_count_rows = (
        await session.execute(
            select(ChatChannelMember.channel_id, func.count())
            .where(ChatChannelMember.channel_id.in_(channel_ids))
            .group_by(ChatChannelMember.channel_id)
        )
    ).all()
    member_counts = {row[0]: int(row[1]) for row in member_count_rows}

    recent_messages = (
        await session.scalars(
            select(ChatMessage)
            .where(
                ChatMessage.channel_id.in_(channel_ids),
                ChatMessage.parent_id.is_(None),
            )
            .order_by(ChatMessage.created_at.desc())
        )
    ).all()
    last_by_channel: dict[str, ChatMessage] = {}
    for msg in recent_messages:
        if msg.channel_id not in last_by_channel:
            last_by_channel[msg.channel_id] = msg

    unread_by_channel = await _unread_channel_counts_batch(
        session, memberships, user_id
    )

    channels = []
    for m in memberships:
        last = last_by_channel.get(m.channel_id)
        unread = unread_by_channel.get(m.channel_id, 0)
        last_at = last.created_at if last else m.channel.created_at
        can_delete = await _user_can_delete_channel(
            session, workspace_id, m.channel, user_id
        )
        channels.append(
            _channel_payload(
                m.channel,
                m,
                member_counts.get(m.channel_id, 0),
                last.body if last else "",
                last_at,
                unread,
                can_delete=can_delete,
            )
        )

    pinned = [c for c in channels if c.get("pinnedAt")]
    unpinned = [c for c in channels if not c.get("pinnedAt")]
    pinned.sort(key=lambda c: c["pinnedAt"] or "", reverse=True)
    unpinned.sort(key=lambda c: c["lastAt"], reverse=True)
    return {"data": pinned + unpinned}


async def get_channel(
    session: AsyncSession, workspace_id: str, user_id: str, channel_id: str
) -> dict:
    member = await _assert_channel_member(session, channel_id, user_id)
    if member.channel.workspace_id != workspace_id:
        raise AppError(404, "NOT_FOUND", "Channel not found")
    member_count = await session.scalar(
        select(func.count())
        .select_from(ChatChannelMember)
        .where(ChatChannelMember.channel_id == channel_id)
    )
    unread = await _unread_channel_count(session, channel_id, user_id)
    can_delete = await _user_can_delete_channel(
        session, workspace_id, member.channel, user_id
    )
    return _channel_payload(
        member.channel,
        member,
        int(member_count or 0),
        "",
        member.channel.created_at,
        unread,
        can_delete=can_delete,
    )


async def update_channel(
    session: AsyncSession,
    workspace_id: str,
    user_id: str,
    channel_id: str,
    body: UpdateChannelBody,
) -> dict:
    member = await _assert_channel_member(session, channel_id, user_id)
    if member.channel.workspace_id != workspace_id:
        raise AppError(404, "NOT_FOUND", "Channel not found")

    if body.name is not None:
        trimmed = body.name.strip().lstrip("#").strip()
        if not trimmed:
            raise AppError(400, "VALIDATION_ERROR", "Channel name is required")
        existing = await session.scalar(
            select(ChatChannel).where(
                ChatChannel.workspace_id == workspace_id,
                ChatChannel.name == trimmed,
                ChatChannel.id != channel_id,
            )
        )
        if existing:
            raise AppError(409, "CONFLICT", "A channel with this name already exists")
        member.channel.name = trimmed

    if body.topic is not None:
        topic = body.topic.strip()
        member.channel.topic = topic or None

    await session.commit()
    return await get_channel(session, workspace_id, user_id, channel_id)


async def _user_can_delete_channel(
    session: AsyncSession,
    workspace_id: str,
    channel: ChatChannel,
    user_id: str,
) -> bool:
    if await _is_workspace_admin(session, workspace_id, user_id):
        return True
    if channel.created_by_id == user_id:
        return True

    first_author_id = await session.scalar(
        select(ChatMessage.author_id)
        .where(
            ChatMessage.channel_id == channel.id,
            ChatMessage.parent_id.is_(None),
        )
        .order_by(ChatMessage.created_at.asc())
        .limit(1)
    )
    if first_author_id == user_id:
        return True

    if channel.created_by_id is not None:
        return False

    earliest_user_id = await session.scalar(
        select(ChatChannelMember.user_id)
        .where(ChatChannelMember.channel_id == channel.id)
        .order_by(ChatChannelMember.joined_at.asc())
        .limit(1)
    )
    return earliest_user_id == user_id


async def delete_channel(
    session: AsyncSession,
    workspace_id: str,
    user_id: str,
    channel_id: str,
) -> dict:
    await _assert_channel_member(session, channel_id, user_id)
    channel = await session.get(ChatChannel, channel_id)
    if not channel or channel.workspace_id != workspace_id:
        raise AppError(404, "NOT_FOUND", "Channel not found")

    if not await _user_can_delete_channel(session, workspace_id, channel, user_id):
        raise AppError(
            403,
            "FORBIDDEN",
            "Only workspace admins or the channel creator can delete this channel",
        )

    from app.db.models.chat import MessageAttachment
    from app.services.s3_service import delete_objects

    attachment_keys = (
        await session.scalars(
            select(MessageAttachment.storage_key).where(
                MessageAttachment.channel_id == channel_id
            )
        )
    ).all()

    member_ids = list(
        (
            await session.scalars(
                select(ChatChannelMember.user_id).where(
                    ChatChannelMember.channel_id == channel_id
                )
            )
        ).all()
    )

    delete_notifications: list = []
    if member_ids:
        delete_notifications = await create_channel_deleted_notifications(
            session,
            workspace_id=workspace_id,
            member_ids=member_ids,
            actor_user_id=user_id,
            channel_name=channel.name,
        )

    # Bulk delete so Postgres ON DELETE CASCADE runs; ORM session.delete()
    # tries to null FK columns on ChatChannelMember PK and raises AssertionError.
    await session.execute(
        delete(ChatChannel).where(
            ChatChannel.id == channel_id,
            ChatChannel.workspace_id == workspace_id,
        )
    )
    await session.commit()

    if attachment_keys:
        try:
            await asyncio.to_thread(delete_objects, list(attachment_keys))
        except Exception:
            pass

    if delete_notifications:
        await emit_home_notifications(session, workspace_id, delete_notifications)

    if member_ids:
        asyncio.create_task(
            broadcast_channel_removed(
                workspace_id=workspace_id,
                user_ids=member_ids,
                channel_id=channel_id,
            )
        )

    return {"ok": True}


async def create_channel(
    session: AsyncSession,
    workspace_id: str,
    user_id: str,
    body: CreateChannelBody,
) -> dict:
    trimmed = body.name.strip()
    existing = await session.scalar(
        select(ChatChannel).where(
            ChatChannel.workspace_id == workspace_id,
            ChatChannel.name == trimmed,
        )
    )
    if existing:
        raise AppError(409, "CONFLICT", "A channel with this name already exists")

    active_ids = (
        await session.scalars(
            select(WorkspaceMember.user_id).where(
                WorkspaceMember.workspace_id == workspace_id,
                WorkspaceMember.status == MemberStatus.ACTIVE,
            )
        )
    ).all()
    active_set = set(active_ids)

    if body.isPrivate:
        member_ids = list({user_id, *(body.memberIds or [])})
        invalid = set(member_ids) - active_set
        if invalid:
            raise AppError(
                400,
                "VALIDATION_ERROR",
                "Some users are not active workspace members",
            )
    else:
        member_ids = list(active_set)

    channel = ChatChannel(
        workspace_id=workspace_id,
        name=trimmed,
        topic=body.topic,
        is_private=body.isPrivate or False,
        space_label=body.spaceLabel or "in Workspace",
        created_by_id=user_id,
    )
    session.add(channel)
    await session.flush()

    for uid in member_ids:
        session.add(
            ChatChannelMember(
                channel_id=channel.id,
                user_id=uid,
                starred=False,
                is_following=uid == user_id,
            )
        )

    joined_notify = [uid for uid in member_ids if uid != user_id]
    access_notifications: list = []
    if body.isPrivate and joined_notify:
        access_notifications = await create_channel_access_notifications(
            session,
            workspace_id=workspace_id,
            recipient_ids=joined_notify,
            actor_user_id=user_id,
            channel=channel,
        )

    await session.commit()
    await session.refresh(channel)

    if joined_notify:
        await _emit_channel_joined(session, workspace_id, channel, joined_notify)
    if access_notifications:
        await emit_channel_access_notifications(
            session, workspace_id, access_notifications
        )

    member_count = len(member_ids)
    return _channel_payload(
        channel,
        ChatChannelMember(
            channel_id=channel.id,
            user_id=user_id,
            starred=False,
            is_following=True,
        ),
        member_count,
        "",
        channel.created_at,
        0,
        can_delete=True,
    )


async def list_channel_messages(
    session: AsyncSession,
    workspace_id: str,
    user_id: str,
    channel_id: str,
    *,
    limit: int | None = None,
    before: str | None = None,
) -> dict:
    if limit is not None or before:
        from app.services.chat_enhancements import list_paginated_root_messages

        return await list_paginated_root_messages(
            session,
            workspace_id,
            user_id,
            channel_id=channel_id,
            limit=limit,
            before=before,
        )

    member = await _assert_channel_member(session, channel_id, user_id)
    if member.channel.workspace_id != workspace_id:
        raise AppError(404, "NOT_FOUND", "Channel not found")

    messages = (
        await session.scalars(
            select(ChatMessage)
            .where(
                ChatMessage.channel_id == channel_id,
                ChatMessage.parent_id.is_(None),
            )
            .options(*_MESSAGE_LIST_LOAD)
            .order_by(ChatMessage.created_at.asc())
        )
    ).all()

    thread_counts = await _thread_counts_for_messages(
        session, [m.id for m in messages]
    )
    return {
        "data": [
            map_message(m, user_id, thread_count=thread_counts.get(m.id, 0))
            for m in messages
        ]
    }


async def mark_channel_read(
    session: AsyncSession, workspace_id: str, user_id: str, channel_id: str
) -> dict:
    member = await _assert_channel_member(session, channel_id, user_id)
    if member.channel.workspace_id != workspace_id:
        raise AppError(404, "NOT_FOUND", "Channel not found")
    member.last_read_at = datetime.now(timezone.utc)
    await session.commit()
    asyncio.create_task(
        broadcast_chat_read(
            workspace_id=workspace_id,
            kind="channel",
            conversation_id=channel_id,
            user_id=user_id,
            read_at=member.last_read_at.isoformat(),
        )
    )
    return {"ok": True, "unread": 0}


async def mark_channel_unread(
    session: AsyncSession, workspace_id: str, user_id: str, channel_id: str
) -> dict:
    member = await _assert_channel_member(session, channel_id, user_id)
    if member.channel.workspace_id != workspace_id:
        raise AppError(404, "NOT_FOUND", "Channel not found")
    member.last_read_at = _epoch()
    await session.commit()
    unread = await _unread_channel_count(
        session, channel_id, user_id, member.last_read_at
    )
    return {"ok": True, "unread": unread}


async def send_channel_message(
    session: AsyncSession,
    workspace_id: str,
    user_id: str,
    channel_id: str,
    body: str,
    attachment_ids: list[str] | None = None,
) -> dict:
    member = await _assert_channel_member(session, channel_id, user_id)
    if member.channel.workspace_id != workspace_id:
        raise AppError(404, "NOT_FOUND", "Channel not found")

    message = ChatMessage(
        workspace_id=workspace_id,
        channel_id=channel_id,
        author_id=user_id,
        body=body.strip(),
    )
    session.add(message)
    await session.flush()
    if attachment_ids:
        await link_attachments_to_message(
            session, workspace_id, user_id, message.id, attachment_ids
        )
    mention_notifications = await create_mention_notifications(
        session,
        workspace_id=workspace_id,
        author_user_id=user_id,
        body=message.body,
        channel=member.channel,
    )
    channel_notifications = await create_channel_broadcast_notifications(
        session,
        workspace_id=workspace_id,
        author_user_id=user_id,
        channel=member.channel,
        body=message.body,
        message_id=message.id,
    )
    await session.commit()

    loaded = await session.scalar(
        select(ChatMessage)
        .where(ChatMessage.id == message.id)
        .options(*_MESSAGE_SEND_LOAD)
    )
    payload = map_message(loaded, user_id, thread_count=0)
    all_notifications = mention_notifications + channel_notifications
    if all_notifications:
        await emit_home_notifications(session, workspace_id, all_notifications)
    asyncio.create_task(
        broadcast_chat_message(
            workspace_id=workspace_id,
            kind="channel",
            conversation_id=channel_id,
            message=map_message_broadcast(loaded, thread_count=0),
        )
    )
    return payload


def _thread_has_new(
    replies: list[ChatMessage],
    user_id: str,
    last_read_at: datetime | None,
) -> bool:
    last_read = last_read_at or _epoch()
    return any(
        r.author_id != user_id and r.created_at > last_read for r in replies
    )


async def get_message_thread(
    session: AsyncSession,
    workspace_id: str,
    user_id: str,
    channel_id: str,
    message_id: str,
) -> dict:
    member = await _assert_channel_member(session, channel_id, user_id)

    parent = await session.scalar(
        select(ChatMessage)
        .where(
            ChatMessage.id == message_id,
            ChatMessage.channel_id == channel_id,
            ChatMessage.workspace_id == workspace_id,
            ChatMessage.parent_id.is_(None),
        )
        .options(*_MESSAGE_LOAD)
    )
    if not parent:
        raise AppError(404, "NOT_FOUND", "Message not found")

    replies = (
        await session.scalars(
            select(ChatMessage)
            .where(ChatMessage.parent_id == message_id)
            .options(*_MESSAGE_LOAD)
            .order_by(ChatMessage.created_at.asc())
        )
    ).all()

    return {
        "parent": map_message(parent, user_id),
        "replies": [map_message(r, user_id) for r in replies],
        "hasNew": _thread_has_new(replies, user_id, member.last_read_at),
    }


async def send_thread_reply(
    session: AsyncSession,
    workspace_id: str,
    user_id: str,
    channel_id: str | None,
    conversation_id: str | None,
    parent_id: str,
    body: str,
    attachment_ids: list[str] | None = None,
) -> dict:
    clauses = [
        ChatMessage.id == parent_id,
        ChatMessage.workspace_id == workspace_id,
    ]
    if channel_id:
        clauses.append(ChatMessage.channel_id == channel_id)
    else:
        clauses.append(ChatMessage.conversation_id == conversation_id)

    parent = await session.scalar(select(ChatMessage).where(*clauses))

    if not parent:
        raise AppError(404, "NOT_FOUND", "Message not found")

    if channel_id:
        await _assert_channel_member(session, channel_id, user_id)
    elif conversation_id:
        await _assert_dm_participant(session, conversation_id, user_id)

    message = ChatMessage(
        workspace_id=workspace_id,
        channel_id=channel_id,
        conversation_id=conversation_id,
        parent_id=parent_id,
        author_id=user_id,
        body=body.strip(),
    )
    session.add(message)
    await session.flush()
    if attachment_ids:
        await link_attachments_to_message(
            session, workspace_id, user_id, message.id, attachment_ids
        )
    mention_channel = None
    if channel_id:
        mention_channel = await session.get(ChatChannel, channel_id)
    mention_notifications = await create_mention_notifications(
        session,
        workspace_id=workspace_id,
        author_user_id=user_id,
        body=message.body,
        channel=mention_channel,
    )
    thread_notifications = await create_thread_reply_notifications(
        session,
        workspace_id=workspace_id,
        author_user_id=user_id,
        parent=parent,
        reply_body=message.body,
        kind="channel" if channel_id else "dm",
        conversation_id=channel_id or conversation_id or "",
    )
    await session.commit()

    loaded = await session.scalar(
        select(ChatMessage)
        .where(ChatMessage.id == message.id)
        .options(*_MESSAGE_SEND_LOAD)
    )
    payload = map_message(loaded, user_id, thread_count=0)
    all_notifications = mention_notifications + thread_notifications
    if all_notifications:
        await emit_home_notifications(session, workspace_id, all_notifications)
    conv_id = channel_id or conversation_id
    kind = "channel" if channel_id else "dm"
    if conv_id:
        asyncio.create_task(
            broadcast_chat_message(
                workspace_id=workspace_id,
                kind=kind,
                conversation_id=conv_id,
                message=map_message_broadcast(loaded, thread_count=0),
                parent_id=parent_id,
            )
        )
    return payload


async def _latest_dm_message(
    session: AsyncSession, conversation_id: str
) -> ChatMessage | None:
    return await session.scalar(
        select(ChatMessage)
        .where(
            ChatMessage.conversation_id == conversation_id,
            ChatMessage.parent_id.is_(None),
        )
        .order_by(ChatMessage.created_at.desc())
        .limit(1)
    )


def _dm_payload(
    conv: DirectConversation,
    participant: DirectParticipant,
    user_id: str,
    workspace_id: str,
    last_message: str,
    last_at: datetime,
    unread: int,
) -> dict:
    other = next((p for p in conv.participants if p.user_id != user_id), None)
    members = None
    participants = None
    if conv.is_group:
        others = [p for p in conv.participants if p.user_id != user_id]
        members = [p.user.full_name.split(" ")[0] for p in others]
        participants = [
            {"id": p.user_id, "fullName": p.user.full_name}
            for p in conv.participants
        ]
    other_presence = (
        get_presence(workspace_id, other.user_id)
        if other and not conv.is_group
        else "offline"
    )
    return {
        "id": conv.id,
        "name": dm_display_name(conv, user_id),
        "isGroup": conv.is_group,
        "members": members,
        "participants": participants,
        "avatarUrl": None,
        "lastMessage": last_message,
        "lastAt": last_at.isoformat(),
        "unread": unread,
        "presence": other_presence,
        "starred": participant.starred,
        "otherUserId": other.user_id if other else None,
    }


async def list_dms(session: AsyncSession, workspace_id: str, user_id: str) -> dict:
    participations = (
        await session.scalars(
            select(DirectParticipant)
            .join(DirectParticipant.conversation)
            .where(
                DirectParticipant.user_id == user_id,
                DirectConversation.workspace_id == workspace_id,
            )
            .options(
                selectinload(DirectParticipant.conversation).selectinload(
                    DirectConversation.participants
                ).selectinload(DirectParticipant.user)
            )
        )
    ).all()

    if not participations:
        return {"data": []}

    conversation_ids = [p.conversation_id for p in participations]

    recent_messages = (
        await session.scalars(
            select(ChatMessage)
            .where(
                ChatMessage.conversation_id.in_(conversation_ids),
                ChatMessage.parent_id.is_(None),
            )
            .order_by(ChatMessage.created_at.desc())
        )
    ).all()
    last_by_conversation: dict[str, ChatMessage] = {}
    for msg in recent_messages:
        if msg.conversation_id not in last_by_conversation:
            last_by_conversation[msg.conversation_id] = msg

    unread_by_conversation = await _unread_dm_counts_batch(
        session, participations, user_id
    )

    dms = []
    for p in participations:
        if getattr(p, "is_hidden", False):
            continue
        last = last_by_conversation.get(p.conversation_id)
        unread = unread_by_conversation.get(p.conversation_id, 0)
        last_at = last.created_at if last else p.conversation.created_at
        dms.append(
            _dm_payload(
                p.conversation,
                p,
                user_id,
                workspace_id,
                last.body if last else "",
                last_at,
                unread,
            )
        )

    dms.sort(key=lambda d: d["lastAt"], reverse=True)
    return {"data": dms}


async def get_dm(
    session: AsyncSession, workspace_id: str, user_id: str, conversation_id: str
) -> dict:
    participant = await _assert_dm_participant(session, conversation_id, user_id)
    if participant.conversation.workspace_id != workspace_id:
        raise AppError(404, "NOT_FOUND", "Conversation not found")
    unread = await _unread_dm_count(session, conversation_id, user_id)
    return _dm_payload(
        participant.conversation,
        participant,
        user_id,
        workspace_id,
        "",
        participant.conversation.created_at,
        unread,
    )


async def create_or_get_dm(
    session: AsyncSession,
    workspace_id: str,
    user_id: str,
    user_ids: list[str],
    name: str | None,
) -> dict:
    unique_ids = list({user_id, *user_ids})

    for uid in unique_ids:
        member = await session.scalar(
            select(WorkspaceMember).where(
                WorkspaceMember.workspace_id == workspace_id,
                WorkspaceMember.user_id == uid,
            )
        )
        if not member:
            raise AppError(
                400, "BAD_REQUEST", "All users must be workspace members"
            )

    if len(unique_ids) == 2:
        pair_subq = (
            select(DirectParticipant.conversation_id)
            .where(DirectParticipant.user_id.in_(unique_ids))
            .group_by(DirectParticipant.conversation_id)
            .having(func.count() == 2)
        )
        existing_id = await session.scalar(
            select(DirectConversation.id)
            .where(
                DirectConversation.workspace_id == workspace_id,
                DirectConversation.is_group.is_(False),
                DirectConversation.id.in_(pair_subq),
            )
            .limit(1)
        )
        if existing_id:
            return await get_dm(session, workspace_id, user_id, existing_id)

    is_group = len(unique_ids) > 2
    conversation = DirectConversation(
        workspace_id=workspace_id,
        is_group=is_group,
        name=name.strip() if name and name.strip() else None,
    )
    session.add(conversation)
    await session.flush()

    for uid in unique_ids:
        session.add(
            DirectParticipant(
                conversation_id=conversation.id,
                user_id=uid,
                starred=uid == user_id,
            )
        )
    await session.commit()

    return await get_dm(session, workspace_id, user_id, conversation.id)


async def list_dm_messages(
    session: AsyncSession,
    workspace_id: str,
    user_id: str,
    conversation_id: str,
    *,
    limit: int | None = None,
    before: str | None = None,
) -> dict:
    if limit is not None or before:
        from app.services.chat_enhancements import list_paginated_root_messages

        return await list_paginated_root_messages(
            session,
            workspace_id,
            user_id,
            conversation_id=conversation_id,
            limit=limit,
            before=before,
        )

    participant = await _assert_dm_participant(session, conversation_id, user_id)
    if participant.conversation.workspace_id != workspace_id:
        raise AppError(404, "NOT_FOUND", "Conversation not found")

    messages = (
        await session.scalars(
            select(ChatMessage)
            .where(
                ChatMessage.conversation_id == conversation_id,
                ChatMessage.parent_id.is_(None),
            )
            .options(*_MESSAGE_LIST_LOAD)
            .order_by(ChatMessage.created_at.asc())
        )
    ).all()

    thread_counts = await _thread_counts_for_messages(
        session, [m.id for m in messages]
    )
    return {
        "data": [
            map_message(m, user_id, thread_count=thread_counts.get(m.id, 0))
            for m in messages
        ]
    }


async def mark_dm_read(
    session: AsyncSession,
    workspace_id: str,
    user_id: str,
    conversation_id: str,
) -> dict:
    participant = await _assert_dm_participant(session, conversation_id, user_id)
    if participant.conversation.workspace_id != workspace_id:
        raise AppError(404, "NOT_FOUND", "Conversation not found")
    participant.last_read_at = datetime.now(timezone.utc)
    await session.commit()
    asyncio.create_task(
        broadcast_chat_read(
            workspace_id=workspace_id,
            kind="dm",
            conversation_id=conversation_id,
            user_id=user_id,
            read_at=participant.last_read_at.isoformat(),
        )
    )
    return {"ok": True, "unread": 0}


async def mark_dm_unread(
    session: AsyncSession,
    workspace_id: str,
    user_id: str,
    conversation_id: str,
) -> dict:
    participant = await _assert_dm_participant(session, conversation_id, user_id)
    if participant.conversation.workspace_id != workspace_id:
        raise AppError(404, "NOT_FOUND", "Conversation not found")
    participant.last_read_at = _epoch()
    await session.commit()
    unread = await _unread_dm_count(
        session, conversation_id, user_id, participant.last_read_at
    )
    return {"ok": True, "unread": unread}


async def send_dm_message(
    session: AsyncSession,
    workspace_id: str,
    user_id: str,
    conversation_id: str,
    body: str,
    attachment_ids: list[str] | None = None,
) -> dict:
    participant = await _assert_dm_participant(session, conversation_id, user_id)
    if participant.conversation.workspace_id != workspace_id:
        raise AppError(404, "NOT_FOUND", "Conversation not found")

    for p in participant.conversation.participants:
        if getattr(p, "is_hidden", False):
            p.is_hidden = False

    message = ChatMessage(
        workspace_id=workspace_id,
        conversation_id=conversation_id,
        author_id=user_id,
        body=body.strip(),
    )
    session.add(message)
    await session.flush()
    if attachment_ids:
        await link_attachments_to_message(
            session, workspace_id, user_id, message.id, attachment_ids
        )
    mention_notifications = await create_mention_notifications(
        session,
        workspace_id=workspace_id,
        author_user_id=user_id,
        body=message.body,
        channel=None,
    )
    await session.commit()

    loaded = await session.scalar(
        select(ChatMessage)
        .where(ChatMessage.id == message.id)
        .options(*_MESSAGE_SEND_LOAD)
    )
    payload = map_message(loaded, user_id, thread_count=0)
    if mention_notifications:
        await emit_home_notifications(session, workspace_id, mention_notifications)
    asyncio.create_task(
        broadcast_chat_message(
            workspace_id=workspace_id,
            kind="dm",
            conversation_id=conversation_id,
            message=map_message_broadcast(loaded, thread_count=0),
        )
    )
    return payload


async def get_dm_message_thread(
    session: AsyncSession,
    workspace_id: str,
    user_id: str,
    conversation_id: str,
    message_id: str,
) -> dict:
    participant = await _assert_dm_participant(session, conversation_id, user_id)

    parent = await session.scalar(
        select(ChatMessage)
        .where(
            ChatMessage.id == message_id,
            ChatMessage.conversation_id == conversation_id,
            ChatMessage.workspace_id == workspace_id,
            ChatMessage.parent_id.is_(None),
        )
        .options(*_MESSAGE_LOAD)
    )
    if not parent:
        raise AppError(404, "NOT_FOUND", "Message not found")

    replies = (
        await session.scalars(
            select(ChatMessage)
            .where(ChatMessage.parent_id == message_id)
            .options(*_MESSAGE_LOAD)
            .order_by(ChatMessage.created_at.asc())
        )
    ).all()

    return {
        "parent": map_message(parent, user_id),
        "replies": [map_message(r, user_id) for r in replies],
        "hasNew": _thread_has_new(replies, user_id, participant.last_read_at),
    }


async def _reaction_counts(session: AsyncSession, message_id: str) -> list[dict]:
    rows = (
        await session.execute(
            select(MessageReaction.emoji, func.count())
            .where(MessageReaction.message_id == message_id)
            .group_by(MessageReaction.emoji)
        )
    ).all()
    return [{"emoji": row[0], "count": int(row[1])} for row in rows]


async def _assert_message_access(
    session: AsyncSession,
    workspace_id: str,
    user_id: str,
    message_id: str,
) -> ChatMessage:
    message = await session.scalar(
        select(ChatMessage).where(
            ChatMessage.id == message_id,
            ChatMessage.workspace_id == workspace_id,
        )
    )
    if not message:
        raise AppError(404, "NOT_FOUND", "Message not found")
    if message.channel_id:
        await _assert_channel_member(session, message.channel_id, user_id)
    elif message.conversation_id:
        await _assert_dm_participant(session, message.conversation_id, user_id)
    else:
        raise AppError(404, "NOT_FOUND", "Message not found")
    return message


async def update_message(
    session: AsyncSession,
    workspace_id: str,
    user_id: str,
    message_id: str,
    body: str,
    attachment_ids: list[str] | None = None,
) -> dict:
    from app.db.models.chat import MessageAttachment

    message = await _assert_message_access(
        session, workspace_id, user_id, message_id
    )
    if message.author_id != user_id:
        raise AppError(403, "FORBIDDEN", "Only the author can edit this message")

    if attachment_ids is not None:
        unique_keep = list(dict.fromkeys(attachment_ids))
        current_rows = (
            await session.scalars(
                select(MessageAttachment).where(
                    MessageAttachment.message_id == message_id,
                    MessageAttachment.workspace_id == workspace_id,
                )
            )
        ).all()
        current_ids = {row.id for row in current_rows}
        keep_set = set(unique_keep)

        new_ids = [aid for aid in unique_keep if aid not in current_ids]
        if new_ids:
            await link_attachments_to_message(
                session, workspace_id, user_id, message_id, new_ids
            )

        for row in current_rows:
            if row.id not in keep_set:
                row.message_id = None

        await session.flush()
        session.expire(message, ["attachments"])

    trimmed = body.strip()
    if not trimmed:
        attachment_count = await session.scalar(
            select(func.count())
            .select_from(MessageAttachment)
            .where(MessageAttachment.message_id == message_id)
        )
        if not (attachment_count or 0):
            raise AppError(400, "VALIDATION_ERROR", "Message body is required")

    message.body = trimmed
    await session.commit()

    loaded = await session.scalar(
        select(ChatMessage)
        .where(ChatMessage.id == message_id)
        .options(*_MESSAGE_LOAD)
        .execution_options(populate_existing=True)
    )
    payload = map_message(loaded, user_id)
    kind = "channel" if loaded.channel_id else "dm"
    conv_id = loaded.channel_id or loaded.conversation_id
    if conv_id:
        asyncio.create_task(
            broadcast_chat_message_edit(
                workspace_id=workspace_id,
                kind=kind,
                conversation_id=conv_id,
                message=map_message_broadcast(loaded),
                parent_id=loaded.parent_id,
            )
        )
    return payload


async def delete_message(
    session: AsyncSession,
    workspace_id: str,
    user_id: str,
    message_id: str,
) -> dict:
    message = await _assert_message_access(
        session, workspace_id, user_id, message_id
    )
    if message.author_id != user_id:
        raise AppError(403, "FORBIDDEN", "Only the author can delete this message")

    kind = "channel" if message.channel_id else "dm"
    conv_id = message.channel_id or message.conversation_id
    parent_id = message.parent_id

    await session.delete(message)
    await session.commit()

    if conv_id:
        asyncio.create_task(
            broadcast_chat_message_delete(
                workspace_id=workspace_id,
                kind=kind,
                conversation_id=conv_id,
                message_id=message_id,
                parent_id=parent_id,
            )
        )
    return {"ok": True, "messageId": message_id}


async def toggle_message_reaction(
    session: AsyncSession,
    workspace_id: str,
    user_id: str,
    message_id: str,
    emoji: str,
) -> dict:
    await _assert_message_access(session, workspace_id, user_id, message_id)
    trimmed = emoji.strip()
    if not trimmed:
        raise AppError(400, "VALIDATION_ERROR", "Emoji is required")

    existing = await session.scalar(
        select(MessageReaction).where(
            MessageReaction.message_id == message_id,
            MessageReaction.user_id == user_id,
            MessageReaction.emoji == trimmed,
        )
    )
    if existing:
        await session.delete(existing)
    else:
        session.add(
            MessageReaction(
                message_id=message_id,
                user_id=user_id,
                emoji=trimmed,
            )
        )
    await session.commit()

    reactions = await _reaction_counts(session, message_id)
    asyncio.create_task(
        broadcast_chat_reaction(
            workspace_id=workspace_id,
            message_id=message_id,
            reactions=reactions,
        )
    )
    return {"messageId": message_id, "reactions": reactions}


def _channel_member_json(
    user: User, member: ChatChannelMember, workspace_role: str | None
) -> dict:
    return {
        "id": user.id,
        "fullName": user.full_name,
        "email": user.email,
        "avatarUrl": user.avatar_url,
        "isFollowing": member.is_following,
        "starred": member.starred,
        "joinedAt": member.joined_at.isoformat() if member.joined_at else None,
        "workspaceRole": workspace_role,
    }


def _workspace_member_as_channel_json(
    user: User, workspace_role: str | None, *, is_following: bool = False
) -> dict:
    return {
        "id": user.id,
        "fullName": user.full_name,
        "email": user.email,
        "avatarUrl": user.avatar_url,
        "isFollowing": is_following,
        "starred": False,
        "joinedAt": None,
        "workspaceRole": workspace_role,
    }


async def _workspace_role_map(
    session: AsyncSession, workspace_id: str, user_ids: list[str]
) -> dict[str, str]:
    if not user_ids:
        return {}
    rows = (
        await session.scalars(
            select(WorkspaceMember).where(
                WorkspaceMember.workspace_id == workspace_id,
                WorkspaceMember.user_id.in_(user_ids),
                WorkspaceMember.status == MemberStatus.ACTIVE,
            )
        )
    ).all()
    return {m.user_id: m.role.value for m in rows}


async def list_channel_members(
    session: AsyncSession, workspace_id: str, user_id: str, channel_id: str
) -> dict:
    member = await _assert_channel_member(session, channel_id, user_id)
    channel = member.channel
    if channel.workspace_id != workspace_id:
        raise AppError(404, "NOT_FOUND", "Channel not found")

    rows = (
        await session.scalars(
            select(ChatChannelMember)
            .where(ChatChannelMember.channel_id == channel_id)
            .options(selectinload(ChatChannelMember.user))
            .order_by(ChatChannelMember.joined_at.asc())
        )
    ).all()

    if channel.is_private:
        user_ids = [m.user_id for m in rows]
        roles = await _workspace_role_map(session, workspace_id, user_ids)
        return {
            "data": [
                _channel_member_json(m.user, m, roles.get(m.user_id))
                for m in rows
            ]
        }

    workspace_members = (
        await session.scalars(
            select(WorkspaceMember)
            .where(
                WorkspaceMember.workspace_id == workspace_id,
                WorkspaceMember.status == MemberStatus.ACTIVE,
            )
            .options(selectinload(WorkspaceMember.user))
            .order_by(WorkspaceMember.joined_at.asc())
        )
    ).all()
    channel_by_user = {m.user_id: m for m in rows}
    user_ids = [wm.user_id for wm in workspace_members]
    roles = await _workspace_role_map(session, workspace_id, user_ids)
    data = []
    for wm in workspace_members:
        existing = channel_by_user.get(wm.user_id)
        if existing:
            data.append(
                _channel_member_json(wm.user, existing, roles.get(wm.user_id))
            )
        else:
            data.append(
                _workspace_member_as_channel_json(
                    wm.user, roles.get(wm.user_id), is_following=False
                )
            )
    return {"data": data}


async def add_channel_members(
    session: AsyncSession,
    workspace_id: str,
    user_id: str,
    channel_id: str,
    body: AddChannelMembersBody,
) -> dict:
    await _assert_channel_member(session, channel_id, user_id)
    channel = await session.get(ChatChannel, channel_id)
    if not channel or channel.workspace_id != workspace_id:
        raise AppError(404, "NOT_FOUND", "Channel not found")
    if not channel.is_private and not await _is_workspace_admin(
        session, workspace_id, user_id
    ):
        raise AppError(
            403,
            "FORBIDDEN",
            "Public channels include all workspace members in access",
        )

    requested = list(dict.fromkeys(body.userIds))
    active = (
        await session.scalars(
            select(WorkspaceMember.user_id).where(
                WorkspaceMember.workspace_id == workspace_id,
                WorkspaceMember.status == MemberStatus.ACTIVE,
                WorkspaceMember.user_id.in_(requested),
            )
        )
    ).all()
    active_set = set(active)
    missing = set(requested) - active_set
    if missing:
        raise AppError(
            400,
            "VALIDATION_ERROR",
            "Some users are not active workspace members",
        )

    existing = set(
        (
            await session.scalars(
                select(ChatChannelMember.user_id).where(
                    ChatChannelMember.channel_id == channel_id,
                    ChatChannelMember.user_id.in_(requested),
                )
            )
        ).all()
    )
    to_add = [uid for uid in requested if uid not in existing]
    for uid in to_add:
        session.add(
            ChatChannelMember(
                channel_id=channel_id,
                user_id=uid,
                starred=False,
                is_following=False,
            )
        )

    access_notifications: list = []
    if channel.is_private and to_add:
        access_notifications = await create_channel_access_notifications(
            session,
            workspace_id=workspace_id,
            recipient_ids=to_add,
            actor_user_id=user_id,
            channel=channel,
        )

    await session.commit()

    if not to_add:
        existing_rows = (
            await session.scalars(
                select(ChatChannelMember)
                .where(
                    ChatChannelMember.channel_id == channel_id,
                    ChatChannelMember.user_id.in_(requested),
                )
                .options(selectinload(ChatChannelMember.user))
            )
        ).all()
        existing_ids = [m.user_id for m in existing_rows]
        roles = await _workspace_role_map(session, workspace_id, existing_ids)
        return {
            "added": 0,
            "data": [
                _channel_member_json(m.user, m, roles.get(m.user_id))
                for m in existing_rows
            ],
        }

    if access_notifications:
        await emit_channel_access_notifications(
            session, workspace_id, access_notifications
        )

    await _emit_channel_joined(session, workspace_id, channel, to_add)
    for uid in to_add:
        await _emit_channel_member_update(session, workspace_id, channel_id, uid)

    added_rows = (
        await session.scalars(
            select(ChatChannelMember)
            .where(
                ChatChannelMember.channel_id == channel_id,
                ChatChannelMember.user_id.in_(to_add),
            )
            .options(selectinload(ChatChannelMember.user))
        )
    ).all()
    roles = await _workspace_role_map(session, workspace_id, to_add)
    return {
        "added": len(to_add),
        "data": [
            _channel_member_json(m.user, m, roles.get(m.user_id)) for m in added_rows
        ],
    }


async def remove_channel_member(
    session: AsyncSession,
    workspace_id: str,
    user_id: str,
    channel_id: str,
    target_user_id: str,
) -> dict:
    actor = await _assert_channel_member(session, channel_id, user_id)
    if actor.channel.workspace_id != workspace_id:
        raise AppError(404, "NOT_FOUND", "Channel not found")

    target = await session.scalar(
        select(ChatChannelMember).where(
            ChatChannelMember.channel_id == channel_id,
            ChatChannelMember.user_id == target_user_id,
        )
    )
    if not target:
        raise AppError(404, "NOT_FOUND", "User is not a channel member")

    if target_user_id != user_id:
        channel = actor.channel
        is_creator = channel.created_by_id == user_id
        if not is_creator:
            wm = await session.scalar(
                select(WorkspaceMember).where(
                    WorkspaceMember.workspace_id == workspace_id,
                    WorkspaceMember.user_id == user_id,
                    WorkspaceMember.status == MemberStatus.ACTIVE,
                )
            )
            if not wm or wm.role not in (WorkspaceRole.OWNER, WorkspaceRole.ADMIN):
                raise AppError(
                    403,
                    "FORBIDDEN",
                    "Only workspace admins or the channel creator can remove other members",
                )

    member_count = await session.scalar(
        select(func.count())
        .select_from(ChatChannelMember)
        .where(ChatChannelMember.channel_id == channel_id)
    )
    if (member_count or 0) <= 1:
        raise AppError(
            400,
            "VALIDATION_ERROR",
            "Cannot remove the last channel member",
        )

    channel = actor.channel
    removal_notifications: list = []
    if channel.is_private:
        removal_notifications = await create_channel_access_removed_notifications(
            session,
            workspace_id=workspace_id,
            recipient_ids=[target_user_id],
            actor_user_id=user_id,
            channel=channel,
        )

    await session.delete(target)
    await session.commit()

    if removal_notifications:
        await emit_channel_access_notifications(
            session, workspace_id, removal_notifications
        )

    asyncio.create_task(
        broadcast_channel_removed(
            workspace_id=workspace_id,
            user_ids=[target_user_id],
            channel_id=channel_id,
        )
    )
    await _emit_channel_member_update(
        session, workspace_id, channel_id, target_user_id, removed=True
    )
    return {"ok": True}


async def update_channel_member(
    session: AsyncSession,
    workspace_id: str,
    user_id: str,
    channel_id: str,
    body: UpdateChannelMemberBody,
) -> dict:
    return await update_channel_member_target(
        session, workspace_id, user_id, channel_id, user_id, body
    )


async def _is_workspace_admin(
    session: AsyncSession, workspace_id: str, user_id: str
) -> bool:
    wm = await session.scalar(
        select(WorkspaceMember).where(
            WorkspaceMember.workspace_id == workspace_id,
            WorkspaceMember.user_id == user_id,
            WorkspaceMember.status == MemberStatus.ACTIVE,
        )
    )
    return bool(wm and wm.role in (WorkspaceRole.OWNER, WorkspaceRole.ADMIN))


async def _is_workspace_owner(
    session: AsyncSession, workspace_id: str, user_id: str
) -> bool:
    wm = await session.scalar(
        select(WorkspaceMember).where(
            WorkspaceMember.workspace_id == workspace_id,
            WorkspaceMember.user_id == user_id,
            WorkspaceMember.status == MemberStatus.ACTIVE,
        )
    )
    return bool(wm and wm.role == WorkspaceRole.OWNER)


async def update_channel_member_target(
    session: AsyncSession,
    workspace_id: str,
    user_id: str,
    channel_id: str,
    target_user_id: str,
    body: UpdateChannelMemberBody,
) -> dict:
    await _assert_channel_member(session, channel_id, user_id)
    channel = await session.get(ChatChannel, channel_id)
    if not channel or channel.workspace_id != workspace_id:
        raise AppError(404, "NOT_FOUND", "Channel not found")

    created_membership = False
    target = await session.scalar(
        select(ChatChannelMember).where(
            ChatChannelMember.channel_id == channel_id,
            ChatChannelMember.user_id == target_user_id,
        )
    )
    if not target:
        if channel.is_private:
            raise AppError(404, "NOT_FOUND", "User is not a channel member")
        workspace_member = await session.scalar(
            select(WorkspaceMember).where(
                WorkspaceMember.workspace_id == workspace_id,
                WorkspaceMember.user_id == target_user_id,
                WorkspaceMember.status == MemberStatus.ACTIVE,
            )
        )
        if not workspace_member:
            raise AppError(404, "NOT_FOUND", "User is not a workspace member")
        target = ChatChannelMember(
            channel_id=channel_id,
            user_id=target_user_id,
            starred=False,
            is_following=False,
        )
        session.add(target)
        await session.flush()
        created_membership = True

    is_self = target_user_id == user_id
    if not is_self and body.starred is not None:
        raise AppError(
            400,
            "VALIDATION_ERROR",
            "Cannot change starred status for other members",
        )

    follow_notifications: list = []
    following_changed = False
    if body.is_following is not None and target.is_following != body.is_following:
        following_changed = True
        target.is_following = body.is_following
    if body.starred is not None and is_self:
        target.starred = body.starred
    if body.pinned is not None and is_self:
        target.pinned_at = (
            datetime.now(timezone.utc) if body.pinned else None
        )
    if body.notification_level is not None and is_self:
        level = body.notification_level.upper()
        if level in ("ALL", "MENTIONS", "NONE"):
            target.notification_level = level

    if following_changed:
        follow_notifications = await create_channel_follow_notifications(
            session,
            workspace_id=workspace_id,
            actor_user_id=user_id,
            target_user_id=target_user_id,
            channel=channel,
            following=bool(body.is_following),
        )

    await session.commit()

    if created_membership:
        await _emit_channel_joined(session, workspace_id, channel, [target_user_id])

    if following_changed:
        await _emit_channel_member_update(
            session, workspace_id, channel_id, target_user_id
        )
        if follow_notifications:
            await emit_home_notifications(
                session, workspace_id, follow_notifications
            )

    return {"ok": True}


_SEARCH_RESULT_LIMIT = 50


def _message_search_filters(term: str):
    needle = term.lower()
    return or_(
        func.lower(ChatMessage.body).contains(needle),
        func.lower(User.full_name).contains(needle),
    )


async def search_dm_messages(
    session: AsyncSession,
    workspace_id: str,
    user_id: str,
    conversation_id: str,
    query: str,
) -> dict:
    participant = await _assert_dm_participant(session, conversation_id, user_id)
    if participant.conversation.workspace_id != workspace_id:
        raise AppError(404, "NOT_FOUND", "Conversation not found")

    term = query.strip()
    if not term:
        return {"data": []}
    if len(term) > 200:
        raise AppError(400, "VALIDATION_ERROR", "Search query is too long")

    messages = (
        await session.scalars(
            select(ChatMessage)
            .join(User, ChatMessage.author_id == User.id)
            .where(
                ChatMessage.conversation_id == conversation_id,
                ChatMessage.workspace_id == workspace_id,
                _message_search_filters(term),
            )
            .options(*_MESSAGE_LOAD)
            .order_by(ChatMessage.created_at.desc())
            .limit(_SEARCH_RESULT_LIMIT)
        )
    ).all()

    return {"data": [map_search_message(m, user_id) for m in messages]}


async def search_channel_messages(
    session: AsyncSession,
    workspace_id: str,
    user_id: str,
    channel_id: str,
    query: str,
) -> dict:
    member = await _assert_channel_member(session, channel_id, user_id)
    if member.channel.workspace_id != workspace_id:
        raise AppError(404, "NOT_FOUND", "Channel not found")

    term = query.strip()
    if not term:
        return {"data": []}
    if len(term) > 200:
        raise AppError(400, "VALIDATION_ERROR", "Search query is too long")

    messages = (
        await session.scalars(
            select(ChatMessage)
            .join(User, ChatMessage.author_id == User.id)
            .where(
                ChatMessage.channel_id == channel_id,
                ChatMessage.workspace_id == workspace_id,
                _message_search_filters(term),
            )
            .options(*_MESSAGE_LOAD)
            .order_by(ChatMessage.created_at.desc())
            .limit(_SEARCH_RESULT_LIMIT)
        )
    ).all()

    return {"data": [map_search_message(m, user_id) for m in messages]}
