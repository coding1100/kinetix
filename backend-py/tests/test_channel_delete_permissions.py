"""Channel delete: workspace admins and channel creators."""

import time

import httpx
import pytest

from tests.conftest import API_BASE, require_py4_server


def _login(email: str, password: str = "password123") -> dict:
    login = httpx.post(
        f"{API_BASE}/api/v1/auth/login",
        json={"email": email, "password": password},
        timeout=60,
    )
    assert login.status_code == 200, login.text
    token = login.json()["accessToken"]
    me = httpx.get(
        f"{API_BASE}/api/v1/auth/me",
        headers={"Authorization": f"Bearer {token}"},
        timeout=60,
    )
    assert me.status_code == 200, me.text
    workspace_id = me.json()["workspaces"][0]["id"]
    user_id = me.json()["id"]
    return {
        "token": token,
        "workspace_id": workspace_id,
        "user_id": user_id,
        "headers": {"Authorization": f"Bearer {token}"},
    }


@pytest.fixture(scope="module")
def api_ready():
    require_py4_server()
    return True


def test_channel_creator_can_delete_channel(api_ready):
    member = _login("alex@demo.com")

    name = f"creator delete {int(time.time())}"
    create = httpx.post(
        f"{API_BASE}/api/v1/workspaces/{member['workspace_id']}/chat/channels",
        headers=member["headers"],
        json={"name": name, "isPrivate": False},
        timeout=60,
    )
    assert create.status_code == 201, create.text
    body = create.json()
    channel_id = body["id"]
    assert body.get("createdById") == member["user_id"]

    delete = httpx.delete(
        f"{API_BASE}/api/v1/workspaces/{member['workspace_id']}/chat/channels/{channel_id}",
        headers=member["headers"],
        timeout=60,
    )
    assert delete.status_code == 200, delete.text


def test_workspace_admin_can_delete_any_channel(api_ready):
    owner = _login("owner@demo.com")
    member = _login("alex@demo.com")

    name = f"admin delete {int(time.time())}"
    create = httpx.post(
        f"{API_BASE}/api/v1/workspaces/{owner['workspace_id']}/chat/channels",
        headers=member["headers"],
        json={"name": name, "isPrivate": False},
        timeout=60,
    )
    assert create.status_code == 201, create.text
    channel_id = create.json()["id"]

    delete = httpx.delete(
        f"{API_BASE}/api/v1/workspaces/{owner['workspace_id']}/chat/channels/{channel_id}",
        headers=owner["headers"],
        timeout=60,
    )
    assert delete.status_code == 200, delete.text
