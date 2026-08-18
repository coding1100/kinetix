import asyncio
import logging
from collections.abc import Coroutine
from typing import Any

from app.socket.server import get_sio

logger = logging.getLogger(__name__)

# asyncio only keeps weak references to running tasks, so a broadcast created
# with a bare asyncio.create_task() can be garbage collected before it is sent
# and the event is lost with no error anywhere. Holding a strong reference
# until the task finishes is what makes fire-and-forget delivery reliable.
_background_tasks: set[asyncio.Task] = set()


def _log_broadcast_failure(task: asyncio.Task) -> None:
    _background_tasks.discard(task)
    if task.cancelled():
        return
    error = task.exception()
    if error is not None:
        logger.warning("Realtime broadcast failed: %r", error)


def fire_and_forget(coro: Coroutine[Any, Any, Any]) -> None:
    """Send a realtime broadcast without blocking the request that caused it."""
    task = asyncio.create_task(coro)
    _background_tasks.add(task)
    task.add_done_callback(_log_broadcast_failure)


async def _emit_workspace_or_users(
    *,
    event: str,
    payload: dict,
    workspace_id: str,
    user_ids: list[str] | None = None,
) -> None:
    sio = get_sio()
    if user_ids:
        for user_id in sorted(set(user_ids)):
            await sio.emit(event, payload, room=f"user:{user_id}")
        return
    await sio.emit(event, payload, room=f"ws:{workspace_id}")


async def broadcast_chat_message(
    *,
    workspace_id: str,
    kind: str,
    conversation_id: str,
    message: dict,
    parent_id: str | None = None,
    user_ids: list[str] | None = None,
) -> None:
    await _emit_workspace_or_users(
        event="chat:message",
        payload={
            "workspaceId": workspace_id,
            "kind": kind,
            "conversationId": conversation_id,
            "message": message,
            "parentId": parent_id,
        },
        workspace_id=workspace_id,
        user_ids=user_ids,
    )


async def broadcast_chat_message_delete(
    *,
    workspace_id: str,
    kind: str,
    conversation_id: str,
    message_id: str,
    parent_id: str | None = None,
    user_ids: list[str] | None = None,
) -> None:
    await _emit_workspace_or_users(
        event="chat:message:delete",
        payload={
            "workspaceId": workspace_id,
            "kind": kind,
            "conversationId": conversation_id,
            "messageId": message_id,
            "parentId": parent_id,
        },
        workspace_id=workspace_id,
        user_ids=user_ids,
    )


async def broadcast_chat_message_edit(
    *,
    workspace_id: str,
    kind: str,
    conversation_id: str,
    message: dict,
    parent_id: str | None = None,
    user_ids: list[str] | None = None,
) -> None:
    await _emit_workspace_or_users(
        event="chat:message:edit",
        payload={
            "workspaceId": workspace_id,
            "kind": kind,
            "conversationId": conversation_id,
            "message": message,
            "parentId": parent_id,
        },
        workspace_id=workspace_id,
        user_ids=user_ids,
    )


async def broadcast_channel_joined(
    *,
    workspace_id: str,
    user_ids: list[str],
    channel: dict,
) -> None:
    sio = get_sio()
    for uid in sorted(set(user_ids)):
        await sio.emit(
            "chat:channel:joined",
            {
                "workspaceId": workspace_id,
                "userIds": user_ids,
                "channel": channel,
            },
            room=f"user:{uid}",
        )


async def broadcast_home_notification(
    *,
    workspace_id: str,
    user_ids: list[str],
    notification: dict,
) -> None:
    sio = get_sio()
    for uid in sorted(set(user_ids)):
        await sio.emit(
            "home:notification",
            {
                "workspaceId": workspace_id,
                "userIds": user_ids,
                "notification": notification,
            },
            room=f"user:{uid}",
        )


async def broadcast_channel_member_updated(
    *,
    workspace_id: str,
    channel_id: str,
    member: dict,
    removed: bool = False,
) -> None:
    sio = get_sio()
    await sio.emit(
        "chat:channel:member",
        {
            "workspaceId": workspace_id,
            "channelId": channel_id,
            "member": member,
            "removed": removed,
        },
        room=f"ws:{workspace_id}",
    )


