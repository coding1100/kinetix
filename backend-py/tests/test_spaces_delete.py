"""Delete space/list with nested tasks, statuses, and assignees."""

from __future__ import annotations

import time

import pytest
from httpx import AsyncClient

OWNER = ("owner@demo.com", "password123")


async def _login(client: AsyncClient, email: str, password: str) -> str:
    res = await client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": password},
    )
    assert res.status_code == 200, res.text
    return res.json()["accessToken"]


def _auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


async def _workspace_and_user(client: AsyncClient, token: str) -> tuple[str, str]:
    me = await client.get("/api/v1/auth/me", headers=_auth(token))
    assert me.status_code == 200, me.text
    body = me.json()
    return body["workspaces"][0]["id"], body["id"]


@pytest.mark.asyncio(loop_scope="session")
async def test_delete_space_with_tasks_and_statuses(api_client: AsyncClient):
    token = await _login(api_client, *OWNER)
    headers = _auth(token)
    workspace_id, user_id = await _workspace_and_user(api_client, token)
    suffix = int(time.time())

    space = await api_client.post(
        f"/api/v1/workspaces/{workspace_id}/spaces",
        headers=headers,
        json={"name": f"Delete Space {suffix}"},
    )
    assert space.status_code == 201, space.text
    space_id = space.json()["id"]

    lst = await api_client.post(
        f"/api/v1/workspaces/{workspace_id}/spaces/{space_id}/lists",
        headers=headers,
        json={"name": "Tasks"},
    )
    assert lst.status_code == 201, lst.text
    list_id = lst.json()["id"]

    task = await api_client.post(
        f"/api/v1/workspaces/{workspace_id}/lists/{list_id}/tasks",
        headers=headers,
        json={"name": "Nested task", "description": "details"},
    )
    assert task.status_code == 201, task.text
    task_id = task.json()["id"]

    patched = await api_client.patch(
        f"/api/v1/workspaces/{workspace_id}/tasks/{task_id}",
        headers=headers,
        json={"assigneeIds": [user_id], "priority": "high"},
    )
    assert patched.status_code == 200, patched.text

    deleted = await api_client.delete(
        f"/api/v1/workspaces/{workspace_id}/spaces/{space_id}",
        headers=headers,
    )
    assert deleted.status_code == 200, deleted.text
    assert deleted.json()["ok"] is True

    gone = await api_client.get(
        f"/api/v1/workspaces/{workspace_id}/spaces/{space_id}",
        headers=headers,
    )
    assert gone.status_code == 404


@pytest.mark.asyncio(loop_scope="session")
async def test_delete_list_with_tasks(api_client: AsyncClient):
    token = await _login(api_client, *OWNER)
    headers = _auth(token)
    workspace_id, _ = await _workspace_and_user(api_client, token)
    suffix = int(time.time())

    space = await api_client.post(
        f"/api/v1/workspaces/{workspace_id}/spaces",
        headers=headers,
        json={"name": f"List Delete Space {suffix}"},
    )
    assert space.status_code == 201, space.text
    space_id = space.json()["id"]

    lst = await api_client.post(
        f"/api/v1/workspaces/{workspace_id}/spaces/{space_id}/lists",
        headers=headers,
        json={"name": "Removable"},
    )
    assert lst.status_code == 201, lst.text
    list_id = lst.json()["id"]

    created = await api_client.post(
        f"/api/v1/workspaces/{workspace_id}/lists/{list_id}/tasks",
        headers=headers,
        json={"name": "Task in list"},
    )
    assert created.status_code == 201, created.text

    deleted = await api_client.delete(
        f"/api/v1/workspaces/{workspace_id}/lists/{list_id}",
        headers=headers,
    )
    assert deleted.status_code == 200, deleted.text
    assert deleted.json()["ok"] is True
