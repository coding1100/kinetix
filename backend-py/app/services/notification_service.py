import asyncio
import re
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.models.chat import ChatChannel, ChatChannelMember, ChatMessage, DirectParticipant
from app.db.models.enums import InboxBucket, InboxItemType, InboxTimeGroup, MemberStatus
from app.db.models.home import InboxItem
from app.db.models.user import User
from app.db.models.workspace import WorkspaceMember
from app.services.home_helpers import map_inbox_type
from app.socket.emit import broadcast_home_notification

PERSON_MENTION_RE = re.compile(
    r"@([\w]+(?:\u00a0[\w]+)?|[\w]+&nbsp;[\w]+)",
    re.UNICODE,
)

CHANNEL_MENTION_RE = re.compile(
    r"(?:@channel|#([\w-]+))",
    re.IGNORECASE,
)


def body_has_channel_mention(body: str) -> bool:
    return bool(CHANNEL_MENTION_RE.search(body))


def _notification_level(member: ChatChannelMember) -> str:
    level = getattr(member, "notification_level", None) or "MENTIONS"
    return str(level).upper()


async def _channel_members_for_notify(
    session: AsyncSession, channel_id: str
) -> list[ChatChannelMember]:
    return list(
        (
            await session.scalars(
                select(ChatChannelMember).where(
                    ChatChannelMember.channel_id == channel_id
                )
            )
        ).all()
    )


def parse_person_mention_labels(body: str) -> list[str]:
    labels: list[str] = []
    seen: set[str] = set()
    for match in PERSON_MENTION_RE.finditer(body):
        raw = match.group(1)
        label = (
            raw.replace("\u00a0", " ")
            .replace("&nbsp;", " ")
            .replace("&nbsp", " ")
        )
        label = " ".join(label.split())
        key = label.lower()
        if label and key not in seen:
            seen.add(key)
            labels.append(label)
    return labels


def _message_snippet(body: str, max_len: int = 80) -> str:
    one_line = " ".join(body.split())
    if len(one_line) <= max_len:
        return one_line
    return one_line[: max_len - 1].rstrip() + "…"


def _channel_href(channel: ChatChannel) -> str:
    return f"/chat/c/{channel.id}"


async def _load_users(
    session: AsyncSession, user_ids: list[str]
) -> dict[str, User]:
    if not user_ids:
        return {}
    rows = (
        await session.scalars(select(User).where(User.id.in_(user_ids)))
    ).all()
    return {u.id: u for u in rows}


async def create_channel_access_removed_notifications(
    session: AsyncSession,
    *,
    workspace_id: str,
    recipient_ids: list[str],
    actor_user_id: str,
    channel: ChatChannel,
) -> list[tuple[str, InboxItem]]:
    if not recipient_ids:
        return []

    users = await _load_users(session, [actor_user_id, *recipient_ids])
    actor_name = users.get(actor_user_id).full_name if users.get(actor_user_id) else "Someone"
    channel_label = channel.name
    href = _channel_href(channel)

    created: list[tuple[str, InboxItem]] = []
    removed_targets = [rid for rid in dict.fromkeys(recipient_ids) if rid != actor_user_id]
    for recipient_id in removed_targets:
        item = InboxItem(
            workspace_id=workspace_id,
            user_id=recipient_id,
            type=InboxItemType.CHAT,
            title=f"Removed from #{channel_label}",
            preview=f"{actor_name} removed you from #{channel_label}",
            source=channel_label,
            unread=True,
            bucket=InboxBucket.ALL,
            time_group=InboxTimeGroup.TODAY,
            href="/chat/channels",
            activity_kind="channel_access_removed",
        )
        session.add(item)
        created.append((recipient_id, item))

    if removed_targets:
        names = [
            users.get(rid).full_name if users.get(rid) else "a member"
            for rid in removed_targets
        ]
        preview = (
            f"You removed {names[0]} from #{channel_label}"
            if len(names) == 1
            else f"You removed {len(names)} people from #{channel_label}"
        )
        actor_item = InboxItem(
            workspace_id=workspace_id,
            user_id=actor_user_id,
            type=InboxItemType.CHAT,
            title=f"Removed from #{channel_label}",
            preview=preview,
            source=channel_label,
            unread=True,
            bucket=InboxBucket.ALL,
            time_group=InboxTimeGroup.TODAY,
            href=href,
            activity_kind="channel_access_removed_actor",
        )
        session.add(actor_item)
        created.append((actor_user_id, actor_item))

    if created:
        await session.flush()
    return created