async def broadcast_channel_removed(
    *,
    workspace_id: str,
    user_ids: list[str],
    channel_id: str,
) -> None:
    sio = get_sio()
    for uid in sorted(set(user_ids)):
        await sio.emit(
            "chat:channel:removed",
            {
                "workspaceId": workspace_id,
                "userIds": user_ids,
                "channelId": channel_id,
            },
            room=f"user:{uid}",
        )


async def broadcast_resource_access_granted(
    *,
    workspace_id: str,
    user_ids: list[str],
    resource_type: str,
    resource_id: str,
) -> None:
    """Mirrors broadcast_resource_access_removed - tells the newly-shared
    user's own sidebar (Shared with me) a Space/Folder/List just became
    visible to them, instead of only surfacing via the inbox notification
    until their next reload."""
    sio = get_sio()
    await sio.emit(
        "space:access:granted",
        {
            "workspaceId": workspace_id,
            "userIds": user_ids,
            "resourceType": resource_type,
            "resourceId": resource_id,
        },
        room=f"ws:{workspace_id}",
    )


async def broadcast_resource_access_removed(
    *,
    workspace_id: str,
    user_ids: list[str],
    resource_type: str,
    resource_id: str,
) -> None:
    """Tells the removed user's own sidebar (Shared with me) to drop this
    Space/Folder/List - explicit-share removal doesn't otherwise touch
    anything the removed user's client is subscribed to."""
    sio = get_sio()
    await sio.emit(
        "space:access:removed",
        {
            "workspaceId": workspace_id,
            "userIds": user_ids,
            "resourceType": resource_type,
            "resourceId": resource_id,
        },
        room=f"ws:{workspace_id}",
    )


async def broadcast_channel_privacy_changed(
    *,
    workspace_id: str,
    channel_id: str,
    is_private: bool,
) -> None:
    """Mirrors broadcast_channel_renamed - a List's own is_private flag
    drives its channel's displayed isPrivate (see _channel_payload,
    chat_service.py), but nothing else tells an existing member's already-
    cached sidebar entry that the flag flipped after the List was created
    (sync_list_channel_members_for_space only emits events for added/
    removed members, not for members who stay but whose channel's privacy
    display went stale)."""
    sio = get_sio()
    await sio.emit(
        "chat:channel:privacy",
        {
            "workspaceId": workspace_id,
            "channelId": channel_id,
            "isPrivate": is_private,
        },
        room=f"ws:{workspace_id}",
    )


async def broadcast_channel_renamed(
    *,
    workspace_id: str,
    channel_id: str,
    name: str,
) -> None:
    # Deliberately just {channelId, name} rather than a full channel payload -
    # reusing broadcast_channel_joined's shape would clobber each recipient's
    # own starred/isFollowing state (that payload uses a generic template
    # member). This propagates a List <-> Channel two-way name sync live.
    sio = get_sio()
    await sio.emit(
        "chat:channel:renamed",
        {
            "workspaceId": workspace_id,
            "channelId": channel_id,
            "name": name,
        },
        room=f"ws:{workspace_id}",
    )


async def broadcast_channel_canvas_updated(
    *,
    workspace_id: str,
    channel_id: str,
    canvas: dict,
) -> None:
    sio = get_sio()
    await sio.emit(
        "chat:channel:canvas",
        {
            "workspaceId": workspace_id,
            "channelId": channel_id,
            "canvas": canvas,
        },
        room=f"ws:{workspace_id}",
    )


async def broadcast_channel_huddle_updated(
    *,
    workspace_id: str,
    channel_id: str,
    huddle: dict,
) -> None:
    sio = get_sio()
    await sio.emit(
        "chat:channel:huddle",
        {
            "workspaceId": workspace_id,
            "channelId": channel_id,
            "huddle": huddle,
        },
        room=f"ws:{workspace_id}",
    )


async def broadcast_chat_typing(
    *,
    workspace_id: str,
    kind: str,
    conversation_id: str,
    user_id: str,
    typing: bool,
    audience_user_ids: list[str] | None = None,
) -> None:
    await _emit_workspace_or_users(
        event="chat:typing",
        payload={
            "workspaceId": workspace_id,
            "kind": kind,
            "conversationId": conversation_id,
            "userId": user_id,
            "typing": typing,
        },
        workspace_id=workspace_id,
        user_ids=audience_user_ids,
    )


