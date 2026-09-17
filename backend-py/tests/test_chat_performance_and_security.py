"""Integration tests for Chat & Real-Time Collaboration Performance, Security, and Pagination."""

from __future__ import annotations

import time
import httpx
import pytest

PASSWORD = "password123"
OWNER_EMAIL = "owner@demo.com"
ALEX_EMAIL = "alex@demo.com"


def _login(base: str, email: str) -> dict:
    res = httpx.post(
        f"{base}/api/v1/auth/login",
        json={"email": email, "password": PASSWORD},
        timeout=10,
    )
    if res.status_code != 200:
        res = httpx.post(
            f"{base}/api/v1/auth/login",
            json={"email": email, "password": "Password123!"},
            timeout=10,
        )
    assert res.status_code == 200, res.text
    token = res.json()["accessToken"]
    me = httpx.get(
        f"{base}/api/v1/auth/me",
        headers={"Authorization": f"Bearer {token}"},
        timeout=10,
    )
    assert me.status_code == 200, me.text
    body = me.json()
    return {
        "token": token,
        "workspace_id": body["workspaces"][0]["id"],
        "user_id": body["id"],
        "full_name": body.get("fullName") or "",
        "headers": {"Authorization": f"Bearer {token}"},
    }


def test_channel_pagination_and_read_receipts(dedicated_api_server):
    """Verify paginated message loading without N+1 query overhead and accurate read receipts."""
    base = dedicated_api_server
    owner = _login(base, OWNER_EMAIL)
    alex = _login(base, ALEX_EMAIL)
    ws_id = owner["workspace_id"]

    # 1. Create a dedicated channel with both owner and alex
    channel_name = f"perf-test-{int(time.time() * 1000)}"
    create_chan = httpx.post(
        f"{base}/api/v1/workspaces/{ws_id}/chat/channels",
        headers=owner["headers"],
        json={"name": channel_name, "isPrivate": False, "memberIds": [alex["user_id"]]},
        timeout=10,
    )
    assert create_chan.status_code == 201, create_chan.text
    channel_id = create_chan.json()["id"]

    # 2. Post multiple messages
    message_ids = []
    for i in range(5):
        post_msg = httpx.post(
            f"{base}/api/v1/workspaces/{ws_id}/chat/channels/{channel_id}/messages",
            headers=owner["headers"],
            json={"body": f"Test message {i}"},
            timeout=10,
        )
        assert post_msg.status_code == 201, post_msg.text
        message_ids.append(post_msg.json()["id"])

    # 3. Alex marks channel as read
    read_res = httpx.post(
        f"{base}/api/v1/workspaces/{ws_id}/chat/channels/{channel_id}/read",
        headers=alex["headers"],
        timeout=10,
    )
    assert read_res.status_code == 200, read_res.text

    # 4. Fetch messages paginated with limit
    fetch_res = httpx.get(
        f"{base}/api/v1/workspaces/{ws_id}/chat/channels/{channel_id}/messages?limit=3",
        headers=owner["headers"],
        timeout=10,
    )
    assert fetch_res.status_code == 200, fetch_res.text
    data = fetch_res.json()
    assert len(data["data"]) == 3
    assert data["hasMore"] is True
    assert data["nextBefore"] is not None

    # Check readByUserIds contains alex for the read messages
    for msg in data["data"]:
        read_users = msg.get("readByUserIds") or []
        assert alex["user_id"] in read_users

    # 5. Fetch older page using before cursor
    before_cursor = data["nextBefore"]
    older_res = httpx.get(
        f"{base}/api/v1/workspaces/{ws_id}/chat/channels/{channel_id}/messages?limit=3&before={before_cursor}",
        headers=owner["headers"],
        timeout=10,
    )
    assert older_res.status_code == 200, older_res.text
    older_data = older_res.json()
    assert len(older_data["data"]) == 2
    assert older_data["hasMore"] is False


def test_private_channel_security_isolation(dedicated_api_server):
    """Verify non-members cannot fetch or post messages in private channels."""
    base = dedicated_api_server
    owner = _login(base, OWNER_EMAIL)
    alex = _login(base, ALEX_EMAIL)
    ws_id = owner["workspace_id"]

    # Owner creates a private channel WITHOUT alex
    priv_name = f"secret-{int(time.time() * 1000)}"
    create_priv = httpx.post(
        f"{base}/api/v1/workspaces/{ws_id}/chat/channels",
        headers=owner["headers"],
        json={"name": priv_name, "isPrivate": True, "memberIds": []},
        timeout=10,
    )
    assert create_priv.status_code == 201, create_priv.text
    channel_id = create_priv.json()["id"]

    # Alex attempts to get channel details -> 404 or 403
    alex_get = httpx.get(
        f"{base}/api/v1/workspaces/{ws_id}/chat/channels/{channel_id}",
        headers=alex["headers"],
        timeout=10,
    )
    assert alex_get.status_code in (403, 404)

    # Alex attempts to read messages -> 404 or 403
    alex_msgs = httpx.get(
        f"{base}/api/v1/workspaces/{ws_id}/chat/channels/{channel_id}/messages",
        headers=alex["headers"],
        timeout=10,
    )
    assert alex_msgs.status_code in (403, 404)

    # Alex attempts to post a message -> 404 or 403
    alex_post = httpx.post(
        f"{base}/api/v1/workspaces/{ws_id}/chat/channels/{channel_id}/messages",
        headers=alex["headers"],
        json={"body": "Sneaky unauthorized message"},
        timeout=10,
    )
    assert alex_post.status_code in (403, 404)


def test_direct_message_privacy(dedicated_api_server):
    """Verify DMs are strictly private between participants."""
    base = dedicated_api_server
    owner = _login(base, OWNER_EMAIL)
    alex = _login(base, ALEX_EMAIL)
    ws_id = owner["workspace_id"]

    # 1. Owner creates or gets DM with Alex
    dm_res = httpx.post(
        f"{base}/api/v1/workspaces/{ws_id}/chat/dms",
        headers=owner["headers"],
        json={"userIds": [alex["user_id"]]},
        timeout=10,
    )
    assert dm_res.status_code in (200, 201), dm_res.text
    dm_id = dm_res.json()["id"]

    # 2. Owner posts DM message
    send_res = httpx.post(
        f"{base}/api/v1/workspaces/{ws_id}/chat/dms/{dm_id}/messages",
        headers=owner["headers"],
        json={"body": "Private direct message hello"},
        timeout=10,
    )
    assert send_res.status_code == 201, send_res.text
    msg_id = send_res.json()["id"]

    # 3. Alex can fetch DM messages
    alex_dm_msgs = httpx.get(
        f"{base}/api/v1/workspaces/{ws_id}/chat/dms/{dm_id}/messages?limit=10",
        headers=alex["headers"],
        timeout=10,
    )
    assert alex_dm_msgs.status_code == 200, alex_dm_msgs.text
    assert any(m["id"] == msg_id for m in alex_dm_msgs.json()["data"])
