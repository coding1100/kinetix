"""Workspace member list updates when invites are accepted."""

from __future__ import annotations

import time

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

from app.main import app

PASSWORD = "password123"
OWNER_EMAIL = "owner@demo.com"


@pytest_asyncio.fixture(scope="module", loop_scope="module")
async def api_client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client


async def _login(client: AsyncClient, email: str, password: str = PASSWORD) -> dict:
    res = await client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": password},
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
async def test_accept_invite_adds_member_to_workspace_list(api_client: AsyncClient):
    client = api_client
    owner = await _login(client, OWNER_EMAIL)
    invite_email = f"member-{int(time.time())}@example.com"

    invite = await client.post(
        f"/api/v1/workspaces/{owner['workspace_id']}/invites",
        headers=owner["headers"],
        json={"email": invite_email, "role": "MEMBER"},
    )
    assert invite.status_code == 201, invite.text
    invite_token = invite.json()["token"]

    before = await client.get(
        f"/api/v1/workspaces/{owner['workspace_id']}/members",
        headers=owner["headers"],
    )
    assert before.status_code == 200, before.text
    before_emails = {m["email"].lower() for m in before.json()["data"]}
    assert invite_email.lower() not in before_emails

    accept = await client.post(
        f"/api/v1/invites/{invite_token}/accept-signup",
        json={
            "fullName": "Realtime Member",
            "password": PASSWORD,
        },
    )
    assert accept.status_code == 201, accept.text
    new_user_id = accept.json()["user"]["id"]

    after = await client.get(
        f"/api/v1/workspaces/{owner['workspace_id']}/members",
        headers=owner["headers"],
    )
    assert after.status_code == 200, after.text
    members = after.json()["data"]
    assert any(m["id"] == new_user_id for m in members)
    assert any(m["email"].lower() == invite_email.lower() for m in members)

    pending = await client.get(
        f"/api/v1/workspaces/{owner['workspace_id']}/invites",
        headers=owner["headers"],
    )
    assert pending.status_code == 200, pending.text
    assert not any(
        i["email"].lower() == invite_email.lower() for i in pending.json()["data"]
    )
