import asyncio
import re
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.utils import as_aware_utc
from app.db.models.chat import ChatChannel, ChatChannelMember, ChatMessage
from app.db.models.enums import InboxBucket, InboxItemType, InboxTimeGroup, MemberStatus, TaskStatus
from app.db.models.home import InboxItem, ListStatus, Task
from app.db.models.user import User
from app.db.models.workspace import WorkspaceMember
from app.services.home_helpers import LEGACY_STATUS_GROUP, STATUS_LABELS, map_inbox_type
from app.services.inbox_visibility import is_inbox_visible
from app.socket.emit import broadcast_home_notification

PERSON_MENTION_RE = re.compile(
    r"@([\w]+(?:\u00a0[\w]+)?|[\w]+&nbsp;[\w]+)",
    re.UNICODE,
)

CHANNEL_MENTION_RE = re.compile(
    r"(?:@channel|@everyone|@all|@here|#([\w-]+))",
    re.IGNORECASE,
)

SPECIAL_CHANNEL_MENTION_RE = re.compile(
    r"(?:@everyone|@all|@channel|@here)\b",
    re.IGNORECASE,
)


def body_has_channel_mention(body: str) -> bool:
    return bool(CHANNEL_MENTION_RE.search(body))


def has_special_channel_mention(body: str) -> bool:
    return bool(SPECIAL_CHANNEL_MENTION_RE.search(body))


def _notification_level(member: ChatChannelMember) -> str:
    level = getattr(member, "notification_level", None) or "ALL"
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


async def create_channel_remove_notification(
    session: AsyncSession,
    *,
    workspace_id: str,
    target_user_id: str,
    actor_user_id: str,
    channel: ChatChannel,
) -> list[tuple[str, InboxItem]]:
    if target_user_id == actor_user_id:
        return []

    users = await _load_users(session, [actor_user_id, target_user_id])
    actor_name = users.get(actor_user_id).full_name if users.get(actor_user_id) else "Someone"
    channel_label = channel.name

    item = InboxItem(
        workspace_id=workspace_id,
        user_id=target_user_id,
        type=InboxItemType.CHAT,
        title=f"Removed from #{channel_label}",
        preview=f"{actor_name} removed you from #{channel_label}",
        source=channel_label,
        unread=True,
        bucket=InboxBucket.ALL,
        time_group=InboxTimeGroup.TODAY,
        href="/chat",
        activity_kind="channel_access_removed",
    )
    session.add(item)
    await session.flush()
    return [(target_user_id, item)]


async def create_invite_accepted_notification(
    session: AsyncSession,
    *,
    workspace_id: str,
    actor_user_id: str,
    recipient_id: str,
    workspace_name: str,
) -> list[tuple[str, InboxItem]]:
    if recipient_id == actor_user_id:
        return []

    users = await _load_users(session, [actor_user_id])
    actor = users.get(actor_user_id)
    actor_name = actor.full_name if actor else "Someone"

    item = InboxItem(
        workspace_id=workspace_id,
        user_id=recipient_id,
        type=InboxItemType.REMINDER,
        title="Invite accepted",
        preview=f"{actor_name} accepted your invite to {workspace_name}",
        source=workspace_name,
        unread=True,
        bucket=InboxBucket.ALL,
        time_group=InboxTimeGroup.TODAY,
        href="/people",
        activity_kind="invite_accepted",
    )
    session.add(item)
    await session.flush()
    return [(recipient_id, item)]


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

    if channel:
        members = await _channel_members_for_notify(session, channel.id)
        level_by_user = {m.user_id: _notification_level(m) for m in members}
        if has_special_channel_mention(body):
            broadcast_ids = [m.user_id for m in members if m.user_id != author_user_id]
            recipient_ids = list(dict.fromkeys(recipient_ids + broadcast_ids))

        # Anyone in the workspace can be @mentioned, but only mentioned people
        # who actually have channel access get notified - no ChatChannelMember
        # row means no notification, same rule the DM branch below applies.
        recipient_ids = [
            rid
            for rid in recipient_ids
            if rid in level_by_user and level_by_user[rid] != "NONE"
        ]
    elif conversation_id:
        # DMs never reach the inbox - not the message, not an @mention inside
        # it. The conversation's own unread count is the whole notification.
        return []

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


