"""Test channel notification scoping: non-channel members do not receive socket events or notifications."""

from __future__ import annotations

import httpx
import pytest

from tests.conftest import API_BASE, require_py4_server

PASSWORD = "password123"
OWNER_EMAIL = "owner@demo.com"
HUSNAIN_EMAIL = "htrajpoot3998@gmail.com"


def _login(email: str) -> dict:
    res = httpx.post(
        f"{API_BASE}/api/v1/auth/login",
        json={"email": email, "password": PASSWORD},
        timeout=60,
    )
    if res.status_code != 200:
        pytest.skip(f"No seeded login for {email}")
    token = res.json()["accessToken"]
    headers = {"Authorization": f"Bearer {token}"}
    me = httpx.get(f"{API_BASE}/api/v1/auth/me", headers=headers, timeout=60)
    assert me.status_code == 200, me.text
    body = me.json()
    if not body["workspaces"]:
        pytest.skip(f"{email} has no workspace")
    return {
        "headers": headers,
        "workspace_id": body["workspaces"][0]["id"],
        "user_id": body["id"],
    }


def test_socket_room_targeting_isolation():
    from app.socket.emit import _emit_workspace_or_users

    emitted_rooms = []

    class MockSIO:
        async def emit(self, event, payload, room=None):
            emitted_rooms.append(room)

    import asyncio
    import app.socket.emit as emit_module

    original_get_sio = emit_module.get_sio
    emit_module.get_sio = lambda: MockSIO()

    try:
        asyncio.run(
            _emit_workspace_or_users(
                event="chat:message",
                payload={"test": "data"},
                workspace_id="ws_123",
                user_ids=["user_1", "user_2"],
            )
        )

        assert emitted_rooms == ["user:user_1", "user:user_2"]
        assert "ws:ws_123" not in emitted_rooms
    finally:
        emit_module.get_sio = original_get_sio
