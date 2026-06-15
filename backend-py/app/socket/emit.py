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
        room=f"ws:{workspace_id}",
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
        room=f"ws:{workspace_id}",
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
        room=f"ws:{workspace_id}",
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
        room=f"ws:{workspace_id}",
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
        room=f"ws:{workspace_id}",
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
    await sio.emit(
        "chat:channel:removed",
        {
            "workspaceId": workspace_id,
            "userIds": user_ids,
            "channelId": channel_id,
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
        room=f"ws:{workspace_id}",
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
        room=f"ws:{workspace_id}",
    )


async def broadcast_chat_reaction(
    *,
    workspace_id: str,
    message_id: str,
    reactions: list[dict],
) -> None:
    sio = get_sio()
    await sio.emit(
        "chat:reaction",
        {
            "workspaceId": workspace_id,
            "messageId": message_id,
            "reactions": reactions,
        },
        room=f"ws:{workspace_id}",
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
