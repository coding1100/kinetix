"""LineUp, reminders, favorites, and recents write APIs."""

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


async def _workspace_id(client: AsyncClient, token: str) -> str:
    me = await client.get("/api/v1/auth/me", headers=_auth(token))
    assert me.status_code == 200, me.text
    return me.json()["workspaces"][0]["id"]


async def _create_task(client: AsyncClient, token: str, workspace_id: str) -> str:
    suffix = int(time.time())
    space = await client.post(
        f"/api/v1/workspaces/{workspace_id}/spaces",
        headers=_auth(token),
        json={"name": f"Home Sprint Space {suffix}"},
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
        json={"name": "LineUp task"},
    )
    assert task.status_code == 201, task.text
    return task.json()["id"]


@pytest.mark.asyncio(loop_scope="session")
async def test_lineup_add_reorder_remove(api_client: AsyncClient):
    token = await _login(api_client, *OWNER)
    headers = _auth(token)
    workspace_id = await _workspace_id(api_client, token)
    task_a = await _create_task(api_client, token, workspace_id)
    task_b = await _create_task(api_client, token, workspace_id)

    added = await api_client.post(
        f"/api/v1/workspaces/{workspace_id}/home/lineup",
        headers=headers,
        json={"taskId": task_a},
    )
    assert added.status_code == 201, added.text

    added_b = await api_client.post(
        f"/api/v1/workspaces/{workspace_id}/home/lineup",
        headers=headers,
        json={"taskId": task_b},
    )
    assert added_b.status_code == 201, added_b.text

    reordered = await api_client.put(
        f"/api/v1/workspaces/{workspace_id}/home/lineup/reorder",
        headers=headers,
        json={"taskIds": [task_b, task_a]},
    )
    assert reordered.status_code == 200, reordered.text

    lineup = await api_client.get(
        f"/api/v1/workspaces/{workspace_id}/home/lineup",
        headers=headers,
    )
    assert lineup.status_code == 200, lineup.text
    ids = [t["id"] for t in lineup.json()["data"]]
    assert task_b in ids and task_a in ids
    assert ids.index(task_b) < ids.index(task_a)

    removed = await api_client.delete(
        f"/api/v1/workspaces/{workspace_id}/home/lineup/{task_a}",
        headers=headers,
    )
    assert removed.status_code == 200, removed.text


@pytest.mark.asyncio(loop_scope="session")
async def test_reminder_favorite_recent_crud(api_client: AsyncClient):
    token = await _login(api_client, *OWNER)
    headers = _auth(token)
    workspace_id = await _workspace_id(api_client, token)
    task_id = await _create_task(api_client, token, workspace_id)

    reminder = await api_client.post(
        f"/api/v1/workspaces/{workspace_id}/home/reminders",
        headers=headers,
        json={"title": "Follow up", "dueAt": "2030-01-15T12:00:00Z"},
    )
    assert reminder.status_code == 201, reminder.text
    reminder_id = reminder.json()["id"]

    favorite = await api_client.post(
        f"/api/v1/workspaces/{workspace_id}/home/favorites",
        headers=headers,
        json={
            "name": "LineUp task",
            "itemType": "task",
            "href": f"/home/tasks/{task_id}",
        },
    )
    assert favorite.status_code == 201, favorite.text
    favorite_id = favorite.json()["id"]

    recent = await api_client.post(
        f"/api/v1/workspaces/{workspace_id}/home/recents",
        headers=headers,
        json={
            "name": "LineUp task",
            "itemType": "task",
            "space": "Test",
            "href": f"/home/tasks/{task_id}",
        },
    )
    assert recent.status_code == 201, recent.text

    deleted_reminder = await api_client.delete(
        f"/api/v1/workspaces/{workspace_id}/home/reminders/{reminder_id}",
        headers=headers,
    )
    assert deleted_reminder.status_code == 200, deleted_reminder.text

    deleted_favorite = await api_client.delete(
        f"/api/v1/workspaces/{workspace_id}/home/favorites/{favorite_id}",
        headers=headers,
    )
    assert deleted_favorite.status_code == 200, deleted_favorite.text

    recents = await api_client.get(
        f"/api/v1/workspaces/{workspace_id}/home/recents",
        headers=headers,
    )
    assert recents.status_code == 200, recents.text
    assert any(r["href"] == f"/home/tasks/{task_id}" for r in recents.json()["data"])
