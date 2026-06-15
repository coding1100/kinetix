from app.socket.rooms import conversation_room, workspace_room
from app.socket.server import get_sio


async def broadcast_chat_message(
    *,
    workspace_id: str,
    kind: str,
    conversation_id: str,
    message: dict,
    parent_id: str | None = None,
) -> None:
    sio = get_sio()
    await sio.emit(
        "chat:message",
        {
            "workspaceId": workspace_id,
            "kind": kind,
            "conversationId": conversation_id,
            "message": message,
            "parentId": parent_id,
        },
        room=conversation_room(
            workspace_id=workspace_id,
            kind=kind,
            conversation_id=conversation_id,
        ),
    )


async def broadcast_chat_message_delete(
    *,
    workspace_id: str,
    kind: str,
    conversation_id: str,
    message_id: str,
    parent_id: str | None = None,
) -> None:
    sio = get_sio()
    await sio.emit(
        "chat:message:delete",
        {
            "workspaceId": workspace_id,
            "kind": kind,
            "conversationId": conversation_id,
            "messageId": message_id,
            "parentId": parent_id,
        },
        room=conversation_room(
            workspace_id=workspace_id,
            kind=kind,
            conversation_id=conversation_id,
        ),
    )


async def broadcast_chat_message_edit(
    *,
    workspace_id: str,
    kind: str,
    conversation_id: str,
    message: dict,
    parent_id: str | None = None,
) -> None:
    sio = get_sio()
    await sio.emit(
        "chat:message:edit",
        {
            "workspaceId": workspace_id,
            "kind": kind,
            "conversationId": conversation_id,
            "message": message,
            "parentId": parent_id,
        },
        room=conversation_room(
            workspace_id=workspace_id,
            kind=kind,
            conversation_id=conversation_id,
        ),
    )


async def broadcast_channel_joined(
    *,
    workspace_id: str,
    user_ids: list[str],
    channel: dict,
) -> None:
    sio = get_sio()
    await sio.emit(
        "chat:channel:joined",
        {
            "workspaceId": workspace_id,
            "userIds": user_ids,
            "channel": channel,
        },
        room=workspace_room(workspace_id),
    )


async def broadcast_dm_joined(
    *,
    workspace_id: str,
    user_ids: list[str],
    conversation_id: str,
) -> None:
    sio = get_sio()
    await sio.emit(
        "chat:dm:joined",
        {
            "workspaceId": workspace_id,
            "userIds": user_ids,
            "conversationId": conversation_id,
        },
        room=workspace_room(workspace_id),
    )


async def broadcast_workspace_member_joined(
    *,
    workspace_id: str,
    member: dict,
    invite_email: str,
) -> None:
    sio = get_sio()
    await sio.emit(
        "workspace:member:joined",
        {
            "workspaceId": workspace_id,
            "member": member,
            "inviteEmail": invite_email,
        },
        room=workspace_room(workspace_id),
    )


async def broadcast_home_notification(
    *,
    workspace_id: str,
    user_ids: list[str],
    notification: dict,
) -> None:
    sio = get_sio()
    await sio.emit(
        "home:notification",
        {
            "workspaceId": workspace_id,
            "userIds": user_ids,
            "notification": notification,
        },
        room=workspace_room(workspace_id),
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
        room=workspace_room(workspace_id),
    )


async def broadcast_channel_removed(
    *,
    workspace_id: str,
    user_ids: list[str],
    channel_id: str,
) -> None:
    sio = get_sio()
    await sio.emit(
        "chat:channel:removed",
        {
            "workspaceId": workspace_id,
            "userIds": user_ids,
            "channelId": channel_id,
        },
        room=workspace_room(workspace_id),
    )


async def broadcast_chat_typing(
    *,
    workspace_id: str,
    kind: str,
    conversation_id: str,
    user_id: str,
    typing: bool,
) -> None:
    sio = get_sio()
    await sio.emit(
        "chat:typing",
        {
            "workspaceId": workspace_id,
            "kind": kind,
            "conversationId": conversation_id,
            "userId": user_id,
            "typing": typing,
        },
        room=conversation_room(
            workspace_id=workspace_id,
            kind=kind,
            conversation_id=conversation_id,
        ),
    )


async def broadcast_chat_read(
    *,
    workspace_id: str,
    kind: str,
    conversation_id: str,
    user_id: str,
    read_at: str,
) -> None:
    sio = get_sio()
    await sio.emit(
        "chat:read",
        {
            "workspaceId": workspace_id,
            "kind": kind,
            "conversationId": conversation_id,
            "userId": user_id,
            "readAt": read_at,
        },
        room=conversation_room(
            workspace_id=workspace_id,
            kind=kind,
            conversation_id=conversation_id,
        ),
    )


async def broadcast_chat_reaction(
    *,
    workspace_id: str,
    message_id: str,
    reactions: list[dict],
    kind: str | None = None,
    conversation_id: str | None = None,
) -> None:
    sio = get_sio()
    room = (
        conversation_room(
            workspace_id=workspace_id,
            kind=kind,
            conversation_id=conversation_id,
        )
        if kind and conversation_id
        else workspace_room(workspace_id)
    )
    await sio.emit(
        "chat:reaction",
        {
            "workspaceId": workspace_id,
            "messageId": message_id,
            "reactions": reactions,
        },
        room=room,
    )
