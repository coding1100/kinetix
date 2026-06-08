"""Workspace People API — OpenAPI registration."""

import httpx
import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app
from tests.conftest import API_BASE, require_py4_server


@pytest.mark.asyncio
async def test_openapi_workspace_people_routes():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get("/openapi.json")
    assert res.status_code == 200
    paths = res.json()["paths"]
    base = "/api/v1/workspaces/{workspace_id}"
    assert f"{base}/invites" in paths
    assert "get" in paths[f"{base}/invites"]
    assert f"{base}/invites/{{invite_id}}" in paths
    assert f"{base}/invites/{{invite_id}}/resend" in paths
    assert f"{base}/members/{{member_user_id}}" in paths
    assert "patch" in paths[f"{base}/members/{{member_user_id}}"]
    assert "delete" in paths[f"{base}/members/{{member_user_id}}"]


def test_live_list_workspace_members_and_invites(auth_context: dict):
    require_py4_server()
    ws = auth_context["workspace_id"]
    token = auth_context["token"]
    headers = {"Authorization": f"Bearer {token}"}

    members = httpx.get(
        f"{API_BASE}/api/v1/workspaces/{ws}/members",
        headers=headers,
        timeout=60,
    )
    assert members.status_code == 200, members.text
    data = members.json()["data"]
    assert isinstance(data, list)
    if data:
        assert "fullName" in data[0]
        assert "role" in data[0]

    invites = httpx.get(
        f"{API_BASE}/api/v1/workspaces/{ws}/invites",
        headers=headers,
        timeout=60,
    )
    if invites.status_code == 405:
        pytest.skip(
            "GET /invites not on live server — restart uvicorn with latest backend-py"
        )
    assert invites.status_code == 200, invites.text
    assert isinstance(invites.json()["data"], list)