async def create_channel_access_notifications(
    session: AsyncSession,
    *,
    workspace_id: str,
    recipient_ids: list[str],
    actor_user_id: str,
    channel: ChatChannel,
) -> list[tuple[str, InboxItem]]:
    if not recipient_ids:
        return []

    users = await _load_users(session, [actor_user_id, *recipient_ids])
    actor_name = users.get(actor_user_id).full_name if users.get(actor_user_id) else "Someone"
    channel_label = channel.name
    href = _channel_href(channel)

    created: list[tuple[str, InboxItem]] = []
    actor_item: InboxItem | None = None
    for recipient_id in dict.fromkeys(recipient_ids):
        item = InboxItem(
            workspace_id=workspace_id,
            user_id=recipient_id,
            type=InboxItemType.CHAT,
            title=f"Added to #{channel_label}",
            preview=f"{actor_name} added you to #{channel_label}",
            source=channel_label,
            unread=True,
            bucket=InboxBucket.ALL,
            time_group=InboxTimeGroup.TODAY,
            href=href,
            activity_kind="channel_access",
        )
        session.add(item)
        created.append((recipient_id, item))

        if actor_item is None and actor_user_id != recipient_id:
            names = [
                users.get(rid).full_name if users.get(rid) else "a member"
                for rid in dict.fromkeys(recipient_ids)
                if rid != actor_user_id
            ]
            preview = (
                f"You added {names[0]} to #{channel_label}"
                if len(names) == 1
                else f"You added {len(names)} people to #{channel_label}"
            )
            actor_item = InboxItem(
                workspace_id=workspace_id,
                user_id=actor_user_id,
                type=InboxItemType.CHAT,
                title=f"Added to #{channel_label}",
                preview=preview,
                source=channel_label,
                unread=True,
                bucket=InboxBucket.ALL,
                time_group=InboxTimeGroup.TODAY,
                href=href,
                activity_kind="channel_access_actor",
            )

    if actor_item is not None:
        session.add(actor_item)
        created.append((actor_user_id, actor_item))

    if created:
        await session.flush()
    return created


async def _resolve_mentioned_user_ids(
    session: AsyncSession,
    workspace_id: str,
    labels: list[str],
    *,
    exclude_user_id: str | None = None,
) -> list[str]:
    if not labels:
        return []

    members = (
        await session.scalars(
            select(WorkspaceMember)
            .where(
                WorkspaceMember.workspace_id == workspace_id,
                WorkspaceMember.status == MemberStatus.ACTIVE,
            )
            .options(selectinload(WorkspaceMember.user))
        )
    ).all()
    name_to_id: dict[str, str] = {}
    for member in members:
        if member.user and member.user.full_name:
            name_to_id[member.user.full_name.lower()] = member.user_id

    resolved: list[str] = []
    seen: set[str] = set()
    for label in labels:
        user_id = name_to_id.get(label.lower())
        if not user_id or user_id == exclude_user_id or user_id in seen:
            continue
        seen.add(user_id)
        resolved.append(user_id)
    return resolved


