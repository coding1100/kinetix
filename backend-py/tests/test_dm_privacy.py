"""Direct message privacy — non-participants must not access DM data."""

from __future__ import annotations

import time

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

from app.main import app
from app.socket.rooms import conversation_room

PASSWORD = "password123"
OWNER_EMAIL = "owner@demo.com"
HUSNAIN_EMAIL = "htrajpoot3998@gmail.com"


def test_conversation_room_routes_dms_to_participant_room():
    assert conversation_room(
        workspace_id="ws-1", kind="dm", conversation_id="dm-1"
    ) == "dm:dm-1"
    assert conversation_room(
        workspace_id="ws-1", kind="channel", conversation_id="ch-1"
    ) == "ws:ws-1"


@pytest_asyncio.fixture(scope="module", loop_scope="module")
async def api_client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client


async def _login(client: AsyncClient, email: str) -> dict:
    res = await client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": PASSWORD},
    )
    assert res.status_code == 200, res.text
    token = res.json()["accessToken"]
    me = await client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert me.status_code == 200, me.text
    body = me.json()
    return {
        "token": token,
        "workspace_id": body["workspaces"][0]["id"],
        "user_id": body["id"],
        "headers": {"Authorization": f"Bearer {token}"},
    }


@pytest.mark.asyncio
async def test_dm_isolated_between_participants(api_client: AsyncClient):
    client = api_client
    owner = await _login(client, OWNER_EMAIL)
    husnain = await _login(client, HUSNAIN_EMAIL)

    create = await client.post(
        f"/api/v1/workspaces/{owner['workspace_id']}/chat/dms",
        headers=owner["headers"],
        json={"userIds": [husnain["user_id"]]},
    )
    assert create.status_code in (200, 201), create.text
    dm_id = create.json()["id"]

    secret = f"dm privacy ping {int(time.time())}"
    sent = await client.post(
        f"/api/v1/workspaces/{owner['workspace_id']}/chat/dms/{dm_id}/messages",
        headers=owner["headers"],
        json={"body": secret},
    )
    assert sent.status_code == 201, sent.text

    owner_dms = await client.get(
        f"/api/v1/workspaces/{owner['workspace_id']}/chat/dms",
        headers=owner["headers"],
    )
    assert owner_dms.status_code == 200, owner_dms.text
    assert any(d["id"] == dm_id for d in owner_dms.json()["data"])

    husnain_dms = await client.get(
        f"/api/v1/workspaces/{husnain['workspace_id']}/chat/dms",
        headers=husnain["headers"],
    )
    assert husnain_dms.status_code == 200, husnain_dms.text
    assert any(d["id"] == dm_id for d in husnain_dms.json()["data"])

    husnain_messages = await client.get(
        f"/api/v1/workspaces/{husnain['workspace_id']}/chat/dms/{dm_id}/messages",
        headers=husnain["headers"],
    )
    assert husnain_messages.status_code == 200, husnain_messages.text
    bodies = [m["body"] for m in husnain_messages.json()["data"]]
    assert secret in bodies

    members = await client.get(
        f"/api/v1/workspaces/{owner['workspace_id']}/members",
        headers=owner["headers"],
    )
    assert members.status_code == 200, members.text
    outsider = next(
        (
            m
            for m in members.json()["data"]
            if m["id"] not in {owner["user_id"], husnain["user_id"]}
        ),
        None,
    )
    if not outsider:
        pytest.skip("Need a third workspace member for outsider checks")

    outsider_login = await _login(client, outsider["email"])

    outsider_dms = await client.get(
        f"/api/v1/workspaces/{outsider_login['workspace_id']}/chat/dms",
        headers=outsider_login["headers"],
    )
    assert outsider_dms.status_code == 200, outsider_dms.text
    assert not any(d["id"] == dm_id for d in outsider_dms.json()["data"])

    outsider_messages = await client.get(
        f"/api/v1/workspaces/{outsider_login['workspace_id']}/chat/dms/{dm_id}/messages",
        headers=outsider_login["headers"],
    )
    assert outsider_messages.status_code == 404, outsider_messages.text

    outsider_dm = await client.get(
        f"/api/v1/workspaces/{outsider_login['workspace_id']}/chat/dms/{dm_id}",
        headers=outsider_login["headers"],
    )
    assert outsider_dm.status_code == 404, outsider_dm.text
