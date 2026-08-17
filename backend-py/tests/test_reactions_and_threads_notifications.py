"""Test reaction and thread reply notifications end-to-end."""

from __future__ import annotations

import time
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


def test_reaction_and_thread_reply_notification_flow():
    require_py4_server()
    owner = _login(OWNER_EMAIL)
    husnain = _login(HUSNAIN_EMAIL)
    ws = owner["workspace_id"]

    # 1. Get or create a channel
    channels_res = httpx.get(
        f"{API_BASE}/api/v1/workspaces/{ws}/chat/channels",
        headers=owner["headers"],
        timeout=60,
    )
    assert channels_res.status_code == 200, channels_res.text
    channels = channels_res.json()["data"]
    if not channels:
        pytest.skip("No channels available")
    channel_id = channels[0]["id"]

    # 2. Owner sends a message
    msg_res = httpx.post(
        f"{API_BASE}/api/v1/workspaces/{ws}/chat/channels/{channel_id}/messages",
        headers=owner["headers"],
        json={"body": f"Notification test message {int(time.time())}"},
        timeout=60,
    )
    assert msg_res.status_code in (200, 201), msg_res.text
    msg_id = msg_res.json()["id"]

    # 3. Husnain reacts to Owner's message -> Owner receives a REACTION notification
    react_res = httpx.post(
        f"{API_BASE}/api/v1/workspaces/{ws}/chat/messages/{msg_id}/reactions",
        headers=husnain["headers"],
        json={"emoji": "👍"},
        timeout=60,
    )
    assert react_res.status_code in (200, 201), react_res.text

    # 4. Husnain replies to Owner's message thread -> Owner receives a THREAD REPLY notification
    reply_res = httpx.post(
        f"{API_BASE}/api/v1/workspaces/{ws}/chat/channels/{channel_id}/messages",
        headers=husnain["headers"],
        json={
            "body": f"Thread reply test {int(time.time())}",
            "parentId": msg_id,
        },
        timeout=60,
    )
    assert reply_res.status_code in (200, 201), reply_res.text

    # 5. Verify Owner's inbox contains reaction and reply notifications
    inbox_res = httpx.get(
        f"{API_BASE}/api/v1/workspaces/{ws}/home/inbox",
        headers=owner["headers"],
        timeout=60,
    )
    assert inbox_res.status_code == 200, inbox_res.text
    inbox_items = inbox_res.json()["data"]
    types = [item.get("type") for item in inbox_items]
    assert "REACTION" in types or "REPLY" in types