_SHARE_RESOURCE_LABELS = {"space": "Space", "folder": "Folder", "list": "List"}


async def create_resource_share_notification(
    session: AsyncSession,
    *,
    workspace_id: str,
    recipient_id: str,
    actor_user_id: str,
    resource_type: str,
    resource_name: str,
    href: str,
) -> list[tuple[str, InboxItem]]:
    """Notify one recipient they were granted access to a Space/Folder/List.
    Only call this for an immediate (ACTIVE, real user) grant - a
    pending/email-only share has no user to notify yet."""
    if recipient_id == actor_user_id:
        return []

    users = await _load_users(session, [actor_user_id])
    actor_name = (
        users.get(actor_user_id).full_name if users.get(actor_user_id) else "Someone"
    )
    label = _SHARE_RESOURCE_LABELS[resource_type]
    item = InboxItem(
        workspace_id=workspace_id,
        user_id=recipient_id,
        type=InboxItemType.CHAT,
        title=f"{label} shared with you",
        preview=f'{actor_name} shared the {label.lower()} "{resource_name}" with you',
        source=resource_name,
        unread=True,
        bucket=InboxBucket.ALL,
        time_group=InboxTimeGroup.TODAY,
        href=href,
        activity_kind=f"{resource_type}_share",
    )
    session.add(item)
    await session.flush()
    return [(recipient_id, item)]


async def create_resource_unshare_notification(
    session: AsyncSession,
    *,
    workspace_id: str,
    recipient_id: str,
    actor_user_id: str,
    resource_type: str,
    resource_name: str,
) -> list[tuple[str, InboxItem]]:
    """Notify one recipient their access to a Space/Folder/List was
    revoked. Mirrors create_resource_share_notification - only call for a
    real removal (a row actually existed), same not-notifying-yourself
    guard. No href: the resource is gone from their view, nothing to
    link to."""
    if recipient_id == actor_user_id:
        return []

    users = await _load_users(session, [actor_user_id])
    actor_name = (
        users.get(actor_user_id).full_name if users.get(actor_user_id) else "Someone"
    )
    label = _SHARE_RESOURCE_LABELS[resource_type]
    item = InboxItem(
        workspace_id=workspace_id,
        user_id=recipient_id,
        type=InboxItemType.CHAT,
        title=f"Removed from {label.lower()}",
        preview=f'{actor_name} removed your access to the {label.lower()} "{resource_name}"',
        source=resource_name,
        unread=True,
        bucket=InboxBucket.ALL,
        time_group=InboxTimeGroup.TODAY,
        href="/home",
        activity_kind=f"{resource_type}_unshare",
    )
    session.add(item)
    await session.flush()
    return [(recipient_id, item)]


