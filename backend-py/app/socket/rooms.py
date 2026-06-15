def workspace_room(workspace_id: str) -> str:
    return f"ws:{workspace_id}"


def dm_room(conversation_id: str) -> str:
    return f"dm:{conversation_id}"


def conversation_room(*, workspace_id: str, kind: str, conversation_id: str) -> str:
    if kind == "dm":
        return dm_room(conversation_id)
    return workspace_room(workspace_id)
