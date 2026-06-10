"""Inbox notifications for channel access, follow, mention, and delete."""

from __future__ import annotations

import time

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

from app.main import app
from app.services.notification_service import parse_person_mention_labels

PASSWORD = "password123"
OWNER_EMAIL = "owner@demo.com"
HUSNAIN_EMAIL = "htrajpoot3998@gmail.com"


def test_parse_person_mention_labels():
    assert parse_person_mention_labels("@Husnain hey") == ["Husnain"]
    assert parse_person_mention_labels("@Husnain\u00a0Ali ping") == ["Husnain Ali"]
    assert parse_person_mention_labels("@A @B") == ["A", "B"]


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
        "full_name": body.get("fullName") or "",
        "headers": {"Authorization": f"Bearer {token}"},
    }


async def _notifications(client: AsyncClient, ctx: dict) -> dict:
    res = await client.get(
        f"/api/v1/workspaces/{ctx['workspace_id']}/home/notifications",
        headers=ctx["headers"],
    )
    assert res.status_code == 200, res.text
    return res.json()


def _has_notification(items: list[dict], *, needle: str, type_hint: str | None = None) -> bool:
    needle_l = needle.lower()
    for item in items:
        if type_hint and item.get("type") != type_hint:
            continue
        hay = f"{item.get('title', '')} {item.get('preview', '')}".lower()
        if needle_l in hay:
            return True
    return False


@pytest.mark.asyncio
async def test_home_notification_flows(api_client: AsyncClient):
    client = api_client
    owner = await _login(client, OWNER_EMAIL)
    husnain = await _login(client, HUSNAIN_EMAIL)

    access_name = f"notif access {int(time.time())}"
    create = await client.post(
        f"/api/v1/workspaces/{owner['workspace_id']}/chat/channels",
        headers=owner["headers"],
        json={
            "name": access_name,
            "isPrivate": True,
            "memberIds": [husnain["user_id"]],
        },
    )
    assert create.status_code == 201, create.text
    access_channel_id = create.json()["id"]

    husnain_notifs = await _notifications(client, husnain)
    assert _has_notification(
        husnain_notifs["data"],
        needle=f"added you to #{access_name.lower()}",
    ), husnain_notifs["data"][:3]

    remove = await client.delete(
        f"/api/v1/workspaces/{owner['workspace_id']}/chat/channels/{access_channel_id}/members/{husnain['user_id']}",
        headers=owner["headers"],
    )
    assert remove.status_code == 200, remove.text

    husnain_after_remove = await _notifications(client, husnain)
    assert _has_notification(
        husnain_after_remove["data"],
        needle="removed from",
    ), husnain_after_remove["data"][:3]

    channels = await client.get(
        f"/api/v1/workspaces/{owner['workspace_id']}/chat/channels",
        headers=owner["headers"],
    )
    assert channels.status_code == 200, channels.text
    channel_list = channels.json()["data"]
    assert channel_list, "No channels in workspace"
    public_channel = next(
        (c for c in channel_list if not c.get("isPrivate")),
        None,
    )
    assert public_channel, "No public channel for follow/mention tests"
    channel_id = public_channel["id"]

    await client.patch(
        f"/api/v1/workspaces/{owner['workspace_id']}/chat/channels/{channel_id}/members/{husnain['user_id']}",
        headers=owner["headers"],
        json={"isFollowing": False},
    )

    follow = await client.patch(
        f"/api/v1/workspaces/{owner['workspace_id']}/chat/channels/{channel_id}/members/{husnain['user_id']}",
        headers=owner["headers"],
        json={"isFollowing": True},
    )
    assert follow.status_code == 200, follow.text

    husnain_follow = await _notifications(client, husnain)
    assert _has_notification(
        husnain_follow["data"],
        needle="started following you",
    ), husnain_follow["data"][:3]

    unfollow = await client.patch(
        f"/api/v1/workspaces/{owner['workspace_id']}/chat/channels/{channel_id}/members/{husnain['user_id']}",
        headers=owner["headers"],
        json={"isFollowing": False},
    )
    assert unfollow.status_code == 200, unfollow.text

    husnain_unfollow = await _notifications(client, husnain)
    assert _has_notification(
        husnain_unfollow["data"],
        needle="unfollowed you",
    ), husnain_unfollow["data"][:3]

    target_name = owner["full_name"].strip()
    assert target_name, "Owner full name required for mention resolution"
    mention_body = f"@{target_name.replace(' ', chr(0xA0))} please review"

    msg = await client.post(
        f"/api/v1/workspaces/{husnain['workspace_id']}/chat/channels/{channel_id}/messages",
        headers=husnain["headers"],
        json={"body": mention_body},
    )
    assert msg.status_code == 201, msg.text

    owner_mention = await _notifications(client, owner)
    assert _has_notification(
        owner_mention["data"],
        needle="mentioned you",
        type_hint="mention",
    ), owner_mention["data"][:3]

    delete_name = f"notif delete {int(time.time())}"
    delete_create = await client.post(
        f"/api/v1/workspaces/{owner['workspace_id']}/chat/channels",
        headers=owner["headers"],
        json={
            "name": delete_name,
            "isPrivate": True,
            "memberIds": [husnain["user_id"]],
        },
    )
    assert delete_create.status_code == 201, delete_create.text
    delete_channel_id = delete_create.json()["id"]

    delete = await client.delete(
        f"/api/v1/workspaces/{owner['workspace_id']}/chat/channels/{delete_channel_id}",
        headers=owner["headers"],
    )
    assert delete.status_code == 200, delete.text

    husnain_delete = await _notifications(client, husnain)
    assert _has_notification(
        husnain_delete["data"],
        needle="deleted",
    ), husnain_delete["data"][:3]