async def create_reaction_notification(
    session: AsyncSession,
    *,
    workspace_id: str,
    actor_user_id: str,
    emoji: str,
    message: ChatMessage,
) -> list[tuple[str, InboxItem]]:
    recipient_id = message.author_id
    if recipient_id == actor_user_id:
        return []

    if message.channel_id:
        channel = await session.get(ChatChannel, message.channel_id)
        if not channel:
            return []
        members = await _channel_members_for_notify(session, channel.id)
        level_by_user = {m.user_id: _notification_level(m) for m in members}
        if recipient_id not in level_by_user or level_by_user[recipient_id] == "NONE":
            return []
        channel_label = channel.name
        href = f"{_channel_href(channel)}?message={message.id}"
        source = channel_label
        title = f"Reacted with {emoji} in #{channel_label}"
    else:
        return []

    users = await _load_users(session, [actor_user_id])
    actor_name = (
        users.get(actor_user_id).full_name if users.get(actor_user_id) else "Someone"
    )
    snippet = _message_snippet(message.body)

    item = InboxItem(
        workspace_id=workspace_id,
        user_id=recipient_id,
        type=InboxItemType.REACTION,
        title=title,
        preview=f"{actor_name} reacted with {emoji}: {snippet}",
        source=source,
        unread=True,
        bucket=InboxBucket.ALL,
        time_group=InboxTimeGroup.TODAY,
        href=href,
        activity_kind="reaction",
    )
    session.add(item)
    await session.flush()
    return [(recipient_id, item)]


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
            select(ChatMessage).where(ChatMessage.parent_id == parent.id)
        )
    ).all()
    for reply in replies:
        if reply.author_id != author_user_id:
            users_to_notify.add(reply.author_id)

    # Anyone @mentioned anywhere in the thread (parent or earlier replies)
    # also hears about new activity, even if they never replied themselves.
    thread_bodies = [parent.body, *[r.body for r in replies]]
    for text in thread_bodies:
        labels = parse_person_mention_labels(text)
        mentioned = await _resolve_mentioned_user_ids(
            session, workspace_id, labels, exclude_user_id=author_user_id
        )
        users_to_notify.update(mentioned)

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


