from app.db.models.chat import ChatMessage, DirectConversation
from app.services.attachment_service import map_attachment


def _reaction_list(msg: ChatMessage) -> list[dict]:
    reaction_map: dict[str, int] = {}
    for r in msg.reactions:
        reaction_map[r.emoji] = reaction_map.get(r.emoji, 0) + 1
    return [
        {"emoji": emoji, "count": count}
        for emoji, count in reaction_map.items()
    ]


def map_message(
    msg: ChatMessage,
    current_user_id: str,
    *,
    thread_count: int | None = None,
) -> dict:
    return {
        "id": msg.id,
        "authorId": msg.author_id,
        "authorName": msg.author.full_name,
        "body": msg.body,
        "createdAt": msg.created_at.isoformat(),
        "isSelf": msg.author_id == current_user_id,
        "reactions": _reaction_list(msg),
        "threadCount": (
            thread_count if thread_count is not None else len(msg.replies)
        ),
        "attachments": [map_attachment(a) for a in (msg.attachments or [])],
    }


def map_search_message(msg: ChatMessage, current_user_id: str) -> dict:
    payload = map_message(msg, current_user_id)
    if msg.parent_id:
        payload["parentId"] = msg.parent_id
        payload["inThread"] = True
    return payload


def map_message_broadcast(
    msg: ChatMessage,
    *,
    thread_count: int | None = None,
) -> dict:
    """Neutral wire shape for Socket.IO — each client derives isSelf locally."""
    return {
        "id": msg.id,
        "authorId": msg.author_id,
        "authorName": msg.author.full_name,
        "body": msg.body,
        "createdAt": msg.created_at.isoformat(),
        "reactions": _reaction_list(msg),
        "threadCount": (
            thread_count if thread_count is not None else len(msg.replies)
        ),
        "attachments": [map_attachment(a) for a in (msg.attachments or [])],
    }


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
    return "Direct message"
