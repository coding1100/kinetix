"""In-process workspace CRUD, invites, and membership tests."""

from __future__ import annotations

import time

import pytest
from httpx import AsyncClient

OWNER = ("owner@demo.com", "password123")
MEMBER = ("alex@demo.com", "password123")


async def _login(client: AsyncClient, email: str, password: str) -> str:
    res = await client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": password},
    )
    assert res.status_code == 200, res.text
    return res.json()["accessToken"]


def _auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


@pytest.mark.asyncio(loop_scope="session")
async def test_workspace_create_list_get_update(api_client: AsyncClient):
    token = await _login(api_client, *OWNER)
    headers = _auth(token)

    before = await api_client.get("/api/v1/workspaces", headers=headers)
    assert before.status_code == 200
    count_before = len(before.json()["data"])

    name = f"Test WS {int(time.time())}"
    created = await api_client.post(
        "/api/v1/workspaces",
        headers=headers,
        json={"name": name},
    )
    assert created.status_code == 201, created.text
    body = created.json()
    assert body["name"] == name
    assert body["slug"]
    workspace_id = body["id"]

    listed = await api_client.get("/api/v1/workspaces", headers=headers)
    assert listed.status_code == 200
    rows = listed.json()["data"]
    assert len(rows) == count_before + 1
    match = next((w for w in rows if w["id"] == workspace_id), None)
    assert match is not None
    assert match["role"] == "OWNER"

    me = await api_client.get("/api/v1/auth/me", headers=headers)
    assert me.status_code == 200
    me_ids = {w["id"] for w in me.json()["workspaces"]}
    assert workspace_id in me_ids

    detail = await api_client.get(
        f"/api/v1/workspaces/{workspace_id}",
        headers=headers,
    )
    assert detail.status_code == 200
    assert detail.json()["role"] == "OWNER"
    assert detail.json()["memberCount"] >= 1

    renamed = f"{name} Renamed"
    patched = await api_client.patch(
        f"/api/v1/workspaces/{workspace_id}",
        headers=headers,
        json={"name": renamed},
    )
    assert patched.status_code == 200, patched.text
    assert patched.json()["name"] == renamed


@pytest.mark.asyncio(loop_scope="session")
async def test_workspace_non_member_forbidden(api_client: AsyncClient):
    owner_token = await _login(api_client, *OWNER)
    member_token = await _login(api_client, *MEMBER)
    owner_headers = _auth(owner_token)

    created = await api_client.post(
        "/api/v1/workspaces",
        headers=owner_headers,
        json={"name": f"Private WS {int(time.time())}"},
    )
    assert created.status_code == 201
    workspace_id = created.json()["id"]

    denied = await api_client.get(
        f"/api/v1/workspaces/{workspace_id}",
        headers=_auth(member_token),
    )
    assert denied.status_code == 403


@pytest.mark.asyncio(loop_scope="session")
async def test_workspace_invite_list_cancel_and_accept_signup(api_client: AsyncClient):
    test_email = f"ws-flow-{int(time.time())}@example.com"
    token = await _login(api_client, *OWNER)
    headers = _auth(token)

    created = await api_client.post(
        "/api/v1/workspaces",
        headers=headers,
        json={"name": f"Invite WS {int(time.time())}"},
    )
    assert created.status_code == 201
    workspace_id = created.json()["id"]

    invite = await api_client.post(
        f"/api/v1/workspaces/{workspace_id}/invites",
        headers=headers,
        json={"email": test_email, "role": "MEMBER"},
    )
    assert invite.status_code == 201, invite.text
    invite_id = invite.json()["id"]
    invite_token = invite.json()["token"]

    invites = await api_client.get(
        f"/api/v1/workspaces/{workspace_id}/invites",
        headers=headers,
    )
    assert invites.status_code == 200
    emails = [i["email"].lower() for i in invites.json()["data"]]
    assert test_email.lower() in emails

    accept = await api_client.post(
        f"/api/v1/invites/{invite_token}/accept-signup",
        json={"fullName": "WS Flow User", "password": "password123"},
    )
    assert accept.status_code in (200, 201), accept.text
    assert accept.json()["flow"] == "invitee"

    member_login = await api_client.post(
        "/api/v1/auth/login",
        json={"email": test_email, "password": "password123"},
    )
    assert member_login.status_code == 200
    member_headers = _auth(member_login.json()["accessToken"])
    channels = await api_client.get(
        f"/api/v1/workspaces/{workspace_id}/chat/channels",
        headers=member_headers,
    )
    assert channels.status_code == 200

    members = await api_client.get(
        f"/api/v1/workspaces/{workspace_id}/members",
        headers=headers,
    )
    assert members.status_code == 200
    member_emails = [m["email"].lower() for m in members.json()["data"]]
    assert test_email.lower() in member_emails

    cancel_email = f"cancel-{int(time.time())}@example.com"
    pending = await api_client.post(
        f"/api/v1/workspaces/{workspace_id}/invites",
        headers=headers,
        json={"email": cancel_email, "role": "MEMBER"},
    )
    assert pending.status_code == 201
    pending_id = pending.json()["id"]

    deleted = await api_client.delete(
        f"/api/v1/workspaces/{workspace_id}/invites/{pending_id}",
        headers=headers,
    )
    assert deleted.status_code == 200

    invites_after = await api_client.get(
        f"/api/v1/workspaces/{workspace_id}/invites",
        headers=headers,
    )
    assert invites_after.status_code == 200
    pending_ids = [i["id"] for i in invites_after.json()["data"]]
    assert pending_id not in pending_ids
    assert invite_id not in pending_ids