async def create_mention_notifications(
    session: AsyncSession,
    *,
    workspace_id: str,
    author_user_id: str,
    body: str,
    channel: ChatChannel | None = None,
    conversation_id: str | None = None,
) -> list[tuple[str, InboxItem]]:
    labels = parse_person_mention_labels(body)
    recipient_ids = await _resolve_mentioned_user_ids(
        session, workspace_id, labels, exclude_user_id=author_user_id
    )
    if not recipient_ids:
        return []

    if channel:
        members = await _channel_members_for_notify(session, channel.id)
        level_by_user = {m.user_id: _notification_level(m) for m in members}
        recipient_ids = [
            rid
            for rid in recipient_ids
            if level_by_user.get(rid, "MENTIONS") != "NONE"
        ]
    elif conversation_id:
        participant_ids = set(
            await session.scalars(
                select(DirectParticipant.user_id).where(
                    DirectParticipant.conversation_id == conversation_id
                )
            )
        )
        recipient_ids = [
            rid for rid in recipient_ids if rid in participant_ids
        ]

    if not recipient_ids:
        return []

    users = await _load_users(session, [author_user_id, *recipient_ids])
    actor_name = (
        users.get(author_user_id).full_name
        if users.get(author_user_id)
        else "Someone"
    )
    snippet = _message_snippet(body)
    created: list[tuple[str, InboxItem]] = []

    if channel:
        channel_label = channel.name
        href = _channel_href(channel)
        title = f"Mentioned in #{channel_label}"
        preview = f"{actor_name} mentioned you in #{channel_label}: {snippet}"
        source = channel_label
        activity_kind = "mention"
    else:
        href = "/chat"
        title = "Mentioned you"
        preview = f"{actor_name} mentioned you: {snippet}"
        source = actor_name
        activity_kind = "mention_dm"

    for recipient_id in recipient_ids:
        item = InboxItem(
            workspace_id=workspace_id,
            user_id=recipient_id,
            type=InboxItemType.MENTION,
            title=title,
            preview=preview,
            source=source,
            unread=True,
            bucket=InboxBucket.ALL,
            time_group=InboxTimeGroup.TODAY,
            href=href,
            activity_kind=activity_kind,
        )
        session.add(item)
        created.append((recipient_id, item))

    await session.flush()
    return created


async def create_channel_broadcast_notifications(
    session: AsyncSession,
    *,
    workspace_id: str,
    author_user_id: str,
    channel: ChatChannel,
    body: str,
    message_id: str,
) -> list[tuple[str, InboxItem]]:
    members = await _channel_members_for_notify(session, channel.id)
    has_channel_mention = body_has_channel_mention(body)
    channel_label = channel.name
    href = f"{_channel_href(channel)}?message={message_id}"
    users = await _load_users(session, [author_user_id])
    actor_name = (
        users.get(author_user_id).full_name if users.get(author_user_id) else "Someone"
    )
    snippet = _message_snippet(body)
    created: list[tuple[str, InboxItem]] = []

    for member in members:
        if member.user_id == author_user_id:
            continue
        level = _notification_level(member)
        if level == "NONE":
            continue
        if level == "MENTIONS" and not has_channel_mention:
            person_labels = parse_person_mention_labels(body)
            mentioned = await _resolve_mentioned_user_ids(
                session, workspace_id, person_labels, exclude_user_id=author_user_id
            )
            if member.user_id not in mentioned and not has_channel_mention:
                continue
        item = InboxItem(
            workspace_id=workspace_id,
            user_id=member.user_id,
            type=InboxItemType.CHAT,
            title=f"New message in #{channel_label}",
            preview=f"{actor_name}: {snippet}",
            source=channel_label,
            unread=True,
            bucket=InboxBucket.ALL,
            time_group=InboxTimeGroup.TODAY,
            href=href,
            activity_kind="channel_message",
        )
        session.add(item)
        created.append((member.user_id, item))

    await session.flush()
    return created


