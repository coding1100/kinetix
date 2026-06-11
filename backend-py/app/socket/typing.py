from __future__ import annotations

from dataclasses import dataclass, field
from typing import Literal

ConversationKind = Literal["channel", "dm"]


@dataclass
class _TypingEntry:
    user_id: str
    sid_count: int = 0


@dataclass
class _ConversationTyping:
    users: dict[str, _TypingEntry] = field(default_factory=dict)


_registry: dict[str, dict[str, _ConversationTyping]] = {}


def _key(workspace_id: str, kind: ConversationKind, conversation_id: str) -> tuple[str, str]:
    return workspace_id, f"{kind}:{conversation_id}"


def start_typing(
    workspace_id: str,
    kind: ConversationKind,
    conversation_id: str,
    user_id: str,
) -> list[str]:
    ws_key, conv_key = _key(workspace_id, kind, conversation_id)
    conv = _registry.setdefault(ws_key, {}).setdefault(conv_key, _ConversationTyping())
    entry = conv.users.setdefault(user_id, _TypingEntry(user_id=user_id))
    entry.sid_count += 1
    return [uid for uid, e in conv.users.items() if e.sid_count > 0 and uid != user_id]


def stop_typing(
    workspace_id: str,
    kind: ConversationKind,
    conversation_id: str,
    user_id: str,
) -> list[str]:
    ws_key, conv_key = _key(workspace_id, kind, conversation_id)
    conv = _registry.get(ws_key, {}).get(conv_key)
    if not conv:
        return []
    entry = conv.users.get(user_id)
    if entry:
        entry.sid_count = max(0, entry.sid_count - 1)
        if entry.sid_count <= 0:
            conv.users.pop(user_id, None)
    if not conv.users:
        _registry.get(ws_key, {}).pop(conv_key, None)
    return [uid for uid, e in conv.users.items() if e.sid_count > 0 and uid != user_id]


def clear_user(
    user_id: str,
) -> list[tuple[str, ConversationKind, str, list[str]]]:
    updates: list[tuple[str, ConversationKind, str, list[str]]] = []
    for workspace_id, ws in list(_registry.items()):
        for conv_key in list(ws.keys()):
            conv = ws.get(conv_key)
            if not conv:
                continue
            entry = conv.users.get(user_id)
            if not entry:
                continue
            conv.users.pop(user_id, None)
            kind_str, _, conv_id = conv_key.partition(":")
            kind: ConversationKind = "channel" if kind_str == "channel" else "dm"
            remaining = [uid for uid, e in conv.users.items() if e.sid_count > 0]
            updates.append((workspace_id, kind, conv_id, remaining))
            if not conv.users:
                ws.pop(conv_key, None)
    return updates