async def broadcast_chat_read(
    *,
    workspace_id: str,
    kind: str,
    conversation_id: str,
    user_id: str,
    read_at: str,
    audience_user_ids: list[str] | None = None,
) -> None:
    await _emit_workspace_or_users(
        event="chat:read",
        payload={
            "workspaceId": workspace_id,
            "kind": kind,
            "conversationId": conversation_id,
            "userId": user_id,
            "readAt": read_at,
        },
        workspace_id=workspace_id,
        user_ids=audience_user_ids,
    )


async def broadcast_chat_reaction(
    *,
    workspace_id: str,
    kind: str,
    conversation_id: str,
    message_id: str,
    reactions: list[dict],
    user_ids: list[str] | None = None,
) -> None:
    await _emit_workspace_or_users(
        event="chat:reaction",
        payload={
            "workspaceId": workspace_id,
            "kind": kind,
            "conversationId": conversation_id,
            "messageId": message_id,
            "reactions": reactions,
        },
        workspace_id=workspace_id,
        user_ids=user_ids,
    )


async def broadcast_workspace_member_role_updated(
    *,
    workspace_id: str,
    user_id: str,
    role: str,
) -> None:
    sio = get_sio()
    await sio.emit(
        "workspace:member:role",
        {
            "workspaceId": workspace_id,
            "userId": user_id,
            "role": role,
        },
        room=f"ws:{workspace_id}",
    )


async def broadcast_account_disabled(*, user_id: str) -> None:
    sio = get_sio()
    await sio.emit("account:disabled", {"userId": user_id}, room=f"user:{user_id}")
    # Force-disconnect any live sockets rather than waiting for the client
    # to voluntarily close after handling the event above - this is also
    # what flips their presence to offline for everyone else immediately,
    # instead of leaving them looking "online" until ping-timeout.
    room = f"user:{user_id}"
    sids = [sid for sid, _ in sio.manager.get_participants("/", room)]
    for sid in sids:
        await sio.disconnect(sid, namespace="/")


async def broadcast_workspace_suspended(*, workspace_id: str) -> None:
    sio = get_sio()
    await sio.emit(
        "workspace:suspended", {"workspaceId": workspace_id}, room=f"ws:{workspace_id}"
    )


async def broadcast_workspace_member_suspended(*, workspace_id: str, user_id: str) -> None:
    # Targets only this one member's sockets (user:{id} room), not the whole
    # ws:{workspace_id} room - a per-membership suspend shouldn't kick anyone
    # else out of the workspace.
    sio = get_sio()
    await sio.emit(
        "workspace:member:suspended",
        {"workspaceId": workspace_id, "userId": user_id},
        room=f"user:{user_id}",
    )


async def broadcast_workspace_member_reactivated(
    *, workspace_id: str, user_id: str
) -> None:
    # Mirrors broadcast_workspace_member_suspended - targets only this one
    # member's sockets so their workspace switcher can flip the workspace
    # back to enabled in realtime instead of waiting for a reload.
    sio = get_sio()
    await sio.emit(
        "workspace:member:reactivated",
        {"workspaceId": workspace_id, "userId": user_id},
        room=f"user:{user_id}",
    )


async def broadcast_workspace_reactivated(*, workspace_id: str) -> None:
    sio = get_sio()
    await sio.emit(
        "workspace:reactivated", {"workspaceId": workspace_id}, room=f"ws:{workspace_id}"
    )


async def broadcast_workspace_deleted(*, workspace_id: str) -> None:
    sio = get_sio()
    await sio.emit(
        "workspace:deleted", {"workspaceId": workspace_id}, room=f"ws:{workspace_id}"
    )


async def broadcast_task_event(
    *,
    workspace_id: str,
    action: str,
    task_id: str,
    list_id: str | None = None,
    task: dict | None = None,
) -> None:
    sio = get_sio()
    await sio.emit(
        "task:event",
        {
            "workspaceId": workspace_id,
            "action": action,
            "taskId": task_id,
            "listId": list_id,
            "task": task,
        },
        room=f"ws:{workspace_id}",
    )