async def create_thread_reply_notifications(
    session: AsyncSession,
    *,
    workspace_id: str,
    author_user_id: str,
    parent: ChatMessage,
    reply_body: str,
    kind: str,
    conversation_id: str,
) -> list[tuple[str, InboxItem]]:
    users_to_notify: set[str] = set()
    if parent.author_id != author_user_id:
        users_to_notify.add(parent.author_id)

    replies = (
        await session.scalars(
            select(ChatMessage.author_id).where(
                ChatMessage.parent_id == parent.id,
                ChatMessage.author_id != author_user_id,
            )
        )
    ).all()
    for author_id in replies:
        if author_id != author_user_id:
            users_to_notify.add(author_id)

    if not users_to_notify:
        return []

    users = await _load_users(session, [author_user_id, *users_to_notify])
    actor_name = (
        users.get(author_user_id).full_name if users.get(author_user_id) else "Someone"
    )
    snippet = _message_snippet(reply_body)
    if kind == "channel":
        channel = await session.get(ChatChannel, conversation_id)
        source = channel.name if channel else "Channel"
        href = f"/chat/c/{conversation_id}?thread={parent.id}"
        title = f"Reply in #{source}"
    else:
        source = "Direct message"
        href = f"/chat/dm/{conversation_id}?thread={parent.id}"
        title = "New thread reply"

    created: list[tuple[str, InboxItem]] = []
    for recipient_id in users_to_notify:
        item = InboxItem(
            workspace_id=workspace_id,
            user_id=recipient_id,
            type=InboxItemType.REPLY,
            title=title,
            preview=f"{actor_name}: {snippet}",
            source=source,
            unread=True,
            bucket=InboxBucket.ALL,
            time_group=InboxTimeGroup.TODAY,
            href=href,
            activity_kind="thread_reply",
        )
        session.add(item)
        created.append((recipient_id, item))

    await session.flush()
    return created


async def create_channel_deleted_notifications(
    session: AsyncSession,
    *,
    workspace_id: str,
    member_ids: list[str],
    actor_user_id: str,
    channel_name: str,
) -> list[tuple[str, InboxItem]]:
    if not member_ids:
        return []

    users = await _load_users(session, [actor_user_id])
    actor_name = (
        users.get(actor_user_id).full_name if users.get(actor_user_id) else "Someone"
    )
    channel_label = channel_name
    href = "/chat/channels"
    created: list[tuple[str, InboxItem]] = []

    for member_id in dict.fromkeys(member_ids):
        if member_id == actor_user_id:
            continue
        item = InboxItem(
            workspace_id=workspace_id,
            user_id=member_id,
            type=InboxItemType.CHAT,
            title=f"Channel deleted",
            preview=f"{actor_name} deleted #{channel_label}",
            source=channel_label,
            unread=True,
            bucket=InboxBucket.ALL,
            time_group=InboxTimeGroup.TODAY,
            href=href,
            activity_kind="channel_deleted",
        )
        session.add(item)
        created.append((member_id, item))

    others = [mid for mid in dict.fromkeys(member_ids) if mid != actor_user_id]
    if others:
        preview = (
            f"You deleted #{channel_label}"
            if len(others) == len(member_ids) - 1
            else f"You deleted #{channel_label} for {len(member_ids)} members"
        )
        actor_item = InboxItem(
            workspace_id=workspace_id,
            user_id=actor_user_id,
            type=InboxItemType.CHAT,
            title=f"Channel deleted",
            preview=preview,
            source=channel_label,
            unread=True,
            bucket=InboxBucket.ALL,
            time_group=InboxTimeGroup.TODAY,
            href=href,
            activity_kind="channel_deleted_actor",
        )
        session.add(actor_item)
        created.append((actor_user_id, actor_item))

    if created:
        await session.flush()
    return created


