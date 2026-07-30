"""DM messages notify via the DM's unread count, never via the inbox."""

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


def test_live_dm_message_bumps_unread_and_skips_inbox():
    require_py4_server()
    owner = _login(OWNER_EMAIL)
    husnain = _login(HUSNAIN_EMAIL)
    ws = owner["workspace_id"]

    create = httpx.post(
        f"{API_BASE}/api/v1/workspaces/{ws}/chat/dms",
        headers=owner["headers"],
        json={"userIds": [husnain["user_id"]]},
        timeout=60,
    )
    assert create.status_code in (200, 201), create.text
    dm_id = create.json()["id"]

    # Recipient reads first, so any unread we see afterwards is from our message.
    read = httpx.post(
        f"{API_BASE}/api/v1/workspaces/{ws}/chat/dms/{dm_id}/read",
        headers=husnain["headers"],
        timeout=60,
    )
    assert read.status_code in (200, 201), read.text

    before = httpx.get(
        f"{API_BASE}/api/v1/workspaces/{ws}/home/inbox",
        headers=husnain["headers"],
        timeout=60,
    )
    assert before.status_code == 200, before.text
    inbox_before = {item["id"] for item in before.json()["data"]}

    me = httpx.get(
        f"{API_BASE}/api/v1/auth/me", headers=husnain["headers"], timeout=60
    )
    assert me.status_code == 200, me.text
    # Mentions are written with a non-breaking space between name parts,
    # which is what PERSON_MENTION_RE matches on.
    mention = "@" + "\xa0".join(me.json()["fullName"].split())

    # Tagging the recipient must not reach the inbox either.
    sent = httpx.post(
        f"{API_BASE}/api/v1/workspaces/{ws}/chat/dms/{dm_id}/messages",
        headers=owner["headers"],
        json={"body": f"{mention} dm unread ping {int(time.time())}"},
        timeout=60,
    )
    assert sent.status_code in (200, 201), sent.text

    dms = httpx.get(
        f"{API_BASE}/api/v1/workspaces/{ws}/chat/dms",
        headers=husnain["headers"],
        timeout=60,
    )
    assert dms.status_code == 200, dms.text
    conversation = next(d for d in dms.json()["data"] if d["id"] == dm_id)
    # The DM itself carries the notification: 1, 2, 10 ... on the conversation.
    assert conversation["unread"] >= 1

    after = httpx.get(
        f"{API_BASE}/api/v1/workspaces/{ws}/home/inbox",
        headers=husnain["headers"],
        timeout=60,
    )
    assert after.status_code == 200, after.text
    new_items = [
        item for item in after.json()["data"] if item["id"] not in inbox_before
    ]
    assert new_items == [], f"DM message leaked into the inbox: {new_items}"