def notification_payload(item: InboxItem, status: dict[str, str] | None = None) -> dict:
    created = as_aware_utc(item.created_at or datetime.now(timezone.utc))
    payload = {
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
    if status:
        payload["statusColor"] = status["color"]
        payload["statusName"] = status["name"]
        payload["statusGroup"] = status["statusGroup"]
    return payload


_TASK_HREF_RE = re.compile(r"^/home/tasks/([^/?]+)")


def task_id_from_href(href: str | None) -> str | None:
    """Pulls the task id out of an Inbox item's href (e.g. /home/tasks/<id>)
    without a stored column - lets the notification icon reflect the task's
    live status color rather than a generic per-type icon, computed at read
    time so it never goes stale."""
    if not href:
        return None
    match = _TASK_HREF_RE.match(href)
    return match.group(1) if match else None


async def task_status_meta(
    session: AsyncSession, task_ids: set[str]
) -> dict[str, dict[str, str]]:
    """color/name/statusGroup per task, for the Inbox notification icon to
    show the task's actual status glyph (matching TaskDrawer's statusIcon())
    instead of a generic per-type icon. Prefers the list's ListStatus row;
    falls back to the legacy Task.status enum for tasks without one, same
    fallback _status_label() uses elsewhere."""
    if not task_ids:
        return {}
    rows = (
        await session.execute(
            select(
                Task.id,
                Task.status,
                Task.status_color,
                ListStatus.name,
                ListStatus.status_group,
            )
            .outerjoin(ListStatus, Task.status_id == ListStatus.id)
            .where(Task.id.in_(task_ids))
        )
    ).all()
    result: dict[str, dict[str, str]] = {}
    for task_id, legacy_status, color, status_name, status_group in rows:
        result[task_id] = {
            "color": color,
            "name": status_name or STATUS_LABELS.get(legacy_status, legacy_status.value.lower()),
            "statusGroup": status_group.value if status_group else LEGACY_STATUS_GROUP.get(legacy_status, "NOT_STARTED"),
        }
    return result


async def emit_home_notifications(
    session: AsyncSession,
    workspace_id: str,
    created: list[tuple[str, InboxItem]],
) -> None:
    if not created:
        return
    for _, item in created:
        await session.refresh(item)
    # Only push what the Inbox would show. Emitting a hidden row would put it
    # in the client's live notification cache, which merges into the list and
    # the badge and would reintroduce the drift this rule exists to prevent.
    visible = [(uid, item) for uid, item in created if is_inbox_visible(item)]
    if not visible:
        return
    task_ids = {
        tid for _, item in visible if (tid := task_id_from_href(item.href))
    }
    status_meta = await task_status_meta(session, task_ids)
    await asyncio.gather(
        *[
            broadcast_home_notification(
                workspace_id=workspace_id,
                user_ids=[recipient_id],
                notification=notification_payload(
                    item, status_meta.get(task_id_from_href(item.href))
                ),
            )
            for recipient_id, item in visible
        ]
    )


async def emit_channel_access_notifications(
    session: AsyncSession,
    workspace_id: str,
    created: list[tuple[str, InboxItem]],
) -> None:
    await emit_home_notifications(session, workspace_id, created)


async def create_task_comment_notifications(
    session: AsyncSession,
    *,
    workspace_id: str,
    actor_user_id: str,
    task_name: str,
    task_id: str,
    comment_preview: str,
    follower_ids: list[str],
) -> list[tuple[str, InboxItem]]:
    if not follower_ids:
        return []

    users = await _load_users(session, [actor_user_id, *follower_ids])
    actor = users.get(actor_user_id)
    actor_name = actor.full_name if actor else "Someone"
    href = f"/home/tasks/{task_id}"
    preview = _message_snippet(comment_preview, 120)
    created: list[tuple[str, InboxItem]] = []

    for follower_id in dict.fromkeys(follower_ids):
        if follower_id == actor_user_id:
            continue
        item = InboxItem(
            workspace_id=workspace_id,
            user_id=follower_id,
            type=InboxItemType.COMMENT,
            title=f"Comment on {task_name}",
            preview=f"{actor_name}: {preview}",
            source=task_name,
            unread=True,
            bucket=InboxBucket.ALL,
            time_group=InboxTimeGroup.TODAY,
            href=href,
            activity_kind="task_comment",
        )
        session.add(item)
        created.append((follower_id, item))

    if created:
        await session.flush()
    return created


async def create_task_comment_mention_notifications(
    session: AsyncSession,
    *,
    workspace_id: str,
    actor_user_id: str,
    task_name: str,
    task_id: str,
    comment_body: str,
    already_notified_ids: set[str] | None = None,
) -> list[tuple[str, InboxItem]]:
    """Send inbox notifications to @mentioned users in a task comment."""
    labels = parse_person_mention_labels(comment_body)
    mentioned_ids = await _resolve_mentioned_user_ids(
        session, workspace_id, labels, exclude_user_id=actor_user_id
    )
    if not mentioned_ids:
        return []

    users = await _load_users(session, [actor_user_id, *mentioned_ids])
    actor = users.get(actor_user_id)
    actor_name = actor.full_name if actor else "Someone"
    href = f"/home/tasks/{task_id}"
    snippet = _message_snippet(comment_body)
    created: list[tuple[str, InboxItem]] = []

    for user_id in mentioned_ids:
        if already_notified_ids and user_id in already_notified_ids:
            continue
        item = InboxItem(
            workspace_id=workspace_id,
            user_id=user_id,
            type=InboxItemType.MENTION,
            title=f"Mentioned you in {task_name}",
            preview=f"{actor_name}: {snippet}",
            source=task_name,
            unread=True,
            bucket=InboxBucket.ALL,
            time_group=InboxTimeGroup.TODAY,
            href=href,
            activity_kind="task_mention",
        )
        session.add(item)
        created.append((user_id, item))

    if created:
        await session.flush()
    return created


async def create_task_comment_reply_notifications(
    session: AsyncSession,
    *,
    workspace_id: str,
    actor_user_id: str,
    task_name: str,
    task_id: str,
    parent_author_id: str,
    comment_preview: str,
    already_notified_ids: set[str] | None = None,
) -> list[tuple[str, InboxItem]]:
    if parent_author_id == actor_user_id:
        return []
    if already_notified_ids and parent_author_id in already_notified_ids:
        return []

    users = await _load_users(session, [actor_user_id, parent_author_id])
    actor = users.get(actor_user_id)
    actor_name = actor.full_name if actor else "Someone"
    href = f"/home/tasks/{task_id}"
    preview = _message_snippet(comment_preview, 120)
    item = InboxItem(
        workspace_id=workspace_id,
        user_id=parent_author_id,
        type=InboxItemType.COMMENT,
        title=f"Reply on {task_name}",
        preview=f"{actor_name}: {preview}",
        source=task_name,
        unread=True,
        bucket=InboxBucket.ALL,
        time_group=InboxTimeGroup.TODAY,
        href=href,
        activity_kind="task_comment_reply",
    )
    session.add(item)
    await session.flush()
    return [(parent_author_id, item)]


async def create_task_assignment_notifications(
    session: AsyncSession,
    *,
    workspace_id: str,
    actor_user_id: str,
    task_name: str,
    task_id: str,
    assignee_ids: list[str],
) -> list[tuple[str, InboxItem]]:
    if not assignee_ids:
        return []

    users = await _load_users(session, [actor_user_id, *assignee_ids])
    actor = users.get(actor_user_id)
    actor_name = actor.full_name if actor else "Someone"
    href = f"/home/tasks/{task_id}"
    created: list[tuple[str, InboxItem]] = []

    for assignee_id in dict.fromkeys(assignee_ids):
        if assignee_id == actor_user_id:
            continue
        item = InboxItem(
            workspace_id=workspace_id,
            user_id=assignee_id,
            type=InboxItemType.ASSIGNMENT,
            title=f"Assigned: {task_name}",
            preview=f"{actor_name} assigned you to {task_name}",
            source=task_name,
            unread=True,
            bucket=InboxBucket.ALL,
            time_group=InboxTimeGroup.TODAY,
            href=href,
            activity_kind="task_assigned",
        )
        session.add(item)
        created.append((assignee_id, item))

    if created:
        await session.flush()
    return created


async def task_notification_recipients(
    session: AsyncSession,
    *,
    task_id: str,
    exclude_user_id: str | None = None,
) -> list[str]:
    row = (
        await session.execute(
            select(Task.assignee_ids, Task.follower_ids).where(Task.id == task_id)
        )
    ).first()
    assignees = row[0] if row else []
    followers = row[1] if row else []
    recipient_ids: list[str] = []
    seen: set[str] = set()
    for user_id in [*assignees, *followers]:
        if not user_id:
            continue
        if exclude_user_id and user_id == exclude_user_id:
            continue
        if user_id in seen:
            continue
        seen.add(user_id)
        recipient_ids.append(user_id)
    return recipient_ids


async def create_task_activity_notifications(
    session: AsyncSession,
    *,
    workspace_id: str,
    actor_user_id: str,
    task_name: str,
    task_id: str,
    recipient_ids: list[str],
    title: str,
    preview_template: str,
    activity_kind: str,
    item_type: InboxItemType = InboxItemType.ASSIGNMENT,
) -> list[tuple[str, InboxItem]]:
    if not recipient_ids:
        return []

    users = await _load_users(session, [actor_user_id, *recipient_ids])
    actor = users.get(actor_user_id)
    actor_name = actor.full_name if actor else "Someone"
    href = f"/home/tasks/{task_id}"
    created: list[tuple[str, InboxItem]] = []

    for recipient_id in dict.fromkeys(recipient_ids):
        if recipient_id == actor_user_id:
            continue
        item = InboxItem(
            workspace_id=workspace_id,
            user_id=recipient_id,
            type=item_type,
            title=title,
            preview=preview_template.format(actor=actor_name, task=task_name),
            source=task_name,
            unread=True,
            bucket=InboxBucket.ALL,
            time_group=InboxTimeGroup.TODAY,
            href=href,
            activity_kind=activity_kind,
        )
        session.add(item)
        created.append((recipient_id, item))

    if created:
        await session.flush()
    return created
