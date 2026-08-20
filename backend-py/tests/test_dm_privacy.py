"""Direct message privacy — non-participants must not access DM data."""

from __future__ import annotations

import time
import httpx
import pytest

from tests.conftest import API_BASE, require_py4_server

PASSWORD = "password123"
OWNER_EMAIL = "owner@demo.com"
ALEX_EMAIL = "alex@demo.com"


@pytest.fixture(scope="module")
def api_ready():
    require_py4_server()
    return True


def _login(email: str) -> dict:
    res = httpx.post(
        f"{API_BASE}/api/v1/auth/login",
        json={"email": email, "password": PASSWORD},
        timeout=10,
    )
    if res.status_code != 200:
        res = httpx.post(
            f"{API_BASE}/api/v1/auth/login",
            json={"email": email, "password": "Password123!"},
            timeout=10,
        )
    assert res.status_code == 200, res.text
    token = res.json()["accessToken"]
    me = httpx.get(
        f"{API_BASE}/api/v1/auth/me",
        headers={"Authorization": f"Bearer {token}"},
        timeout=10,
    )
    assert me.status_code == 200, me.text
    body = me.json()
    return {
        "token": token,
        "workspace_id": body["workspaces"][0]["id"],
        "user_id": body["id"],
        "headers": {"Authorization": f"Bearer {token}"},
    }


def test_dm_isolated_between_participants(api_ready):
    owner = _login(OWNER_EMAIL)
    alex = _login(ALEX_EMAIL)

    create = httpx.post(
        f"{API_BASE}/api/v1/workspaces/{owner['workspace_id']}/chat/dms",
        headers=owner["headers"],
        json={"userIds": [alex["user_id"]]},
        timeout=10,
    )
    assert create.status_code in (200, 201), create.text
    dm_id = create.json()["id"]

    secret = f"dm privacy ping {int(time.time())}"
    sent = httpx.post(
        f"{API_BASE}/api/v1/workspaces/{owner['workspace_id']}/chat/dms/{dm_id}/messages",
        headers=owner["headers"],
        json={"body": secret},
        timeout=10,
    )
    assert sent.status_code == 201, sent.text

    owner_dms = httpx.get(
        f"{API_BASE}/api/v1/workspaces/{owner['workspace_id']}/chat/dms",
        headers=owner["headers"],
        timeout=10,
    )
    assert owner_dms.status_code == 200, owner_dms.text
    assert any(d["id"] == dm_id for d in owner_dms.json()["data"])

    alex_dms = httpx.get(
        f"{API_BASE}/api/v1/workspaces/{alex['workspace_id']}/chat/dms",
        headers=alex["headers"],
        timeout=10,
    )
    assert alex_dms.status_code == 200, alex_dms.text
    assert any(d["id"] == dm_id for d in alex_dms.json()["data"])

    alex_messages = httpx.get(
        f"{API_BASE}/api/v1/workspaces/{alex['workspace_id']}/chat/dms/{dm_id}/messages",
        headers=alex["headers"],
        timeout=10,
    )
    assert alex_messages.status_code == 200, alex_messages.text
    bodies = [m["body"] for m in alex_messages.json()["data"]]
    assert secret in bodies

    members = httpx.get(
        f"{API_BASE}/api/v1/workspaces/{owner['workspace_id']}/members",
        headers=owner["headers"],
        timeout=10,
    )
    assert members.status_code == 200, members.text
    outsider = next(
        (
            m
            for m in members.json()["data"]
            if m["id"] not in {owner["user_id"], alex["user_id"]}
        ),
        None,
    )
    if not outsider:
        pytest.skip("Need a third workspace member for outsider checks")

    outsider_login = _login(outsider["email"])

    outsider_dms = httpx.get(
        f"{API_BASE}/api/v1/workspaces/{outsider_login['workspace_id']}/chat/dms",
        headers=outsider_login["headers"],
        timeout=10,
    )
    assert outsider_dms.status_code == 200, outsider_dms.text
    assert not any(d["id"] == dm_id for d in outsider_dms.json()["data"])

    outsider_messages = httpx.get(
        f"{API_BASE}/api/v1/workspaces/{outsider_login['workspace_id']}/chat/dms/{dm_id}/messages",
        headers=outsider_login["headers"],
        timeout=10,
    )
    assert outsider_messages.status_code == 404, outsider_messages.text