async def create_channel_follow_notifications(
    session: AsyncSession,
    *,
    workspace_id: str,
    actor_user_id: str,
    target_user_id: str,
    channel: ChatChannel,
    following: bool,
) -> list[tuple[str, InboxItem]]:
    users = await _load_users(session, [actor_user_id, target_user_id])
    actor_name = users.get(actor_user_id).full_name if users.get(actor_user_id) else "Someone"
    target_name = users.get(target_user_id).full_name if users.get(target_user_id) else "a member"
    channel_label = channel.name
    href = _channel_href(channel)
    created: list[tuple[str, InboxItem]] = []

    if actor_user_id == target_user_id:
        if following:
            title = f"Following #{channel_label}"
            preview = f"You started following #{channel_label}"
            activity_kind = "channel_follow_self"
        else:
            title = f"Unfollowed #{channel_label}"
            preview = f"You unfollowed #{channel_label}"
            activity_kind = "channel_unfollow_self"
        item = InboxItem(
            workspace_id=workspace_id,
            user_id=actor_user_id,
            type=InboxItemType.CHAT,
            title=title,
            preview=preview,
            source=channel_label,
            unread=True,
            bucket=InboxBucket.ALL,
            time_group=InboxTimeGroup.TODAY,
            href=href,
            activity_kind=activity_kind,
        )
        session.add(item)
        created.append((actor_user_id, item))
    else:
        if following:
            target_item = InboxItem(
                workspace_id=workspace_id,
                user_id=target_user_id,
                type=InboxItemType.CHAT,
                title=f"New follower in #{channel_label}",
                preview=f"{actor_name} started following you in #{channel_label}",
                source=channel_label,
                unread=True,
                bucket=InboxBucket.ALL,
                time_group=InboxTimeGroup.TODAY,
                href=href,
                activity_kind="channel_follow",
            )
            actor_item = InboxItem(
                workspace_id=workspace_id,
                user_id=actor_user_id,
                type=InboxItemType.CHAT,
                title=f"Following in #{channel_label}",
                preview=f"You started following {target_name} in #{channel_label}",
                source=channel_label,
                unread=True,
                bucket=InboxBucket.ALL,
                time_group=InboxTimeGroup.TODAY,
                href=href,
                activity_kind="channel_follow_actor",
            )
        else:
            target_item = InboxItem(
                workspace_id=workspace_id,
                user_id=target_user_id,
                type=InboxItemType.CHAT,
                title=f"Unfollowed in #{channel_label}",
                preview=f"{actor_name} unfollowed you in #{channel_label}",
                source=channel_label,
                unread=True,
                bucket=InboxBucket.ALL,
                time_group=InboxTimeGroup.TODAY,
                href=href,
                activity_kind="channel_unfollow",
            )
            actor_item = InboxItem(
                workspace_id=workspace_id,
                user_id=actor_user_id,
                type=InboxItemType.CHAT,
                title=f"Unfollowed in #{channel_label}",
                preview=f"You unfollowed {target_name} in #{channel_label}",
                source=channel_label,
                unread=True,
                bucket=InboxBucket.ALL,
                time_group=InboxTimeGroup.TODAY,
                href=href,
                activity_kind="channel_unfollow_actor",
            )
        session.add(target_item)
        session.add(actor_item)
        created.append((target_user_id, target_item))
        created.append((actor_user_id, actor_item))

    await session.flush()
    return created


def notification_payload(item: InboxItem) -> dict:
    created = item.created_at or datetime.now(timezone.utc)
    return {
        "id": item.id,
        "type": map_inbox_type(item.type),
        "title": item.title,
        "preview": item.preview,
        "source": item.source,
        "createdAt": created.isoformat(),
        "unread": item.unread,
        "group": item.time_group.value.lower(),
        "href": item.href,
    }


async def emit_home_notifications(
    session: AsyncSession,
    workspace_id: str,
    created: list[tuple[str, InboxItem]],
) -> None:
    if not created:
        return
    for _, item in created:
        await session.refresh(item)
    await asyncio.gather(
        *[
            broadcast_home_notification(
                workspace_id=workspace_id,
                user_ids=[recipient_id],
                notification=notification_payload(item),
            )
            for recipient_id, item in created
        ]
    )


async def emit_channel_access_notifications(
    session: AsyncSession,
    workspace_id: str,
    created: list[tuple[str, InboxItem]],
) -> None:
    await emit_home_notifications(session, workspace_id, created)
