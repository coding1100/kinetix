"""Shared helpers for task management API tests."""

from __future__ import annotations

import time

from httpx import AsyncClient

OWNER = ("owner@demo.com", "password123")
MEMBER = ("alex@demo.com", "password123")


async def login(client: AsyncClient, email: str, password: str) -> str:
    res = await client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": password},
    )
    assert res.status_code == 200, res.text
    return res.json()["accessToken"]


def auth_headers(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


async def workspace_id(client: AsyncClient, token: str) -> str:
    me = await client.get("/api/v1/auth/me", headers=auth_headers(token))
    assert me.status_code == 200, me.text
    return me.json()["workspaces"][0]["id"]


async def user_id(client: AsyncClient, token: str) -> str:
    me = await client.get("/api/v1/auth/me", headers=auth_headers(token))
    assert me.status_code == 200, me.text
    return me.json()["id"]


async def create_space_list(
    client: AsyncClient,
    token: str,
    workspace_id: str,
    *,
    space_name: str | None = None,
    list_name: str = "Task List",
) -> tuple[str, str]:
    suffix = int(time.time() * 1000)
    space = await client.post(
        f"/api/v1/workspaces/{workspace_id}/spaces",
        headers=auth_headers(token),
        json={"name": space_name or f"Task Space {suffix}"},
    )
    assert space.status_code == 201, space.text
    space_id = space.json()["id"]
    lst = await client.post(
        f"/api/v1/workspaces/{workspace_id}/spaces/{space_id}/lists",
        headers=auth_headers(token),
        json={"name": list_name},
    )
    assert lst.status_code == 201, lst.text
    return space_id, lst.json()["id"]


async def create_task(
    client: AsyncClient,
    token: str,
    workspace_id: str,
    list_id: str,
    *,
    name: str = "Test task",
    description: str | None = None,
) -> dict:
    payload: dict = {"name": name}
    if description is not None:
        payload["description"] = description
    res = await client.post(
        f"/api/v1/workspaces/{workspace_id}/lists/{list_id}/tasks",
        headers=auth_headers(token),
        json=payload,
    )
    assert res.status_code == 201, res.text
    return res.json()
