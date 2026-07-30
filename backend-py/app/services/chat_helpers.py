from dataclasses import dataclass
from datetime import datetime

from sqlalchemy import inspect as sa_inspect

from app.db.models.chat import ChatMessage, DirectConversation
from app.services.attachment_service import map_attachment


@dataclass
class ThreadSummary:
    count: int
    last_reply_author_id: str
    last_reply_author_name: str
    last_reply_at: datetime


def _default_thread_count(msg: ChatMessage) -> int:
    if "replies" not in sa_inspect(msg).unloaded:
        return len(msg.replies)
    return 0


def _reaction_list(msg: ChatMessage) -> list[dict]:
    reaction_map: dict[str, list[dict]] = {}
    for r in msg.reactions:
        reaction_map.setdefault(r.emoji, []).append(
            {"id": r.user_id, "fullName": r.user.full_name}
        )
    return [
        {"emoji": emoji, "count": len(users), "users": users}
        for emoji, users in reaction_map.items()
    ]


def _thread_fields(
    msg: ChatMessage,
    *,
    thread_count: int | None,
    thread_summary: ThreadSummary | None,
) -> dict:
    if thread_summary is not None:
        return {
            "threadCount": thread_summary.count,
            "lastReplyAuthorId": thread_summary.last_reply_author_id,
            "lastReplyAuthorName": thread_summary.last_reply_author_name,
            "lastReplyAt": thread_summary.last_reply_at.isoformat(),
        }
    return {
        "threadCount": (
            thread_count if thread_count is not None else _default_thread_count(msg)
        )
    }


def map_message(
    msg: ChatMessage,
    current_user_id: str,
    *,
    thread_count: int | None = None,
    thread_summary: ThreadSummary | None = None,
    read_by_user_ids: list[str] | None = None,
) -> dict:
    payload = {
        "id": msg.id,
        "authorId": msg.author_id,
        "authorName": msg.author.full_name,
        "authorIsDisabled": msg.author.is_disabled,
        "body": msg.body,
        "createdAt": msg.created_at.isoformat(),
        "isSelf": msg.author_id == current_user_id,
        "reactions": _reaction_list(msg),
        **_thread_fields(msg, thread_count=thread_count, thread_summary=thread_summary),
        "attachments": [map_attachment(a) for a in (msg.attachments or [])],
    }
    if msg.pinned_at:
        payload["pinnedAt"] = msg.pinned_at.isoformat()
    if read_by_user_ids:
        payload["readByUserIds"] = read_by_user_ids
    return payload


def map_search_message(
    msg: ChatMessage,
    current_user_id: str,
    *,
    thread_count: int | None = None,
    thread_summary: ThreadSummary | None = None,
) -> dict:
    payload = map_message(
        msg,
        current_user_id,
        thread_count=thread_count,
        thread_summary=thread_summary,
    )
    if msg.parent_id:
        payload["parentId"] = msg.parent_id
        payload["inThread"] = True
    return payload


def map_message_broadcast(
    msg: ChatMessage,
    *,
    thread_count: int | None = None,
    thread_summary: ThreadSummary | None = None,
) -> dict:
    """Neutral wire shape for Socket.IO — each client derives isSelf locally."""
    payload = {
        "id": msg.id,
        "authorId": msg.author_id,
        "authorName": msg.author.full_name,
        "authorIsDisabled": msg.author.is_disabled,
        "body": msg.body,
        "createdAt": msg.created_at.isoformat(),
        "reactions": _reaction_list(msg),
        **_thread_fields(msg, thread_count=thread_count, thread_summary=thread_summary),
        "attachments": [map_attachment(a) for a in (msg.attachments or [])],
    }
    if msg.pinned_at:
        payload["pinnedAt"] = msg.pinned_at.isoformat()
    return payload


def dm_display_name(conversation: DirectConversation, current_user_id: str) -> str:
    if conversation.is_group:
        custom = (conversation.name or "").strip()
        if custom and custom.lower() != "group chat":
            return custom
        others = [
            p.user.full_name
            for p in conversation.participants
            if p.user_id != current_user_id
        ]
        if others:
            return ", ".join(others)
        return "Group chat"
    for p in conversation.participants:
        if p.user_id != current_user_id:
            return p.user.full_name
    self_participant = next(
        (p for p in conversation.participants if p.user_id == current_user_id),
        None,
    )
    if self_participant:
        return f"{self_participant.user.full_name} -- You"
    return "Direct message"
