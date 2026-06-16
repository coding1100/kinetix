import socketio
from fastapi import FastAPI
from jwt import PyJWTError
from sqlalchemy import select
from urllib.parse import urlparse

from app.config import get_settings
from app.core.security import verify_access_token
from app.db.models.chat import DirectConversation, DirectParticipant
from app.db.models.enums import MemberStatus
from app.db.models.workspace import WorkspaceMember
from app.db.session import get_session_factory
from app.socket import presence, typing as typing_registry
from app.socket.rooms import dm_room, workspace_room

_sio: socketio.AsyncServer | None = None


def _frontend_origin(value: str) -> str:
    parsed = urlparse(value.strip())
    if parsed.scheme and parsed.netloc:
        return f"{parsed.scheme}://{parsed.netloc}"
    return value.rstrip("/")


def get_sio() -> socketio.AsyncServer:
    global _sio
    if _sio is None:
        settings = get_settings()
        base = _frontend_origin(settings.frontend_url)
        origins = {base}
        if "localhost" in base:
            origins.add(base.replace("localhost", "127.0.0.1"))
        if "127.0.0.1" in base:
            origins.add(base.replace("127.0.0.1", "localhost"))
        _sio = socketio.AsyncServer(
            async_mode="asgi",
            cors_allowed_origins=sorted(origins),
        )
        _register_events(_sio)
    return _sio


async def _is_workspace_member(workspace_id: str, user_id: str) -> bool:
    factory = get_session_factory()
    async with factory() as session:
        membership = await session.scalar(
            select(WorkspaceMember).where(
                WorkspaceMember.workspace_id == workspace_id,
                WorkspaceMember.user_id == user_id,
            )
        )
        return bool(membership and membership.status == MemberStatus.ACTIVE)


async def _is_dm_participant(
    workspace_id: str, conversation_id: str, user_id: str
) -> bool:
    factory = get_session_factory()
    async with factory() as session:
        participant = await session.scalar(
            select(DirectParticipant)
            .join(DirectConversation)
            .where(
                DirectParticipant.conversation_id == conversation_id,
                DirectParticipant.user_id == user_id,
                DirectConversation.workspace_id == workspace_id,
            )
        )
        return participant is not None


async def _join_user_dm_rooms(
    sio: socketio.AsyncServer, sid: str, workspace_id: str, user_id: str
) -> None:
    factory = get_session_factory()
    async with factory() as session:
        conversation_ids = (
            await session.scalars(
                select(DirectParticipant.conversation_id)
                .join(DirectConversation)
                .where(
                    DirectParticipant.user_id == user_id,
                    DirectConversation.workspace_id == workspace_id,
                )
            )
        ).all()
    for conversation_id in conversation_ids:
        await sio.enter_room(sid, dm_room(conversation_id))


