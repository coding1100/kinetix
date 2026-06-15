"""Task CRUD: create, update priority, comment, delete."""

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


async def _create_list(client: AsyncClient, token: str, workspace_id: str) -> str:
    suffix = int(time.time())
    space = await client.post(
        f"/api/v1/workspaces/{workspace_id}/spaces",
        headers=_auth(token),
        json={"name": f"Task Test Space {suffix}"},
    )
    assert space.status_code == 201, space.text
    space_id = space.json()["id"]
    lst = await client.post(
        f"/api/v1/workspaces/{workspace_id}/spaces/{space_id}/lists",
        headers=_auth(token),
        json={"name": "Task List"},
    )
    assert lst.status_code == 201, lst.text
    return lst.json()["id"]


@pytest.mark.asyncio(loop_scope="session")
async def test_task_create_update_priority_comment_delete(api_client: AsyncClient):
    token = await _login(api_client, *OWNER)
    headers = _auth(token)
    workspace_id = await _workspace_id(api_client, token)
    list_id = await _create_list(api_client, token, workspace_id)

    created = await api_client.post(
        f"/api/v1/workspaces/{workspace_id}/lists/{list_id}/tasks",
        headers=headers,
        json={"name": "Sprint item", "description": "Details"},
    )
    assert created.status_code == 201, created.text
    task = created.json()
    task_id = task["id"]
    assert task["name"] == "Sprint item"
    assert task["statusKey"] == "TODO"

    patched = await api_client.patch(
        f"/api/v1/workspaces/{workspace_id}/tasks/{task_id}",
        headers=headers,
        json={"status": "IN_PROGRESS", "priority": "high"},
    )
    assert patched.status_code == 200, patched.text
    body = patched.json()
    assert body["statusKey"] == "IN_PROGRESS"
    assert body["priority"] == "high"

    commented = await api_client.post(
        f"/api/v1/workspaces/{workspace_id}/tasks/{task_id}/comments",
        headers=headers,
        json={"body": "Looks good"},
    )
    assert commented.status_code == 201, commented.text
    comments = commented.json().get("comments") or []
    assert any(c["body"] == "Looks good" for c in comments)

    cleared = await api_client.patch(
        f"/api/v1/workspaces/{workspace_id}/tasks/{task_id}",
        headers=headers,
        json={"priority": None},
    )
    assert cleared.status_code == 200, cleared.text
    assert cleared.json().get("priority") is None

    deleted = await api_client.delete(
        f"/api/v1/workspaces/{workspace_id}/tasks/{task_id}",
        headers=headers,
    )
    assert deleted.status_code == 200, deleted.text
    assert deleted.json().get("ok") is True

    missing = await api_client.get(
        f"/api/v1/workspaces/{workspace_id}/tasks/{task_id}",
        headers=headers,
    )
    assert missing.status_code == 404


@pytest.mark.asyncio(loop_scope="session")
async def test_task_move_between_lists(api_client: AsyncClient):
    token = await _login(api_client, *OWNER)
    headers = _auth(token)
    workspace_id = await _workspace_id(api_client, token)
    list_a = await _create_list(api_client, token, workspace_id)
    list_b = await _create_list(api_client, token, workspace_id)

    created = await api_client.post(
        f"/api/v1/workspaces/{workspace_id}/lists/{list_a}/tasks",
        headers=headers,
        json={"name": "Move me"},
    )
    assert created.status_code == 201, created.text
    task_id = created.json()["id"]

    moved = await api_client.patch(
        f"/api/v1/workspaces/{workspace_id}/tasks/{task_id}",
        headers=headers,
        json={"listId": list_b},
    )
    assert moved.status_code == 200, moved.text
    assert moved.json()["listId"] == list_b

    in_b = await api_client.get(
        f"/api/v1/workspaces/{workspace_id}/lists/{list_b}/tasks",
        headers=headers,
    )
    assert any(t["id"] == task_id for t in in_b.json()["data"])


@pytest.mark.asyncio(loop_scope="session")
async def test_personal_space_auto_created(api_client: AsyncClient):
    token = await _login(api_client, *OWNER)
    headers = _auth(token)
    workspace_id = await _workspace_id(api_client, token)

    spaces = await api_client.get(
        f"/api/v1/workspaces/{workspace_id}/spaces",
        headers=headers,
    )
    assert spaces.status_code == 200, spaces.text
    personal = next(
        (s for s in spaces.json()["data"] if s.get("isPersonal") or s["name"] == "Personal"),
        None,
    )
    assert personal is not None
    assert personal.get("standaloneLists")

    tasks = await api_client.get(
        f"/api/v1/workspaces/{workspace_id}/tasks?filter=personal",
        headers=headers,
    )
    assert tasks.status_code == 200, tasks.text
    assert "data" in tasks.json()


@pytest.mark.asyncio(loop_scope="session")
async def test_task_list_filter_assigned(api_client: AsyncClient):
    token = await _login(api_client, *OWNER)
    headers = _auth(token)
    workspace_id = await _workspace_id(api_client, token)

    res = await api_client.get(
        f"/api/v1/workspaces/{workspace_id}/tasks?filter=assigned",
        headers=headers,
    )
    assert res.status_code == 200, res.text
    assert "data" in res.json()
