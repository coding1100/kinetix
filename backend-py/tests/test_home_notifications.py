"""Inbox notifications for channel access, follow, mention, and delete."""

from __future__ import annotations

import time
import httpx
import pytest

from tests.conftest import API_BASE, require_py4_server
from app.services.notification_service import (
    has_special_channel_mention,
    parse_person_mention_labels,
)

PASSWORD = "password123"
OWNER_EMAIL = "owner@demo.com"
ALEX_EMAIL = "alex@demo.com"


def test_parse_person_mention_labels():
    assert parse_person_mention_labels("@Husnain hey") == ["Husnain"]
    assert parse_person_mention_labels("@Husnain\u00a0Ali ping") == ["Husnain Ali"]
    assert parse_person_mention_labels("@A @B") == ["A", "B"]


def test_has_special_channel_mention():
    assert has_special_channel_mention("Hello @everyone!") is True
    assert has_special_channel_mention("Attention @channel please") is True
    assert has_special_channel_mention("Hey @here active people") is True
    assert has_special_channel_mention("Notice to @all members") is True
    assert has_special_channel_mention("Just a normal @Husnain message") is False


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
        "full_name": body.get("fullName") or "",
        "headers": {"Authorization": f"Bearer {token}"},
    }


def _notifications(ctx: dict) -> dict:
    res = httpx.get(
        f"{API_BASE}/api/v1/workspaces/{ctx['workspace_id']}/home/notifications",
        headers=ctx["headers"],
        timeout=10,
    )
    assert res.status_code == 200, res.text
    return res.json()


def _has_notification(
    items: list[dict],
    *,
    needle: str,
    type_hint: str | None = None,
) -> bool:
    needle_lower = needle.lower()
    for item in items:
        if type_hint and item.get("type") != type_hint:
            continue
        title = (item.get("title") or "").lower()
        preview = (item.get("preview") or "").lower()
        source = (item.get("source") or "").lower()
        if (
            needle_lower in title
            or needle_lower in preview
            or needle_lower in source
        ):
            return True
    return False


def test_home_notification_flows(api_ready):
    owner = _login(OWNER_EMAIL)
    alex = _login(ALEX_EMAIL)

    access_name = f"notif access {int(time.time())}"
    create = httpx.post(
        f"{API_BASE}/api/v1/workspaces/{owner['workspace_id']}/chat/channels",
        headers=owner["headers"],
        json={
            "name": access_name,
            "isPrivate": True,
            "memberIds": [alex["user_id"]],
        },
        timeout=10,
    )
    assert create.status_code == 201, create.text
    access_channel_id = create.json()["id"]

    alex_notifs = _notifications(alex)
    assert _has_notification(
        alex_notifs["data"],
        needle=f"added you to #{access_name.lower()}",
    ), alex_notifs["data"][:3]

    remove = httpx.delete(
        f"{API_BASE}/api/v1/workspaces/{owner['workspace_id']}/chat/channels/{access_channel_id}/members/{alex['user_id']}",
        headers=owner["headers"],
        timeout=10,
    )
    assert remove.status_code == 200, remove.text

    alex_after_remove = _notifications(alex)
    assert _has_notification(
        alex_after_remove["data"],
        needle="removed from",
    ), alex_after_remove["data"][:3]