@pytest.mark.asyncio(loop_scope="session")
async def test_workspace_member_role_and_remove(api_client: AsyncClient):
    test_email = f"ws-role-{int(time.time())}@example.com"
    owner_token = await _login(api_client, *OWNER)
    owner_headers = _auth(owner_token)

    created = await api_client.post(
        "/api/v1/workspaces",
        headers=owner_headers,
        json={"name": f"Role WS {int(time.time())}"},
    )
    assert created.status_code == 201
    workspace_id = created.json()["id"]

    invite = await api_client.post(
        f"/api/v1/workspaces/{workspace_id}/invites",
        headers=owner_headers,
        json={"email": test_email, "role": "MEMBER"},
    )
    assert invite.status_code == 201
    invite_token = invite.json()["token"]

    accept = await api_client.post(
        f"/api/v1/invites/{invite_token}/accept-signup",
        json={"fullName": "Role Test", "password": "password123"},
    )
    assert accept.status_code in (200, 201)
    member_user_id = accept.json()["user"]["id"]

    role_patch = await api_client.patch(
        f"/api/v1/workspaces/{workspace_id}/members/{member_user_id}",
        headers=owner_headers,
        json={"role": "GUEST"},
    )
    assert role_patch.status_code == 200, role_patch.text

    removed = await api_client.delete(
        f"/api/v1/workspaces/{workspace_id}/members/{member_user_id}",
        headers=owner_headers,
    )
    assert removed.status_code == 200

    members = await api_client.get(
        f"/api/v1/workspaces/{workspace_id}/members",
        headers=owner_headers,
    )
    assert members.status_code == 200
    ids = [m["id"] for m in members.json()["data"]]
    assert member_user_id not in ids


@pytest.mark.asyncio(loop_scope="session")
async def test_workspace_delete_and_transfer_ownership(api_client: AsyncClient):
    owner_token = await _login(api_client, *OWNER)
    owner_headers = _auth(owner_token)

    transfer_ws_name = f"Transfer WS {int(time.time())}"
    transfer_ws = await api_client.post(
        "/api/v1/workspaces",
        headers=owner_headers,
        json={"name": transfer_ws_name},
    )
    assert transfer_ws.status_code == 201
    transfer_ws_id = transfer_ws.json()["id"]

    member_email = f"transfer-{int(time.time())}@example.com"
    invite = await api_client.post(
        f"/api/v1/workspaces/{transfer_ws_id}/invites",
        headers=owner_headers,
        json={"email": member_email, "role": "MEMBER"},
    )
    assert invite.status_code == 201
    accept = await api_client.post(
        f"/api/v1/invites/{invite.json()['token']}/accept-signup",
        json={"fullName": "Transfer Target", "password": "password123"},
    )
    assert accept.status_code in (200, 201)
    new_owner_id = accept.json()["user"]["id"]

    transferred = await api_client.post(
        f"/api/v1/workspaces/{transfer_ws_id}/transfer-ownership",
        headers=owner_headers,
        json={"newOwnerUserId": new_owner_id},
    )
    assert transferred.status_code == 200, transferred.text

    detail = await api_client.get(
        f"/api/v1/workspaces/{transfer_ws_id}",
        headers=_auth(accept.json()["accessToken"]),
    )
    assert detail.status_code == 200
    assert detail.json()["role"] == "OWNER"

    member_login = await api_client.post(
        "/api/v1/auth/login",
        json={"email": OWNER[0], "password": OWNER[1]},
    )
    me_after = await api_client.get(
        "/api/v1/auth/me",
        headers=_auth(member_login.json()["accessToken"]),
    )
    owner_row = next(
        w for w in me_after.json()["workspaces"] if w["id"] == transfer_ws_id
    )
    assert owner_row["role"] == "ADMIN"

    delete_name = f"Delete WS {int(time.time())}"
    delete_ws = await api_client.post(
        "/api/v1/workspaces",
        headers=owner_headers,
        json={"name": delete_name},
    )
    assert delete_ws.status_code == 201
    delete_ws_id = delete_ws.json()["id"]

    wrong_name = await api_client.request(
        "DELETE",
        f"/api/v1/workspaces/{delete_ws_id}",
        headers=owner_headers,
        json={"confirmName": "wrong name"},
    )
    assert wrong_name.status_code == 400

    member_token = await _login(api_client, *MEMBER)
    denied = await api_client.request(
        "DELETE",
        f"/api/v1/workspaces/{delete_ws_id}",
        headers=_auth(member_token),
        json={"confirmName": delete_name},
    )
    assert denied.status_code == 403

    deleted = await api_client.request(
        "DELETE",
        f"/api/v1/workspaces/{delete_ws_id}",
        headers=owner_headers,
        json={"confirmName": delete_name},
    )
    assert deleted.status_code == 200, deleted.text

    gone = await api_client.get(
        f"/api/v1/workspaces/{delete_ws_id}",
        headers=owner_headers,
    )
    assert gone.status_code == 403

    listed = await api_client.get("/api/v1/workspaces", headers=owner_headers)
    ids = [w["id"] for w in listed.json()["data"]]
    assert delete_ws_id not in ids


@pytest.mark.asyncio(loop_scope="session")
async def test_workspace_create_validation(api_client: AsyncClient):
    token = await _login(api_client, *OWNER)
    headers = _auth(token)

    empty = await api_client.post(
        "/api/v1/workspaces",
        headers=headers,
        json={"name": ""},
    )
    assert empty.status_code in (400, 422)

    short = await api_client.post(
        "/api/v1/workspaces",
        headers=headers,
        json={"name": "A"},
    )
    assert short.status_code == 201
