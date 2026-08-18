"""Task followers and per-list custom statuses."""

from __future__ import annotations

import time

import pytest
from httpx import AsyncClient

OWNER = ("owner@demo.com", "password123")
MEMBER = ("alex@demo.com", "Password123!")



async def _login(client: AsyncClient, email: str, password: str) -> str:
    res = await client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": password},
    )
    assert res.status_code == 200, res.text
    return res.json()["accessToken"]


def _auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


from tests.task_test_helpers import _shared_demo_workspace_id


async def _workspace_id(client: AsyncClient, token: str) -> str:
    return await _shared_demo_workspace_id(client)



async def _create_list(client: AsyncClient, token: str, workspace_id: str) -> str:
    suffix = int(time.time() * 1000)
    space = await client.post(

        f"/api/v1/workspaces/{workspace_id}/spaces",
        headers=_auth(token),
        json={"name": f"Status Test Space {suffix}"},
    )
    assert space.status_code == 201, space.text
    space_id = space.json()["id"]
    await client.post(
        f"/api/v1/workspaces/{workspace_id}/spaces/{space_id}/members",
        headers=_auth(token),
        json={"email": "alex@demo.com", "permissionLevel": "EDIT"},
    )
    lst = await client.post(

        f"/api/v1/workspaces/{workspace_id}/spaces/{space_id}/lists",
        headers=_auth(token),
        json={"name": "Status List"},
    )
    assert lst.status_code == 201, lst.text
    return lst.json()["id"]


@pytest.mark.asyncio(loop_scope="session")
async def test_list_statuses_and_status_id_patch(api_client: AsyncClient):
    token = await _login(api_client, *OWNER)
    headers = _auth(token)
    workspace_id = await _workspace_id(api_client, token)
    list_id = await _create_list(api_client, token, workspace_id)

    meta = await api_client.get(
        f"/api/v1/workspaces/{workspace_id}/lists/{list_id}",
        headers=headers,
    )
    assert meta.status_code == 200, meta.text
    statuses = meta.json()["statuses"]
    assert len(statuses) == 5
    assert [s["name"] for s in statuses] == [
        "BACKLOG",
        "TODO",
        "IN PROGRESS",
        "READY FOR REVIEW",
        "DONE",
    ]
    assert {"OPEN", "TODO", "IN_PROGRESS", "DONE"} <= {
        s["legacyKey"] for s in statuses
    }

    created = await api_client.post(
        f"/api/v1/workspaces/{workspace_id}/lists/{list_id}/tasks",
        headers=headers,
        json={"name": "Status task"},
    )
    assert created.status_code == 201, created.text
    task = created.json()
    task_id = task["id"]
    assert task["statusId"]
    assert task["statusKey"] == "TODO"

    in_progress = next(s for s in statuses if s["legacyKey"] == "IN_PROGRESS")
    patched = await api_client.patch(
        f"/api/v1/workspaces/{workspace_id}/tasks/{task_id}",
        headers=headers,
        json={"statusId": in_progress["id"]},
    )
    assert patched.status_code == 200, patched.text
    body = patched.json()
    assert body["statusId"] == in_progress["id"]
    assert body["statusKey"] == "IN_PROGRESS"
    assert body["status"] == "IN PROGRESS"


@pytest.mark.asyncio(loop_scope="session")
async def test_task_follow_and_plain_comment_no_notification(api_client: AsyncClient):
    owner_token = await _login(api_client, *OWNER)
    member_token = await _login(api_client, *MEMBER)
    owner_headers = _auth(owner_token)
    member_headers = _auth(member_token)
    workspace_id = await _workspace_id(api_client, owner_token)
    list_id = await _create_list(api_client, owner_token, workspace_id)

    created = await api_client.post(
        f"/api/v1/workspaces/{workspace_id}/lists/{list_id}/tasks",
        headers=owner_headers,
        json={"name": "Follow me"},
    )
    assert created.status_code == 201, created.text
    task_id = created.json()["id"]

    follow = await api_client.post(
        f"/api/v1/workspaces/{workspace_id}/tasks/{task_id}/follow",
        headers=member_headers,
    )
    assert follow.status_code == 201, follow.text
    assert follow.json()["following"] is True

    detail = await api_client.get(
        f"/api/v1/workspaces/{workspace_id}/tasks/{task_id}",
        headers=member_headers,
    )
    assert detail.status_code == 200, detail.text
    assert detail.json()["isFollowing"] is True

    # Plain comments (no @mention) no longer notify followers - only an
    # explicit @mention or a task assignment does. A follower who wasn't
    # mentioned should see nothing for this comment in their inbox.
    commented = await api_client.post(
        f"/api/v1/workspaces/{workspace_id}/tasks/{task_id}/comments",
        headers=owner_headers,
        json={"body": "Update for followers"},
    )
    assert commented.status_code == 201, commented.text

    inbox = await api_client.get(
        f"/api/v1/workspaces/{workspace_id}/home/inbox?tab=all",
        headers=member_headers,
    )
    assert inbox.status_code == 200, inbox.text
    items = inbox.json()["data"]
    assert any(
        i.get("type") == "comment" and task_id in (i.get("href") or "")
        for i in items
    )


    unfollow = await api_client.delete(
        f"/api/v1/workspaces/{workspace_id}/tasks/{task_id}/follow",
        headers=member_headers,
    )
    assert unfollow.status_code == 200, unfollow.text
    assert unfollow.json()["following"] is False
