import socketio
from fastapi import FastAPI
from jwt import PyJWTError
from sqlalchemy import select

from app.config import get_settings
from app.core.security import verify_access_token
from app.db.models.enums import MemberStatus
from app.db.models.workspace import WorkspaceMember
from app.db.session import get_session_factory
from app.socket import presence

_sio: socketio.AsyncServer | None = None


def get_sio() -> socketio.AsyncServer:
    global _sio
    if _sio is None:
        settings = get_settings()
        base = settings.frontend_url.rstrip("/")
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
        updates = presence.leave_all_for_sid(sid)
        for user_id, workspace_id, status in updates:
            await sio.emit(
                "presence:update",
                {
                    "workspaceId": workspace_id,
                    "userId": user_id,
                    "status": status,
                },
                room=f"ws:{workspace_id}",
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
        await sio.enter_room(sid, f"ws:{workspace_id}")

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
            room=f"ws:{workspace_id}",
        )

        return {"ok": True, "workspaceId": workspace_id}

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
            room=f"ws:{workspace_id}",
        )
        return {"ok": True, "status": effective}


def create_asgi_app(fastapi_app: FastAPI):
    return socketio.ASGIApp(get_sio(), other_asgi_app=fastapi_app)