def _register_events(sio: socketio.AsyncServer) -> None:
    @sio.event
    async def connect(sid, environ, auth):
        token = (auth or {}).get("token") if isinstance(auth, dict) else None
        if not token:
            return False
        try:
            payload = verify_access_token(token)
        except PyJWTError:
            return False
        await sio.save_session(sid, {"user_id": payload["sub"]})
        return True

    @sio.event
    async def disconnect(sid):
        session = await sio.get_session(sid)
        user_id = session.get("user_id")
        updates = presence.leave_all_for_sid(sid)
        for uid, workspace_id, status in updates:
            await sio.emit(
                "presence:update",
                {
                    "workspaceId": workspace_id,
                    "userId": uid,
                    "status": status,
                },
                room=workspace_room(workspace_id),
            )
        if user_id:
            from app.socket.emit import broadcast_chat_typing

            for workspace_id, kind, conv_id, _remaining in typing_registry.clear_user(
                user_id
            ):
                await broadcast_chat_typing(
                    workspace_id=workspace_id,
                    kind=kind,
                    conversation_id=conv_id,
                    user_id=user_id,
                    typing=False,
                )

    @sio.on("workspace:join")
    async def workspace_join(sid, data):
        session = await sio.get_session(sid)
        user_id = session.get("user_id")
        workspace_id = (data or {}).get("workspaceId")
        if not user_id or not workspace_id:
            return {"ok": False}
        if not await _is_workspace_member(workspace_id, user_id):
            return {"ok": False}
        await sio.enter_room(sid, workspace_room(workspace_id))
        await _join_user_dm_rooms(sio, sid, workspace_id, user_id)

        initial_status = (data or {}).get("status", "online")
        if initial_status not in ("online", "away", "busy", "offline"):
            initial_status = "online"

        status = presence.join_workspace(
            sid, workspace_id, user_id, initial_status=initial_status
        )

        users = presence.get_workspace_presence(workspace_id)
        if status != "offline" and not any(u["userId"] == user_id for u in users):
            users.append({"userId": user_id, "status": status})

        await sio.emit(
            "presence:sync",
            {
                "workspaceId": workspace_id,
                "users": users,
            },
            to=sid,
        )

        await sio.emit(
            "presence:update",
            {
                "workspaceId": workspace_id,
                "userId": user_id,
                "status": status,
            },
            room=workspace_room(workspace_id),
        )

        return {"ok": True, "workspaceId": workspace_id}

    @sio.on("dm:join")
    async def dm_join(sid, data):
        session = await sio.get_session(sid)
        user_id = session.get("user_id")
        workspace_id = (data or {}).get("workspaceId")
        conversation_id = (data or {}).get("conversationId")
        if not user_id or not workspace_id or not conversation_id:
            return {"ok": False}
        if not await _is_workspace_member(workspace_id, user_id):
            return {"ok": False}
        if not await _is_dm_participant(workspace_id, conversation_id, user_id):
            return {"ok": False}
        await sio.enter_room(sid, dm_room(conversation_id))
        return {"ok": True, "conversationId": conversation_id}

    @sio.on("presence:set")
    async def presence_set(sid, data):
        session = await sio.get_session(sid)
        user_id = session.get("user_id")
        workspace_id = (data or {}).get("workspaceId")
        status = (data or {}).get("status")
        if not user_id or not workspace_id or not status:
            return {"ok": False}
        if status not in ("online", "away", "busy", "offline"):
            return {"ok": False}
        if not await _is_workspace_member(workspace_id, user_id):
            return {"ok": False}

        effective = presence.set_presence_for_sid(
            sid, workspace_id, user_id, status
        )
        if effective is None:
            return {"ok": False}

        await sio.emit(
            "presence:update",
            {
                "workspaceId": workspace_id,
                "userId": user_id,
                "status": effective,
            },
            room=workspace_room(workspace_id),
        )
        return {"ok": True, "status": effective}

    @sio.on("chat:typing:start")
    async def chat_typing_start(sid, data):
        from app.socket.emit import broadcast_chat_typing

        session = await sio.get_session(sid)
        user_id = session.get("user_id")
        workspace_id = (data or {}).get("workspaceId")
        kind = (data or {}).get("kind")
        conversation_id = (data or {}).get("conversationId")
        if (
            not user_id
            or not workspace_id
            or kind not in ("channel", "dm")
            or not conversation_id
        ):
            return {"ok": False}
        if not await _is_workspace_member(workspace_id, user_id):
            return {"ok": False}
        if kind == "dm" and not await _is_dm_participant(
            workspace_id, conversation_id, user_id
        ):
            return {"ok": False}
        typing_registry.start_typing(
            workspace_id, kind, conversation_id, user_id
        )
        await broadcast_chat_typing(
            workspace_id=workspace_id,
            kind=kind,
            conversation_id=conversation_id,
            user_id=user_id,
            typing=True,
        )
        return {"ok": True}

    @sio.on("chat:typing:stop")
    async def chat_typing_stop(sid, data):
        from app.socket.emit import broadcast_chat_typing

        session = await sio.get_session(sid)
        user_id = session.get("user_id")
        workspace_id = (data or {}).get("workspaceId")
        kind = (data or {}).get("kind")
        conversation_id = (data or {}).get("conversationId")
        if (
            not user_id
            or not workspace_id
            or kind not in ("channel", "dm")
            or not conversation_id
        ):
            return {"ok": False}
        if not await _is_workspace_member(workspace_id, user_id):
            return {"ok": False}
        if kind == "dm" and not await _is_dm_participant(
            workspace_id, conversation_id, user_id
        ):
            return {"ok": False}
        typing_registry.stop_typing(
            workspace_id, kind, conversation_id, user_id
        )
        await broadcast_chat_typing(
            workspace_id=workspace_id,
            kind=kind,
            conversation_id=conversation_id,
            user_id=user_id,
            typing=False,
        )
        return {"ok": True}


def create_asgi_app(fastapi_app: FastAPI):
    return socketio.ASGIApp(get_sio(), other_asgi_app=fastapi_app)
