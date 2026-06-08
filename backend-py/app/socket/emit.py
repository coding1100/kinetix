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
