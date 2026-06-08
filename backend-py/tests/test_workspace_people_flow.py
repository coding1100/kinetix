"""In-process workspace invite → member flow (no live server required)."""

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app

TEST_EMAIL = "flow-test@example.com"


@pytest.mark.asyncio
async def test_workspace_invite_accept_and_member_list():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        login = await client.post(
            "/api/v1/auth/login",
            json={"email": "owner@demo.com", "password": "password123"},
        )
        if login.status_code != 200:
            pytest.skip(f"Demo owner not in DB: {login.text}")

        token = login.json()["accessToken"]
        headers = {"Authorization": f"Bearer {token}"}

        me = await client.get("/api/v1/auth/me", headers=headers)
        assert me.status_code == 200
        workspace_id = me.json()["workspaces"][0]["id"]

        members = await client.get(
            f"/api/v1/workspaces/{workspace_id}/members",
            headers=headers,
        )
        assert members.status_code == 200
        existing = [
            m
            for m in members.json()["data"]
            if m["email"].lower() == TEST_EMAIL.lower()
        ]
        if existing:
            pytest.skip("Flow test user already in workspace")

        invite = await client.post(
            f"/api/v1/workspaces/{workspace_id}/invites",
            headers=headers,
            json={"email": TEST_EMAIL, "role": "MEMBER"},
        )
        assert invite.status_code == 201, invite.text
        invite_token = invite.json()["token"]

        accept = await client.post(
            f"/api/v1/invites/{invite_token}/accept-signup",
            json={"fullName": "Flow Test", "password": "password123"},
        )
        assert accept.status_code in (200, 201), accept.text
        assert accept.json()["flow"] == "invitee"

        members_after = await client.get(
            f"/api/v1/workspaces/{workspace_id}/members",
            headers=headers,
        )
        assert members_after.status_code == 200
        emails = [m["email"].lower() for m in members_after.json()["data"]]
        assert TEST_EMAIL.lower() in emails

        member_login = await client.post(
            "/api/v1/auth/login",
            json={"email": TEST_EMAIL, "password": "password123"},
        )
        assert member_login.status_code == 200

        member_headers = {
            "Authorization": f"Bearer {member_login.json()['accessToken']}"
        }
        channels = await client.get(
            f"/api/v1/workspaces/{workspace_id}/chat/channels",
            headers=member_headers,
        )
        assert channels.status_code == 200
