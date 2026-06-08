from __future__ import annotations

from dataclasses import dataclass, field
from typing import Literal

PresenceStatus = Literal["online", "away", "busy", "offline"]


@dataclass
class _UserPresence:
    sid_count: int = 0
    manual_status: PresenceStatus | None = None


@dataclass
class _SidState:
    user_id: str
    workspaces: set[str] = field(default_factory=set)


_registry: dict[str, dict[str, _UserPresence]] = {}
_sids: dict[str, _SidState] = {}


def _effective_status(entry: _UserPresence) -> PresenceStatus:
    if entry.sid_count <= 0:
        return "offline"
    if entry.manual_status:
        return entry.manual_status
    return "online"


def get_presence(workspace_id: str, user_id: str) -> PresenceStatus:
    ws = _registry.get(workspace_id)
    if not ws:
        return "offline"
    entry = ws.get(user_id)
    if not entry:
        return "offline"
    return _effective_status(entry)


def get_workspace_presence(workspace_id: str) -> list[dict[str, str]]:
    ws = _registry.get(workspace_id, {})
    return [
        {"userId": user_id, "status": _effective_status(entry)}
        for user_id, entry in ws.items()
        if entry.sid_count > 0 and _effective_status(entry) != "offline"
    ]


def join_workspace(
    sid: str,
    workspace_id: str,
    user_id: str,
    initial_status: PresenceStatus = "online",
) -> PresenceStatus:
    state = _sids.setdefault(sid, _SidState(user_id=user_id))
    state.user_id = user_id
    already_joined = workspace_id in state.workspaces
    state.workspaces.add(workspace_id)

    ws = _registry.setdefault(workspace_id, {})
    entry = ws.setdefault(user_id, _UserPresence())
    if not already_joined:
        entry.sid_count += 1
    if initial_status != "online":
        entry.manual_status = initial_status
    elif entry.manual_status == "offline":
        entry.manual_status = None

    return _effective_status(entry)


def set_presence(
    workspace_id: str, user_id: str, status: PresenceStatus
) -> PresenceStatus | None:
    ws = _registry.get(workspace_id)
    if not ws:
        return None
    entry = ws.get(user_id)
    if not entry or entry.sid_count <= 0:
        return None
    entry.manual_status = status if status != "online" else None
    return _effective_status(entry)


def set_presence_for_sid(
    sid: str,
    workspace_id: str,
    user_id: str,
    status: PresenceStatus,
) -> PresenceStatus | None:
    join_workspace(sid, workspace_id, user_id)
    return set_presence(workspace_id, user_id, status)


def leave_workspace(sid: str, workspace_id: str) -> tuple[str, str, PresenceStatus] | None:
    state = _sids.get(sid)
    if not state or workspace_id not in state.workspaces:
        return None
    state.workspaces.discard(workspace_id)
    user_id = state.user_id
    ws = _registry.get(workspace_id)
    if not ws:
        return user_id, workspace_id, "offline"
    entry = ws.get(user_id)
    if not entry:
        return user_id, workspace_id, "offline"
    entry.sid_count = max(0, entry.sid_count - 1)
    if entry.sid_count <= 0:
        entry.manual_status = None
    status = _effective_status(entry)
    if entry.sid_count <= 0:
        ws.pop(user_id, None)
        if not ws:
            _registry.pop(workspace_id, None)
    return user_id, workspace_id, status


def leave_all_for_sid(sid: str) -> list[tuple[str, str, PresenceStatus]]:
    state = _sids.pop(sid, None)
    if not state:
        return []
    updates: list[tuple[str, str, PresenceStatus]] = []
    user_id = state.user_id
    for workspace_id in state.workspaces:
        ws = _registry.get(workspace_id)
        if not ws:
            updates.append((user_id, workspace_id, "offline"))
            continue
        entry = ws.get(user_id)
        if not entry:
            updates.append((user_id, workspace_id, "offline"))
            continue
        entry.sid_count = max(0, entry.sid_count - 1)
        if entry.sid_count <= 0:
            entry.manual_status = None
        status = _effective_status(entry)
        if entry.sid_count <= 0:
            ws.pop(user_id, None)
            if not ws:
                _registry.pop(workspace_id, None)
        updates.append((user_id, workspace_id, status))
    return updates
