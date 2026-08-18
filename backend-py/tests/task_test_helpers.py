"""Shared helpers for task management API tests."""

from __future__ import annotations

import time

from httpx import AsyncClient

OWNER = ("owner@demo.com", "password123")
MEMBER = ("alex@demo.com", "Password123!")




_TOKEN_CACHE: dict[tuple[str, str], str] = {}


async def login(client: AsyncClient, email: str, password: str) -> str:
    key = (email, password)
    if key in _TOKEN_CACHE:
        return _TOKEN_CACHE[key]
    res = await client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": password},
    )
    if res.status_code != 200:
        alt_pwd = "password123" if password != "password123" else "Password123!"
        res = await client.post(
            "/api/v1/auth/login",
            json={"email": email, "password": alt_pwd},
        )
    assert res.status_code == 200, res.text
    token = res.json()["accessToken"]
    _TOKEN_CACHE[key] = token
    return token




def auth_headers(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


_SHARED_DEMO_WS: str | None = None


async def _shared_demo_workspace_id(client: AsyncClient) -> str:
    """The workspace both demo users belong to, with owner@demo.com as OWNER.

    Dev databases accumulate extra workspaces, so "first workspace of the
    owner" is not reliable — cross-user tests need the one they share.
    """
    global _SHARED_DEMO_WS
    if _SHARED_DEMO_WS:
        return _SHARED_DEMO_WS
    owner_token = await login(client, *OWNER)
    member_token = await login(client, *MEMBER)
    owner_me = await client.get("/api/v1/auth/me", headers=auth_headers(owner_token))
    assert owner_me.status_code == 200, owner_me.text
    owner_ws = {w["id"]: w for w in owner_me.json()["workspaces"]}
    member_me = await client.get("/api/v1/auth/me", headers=auth_headers(member_token))
    assert member_me.status_code == 200, member_me.text
    for ws in member_me.json()["workspaces"]:
        overlap = owner_ws.get(ws["id"])
        if overlap and overlap["role"] == "OWNER":
            _SHARED_DEMO_WS = ws["id"]
            return _SHARED_DEMO_WS
    raise AssertionError(
        "No workspace shared by owner@demo.com (as OWNER) and alex@demo.com — reseed demo data"
    )


async def workspace_id(client: AsyncClient, token: str) -> str:
    me = await client.get("/api/v1/auth/me", headers=auth_headers(token))
    assert me.status_code == 200, me.text
    workspaces = me.json()["workspaces"]
    shared = await _shared_demo_workspace_id(client)
    if any(w["id"] == shared for w in workspaces):
        return shared
    return workspaces[0]["id"]


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
