"""Task assignment notifications and realtime-related task flows."""

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


async def _workspace_id(client: AsyncClient, token: str) -> str:
    me = await client.get("/api/v1/auth/me", headers=_auth(token))
    assert me.status_code == 200, me.text
    return me.json()["workspaces"][0]["id"]


async def _create_task(client: AsyncClient, token: str, workspace_id: str) -> str:
    suffix = int(time.time())
    space = await client.post(
        f"/api/v1/workspaces/{workspace_id}/spaces",
        headers=_auth(token),
        json={"name": f"Assign Space {suffix}"},
    )
    assert space.status_code == 201, space.text
    space_id = space.json()["id"]
    lst = await client.post(
        f"/api/v1/workspaces/{workspace_id}/spaces/{space_id}/lists",
        headers=_auth(token),
        json={"name": "List"},
    )
    assert lst.status_code == 201, lst.text
    list_id = lst.json()["id"]
    task = await client.post(
        f"/api/v1/workspaces/{workspace_id}/lists/{list_id}/tasks",
        headers=_auth(token),
        json={"name": "Assignable task"},
    )
    assert task.status_code == 201, task.text
    return task.json()["id"]


@pytest.mark.asyncio(loop_scope="session")
async def test_task_assignment_creates_inbox_notification(api_client: AsyncClient):
    owner_token = await _login(api_client, *OWNER)
    member_token = await _login(api_client, *MEMBER)
    owner_headers = _auth(owner_token)
    member_headers = _auth(member_token)
    workspace_id = await _workspace_id(api_client, owner_token)

    me = await api_client.get("/api/v1/auth/me", headers=member_headers)
    assert me.status_code == 200, me.text
    member_id = me.json()["id"]

    task_id = await _create_task(api_client, owner_token, workspace_id)

    patched = await api_client.patch(
        f"/api/v1/workspaces/{workspace_id}/tasks/{task_id}",
        headers=owner_headers,
        json={"assigneeIds": [member_id]},
    )
    assert patched.status_code == 200, patched.text

    inbox = await api_client.get(
        f"/api/v1/workspaces/{workspace_id}/home/inbox?tab=all",
        headers=member_headers,
    )
    assert inbox.status_code == 200, inbox.text
    items = inbox.json()["data"]
    assert any(
        i.get("type") == "assignment" and task_id in (i.get("href") or "")
        for i in items
    )
