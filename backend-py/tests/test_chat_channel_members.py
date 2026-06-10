"""Channel members API — OpenAPI and live integration."""

import httpx
import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app
from app.schemas.chat import UpdateChannelMemberBody
from tests.conftest import API_BASE, require_py4_server


def test_update_channel_member_body_parses_is_following():
    assert (
        UpdateChannelMemberBody.model_validate({"isFollowing": False}).is_following
        is False
    )
    assert (
        UpdateChannelMemberBody.model_validate({"isFollowing": True}).is_following
        is True
    )
    assert (
        UpdateChannelMemberBody.model_validate({"is_following": False}).is_following
        is False
    )


@pytest.mark.asyncio
async def test_openapi_channel_member_routes():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get("/openapi.json")
    assert res.status_code == 200
    paths = res.json()["paths"]
    base = "/api/v1/workspaces/{workspace_id}/chat/channels/{channel_id}/members"
    assert base in paths
    assert "get" in paths[base]
    assert "post" in paths[base]
    delete_path = f"{base}/{{member_user_id}}"
    assert delete_path in paths
    assert "delete" in paths[delete_path]


def test_live_channel_members_crud(auth_context: dict):
    require_py4_server()
    ws = auth_context["workspace_id"]
    token = auth_context["token"]
    headers = {"Authorization": f"Bearer {token}"}

    channels = httpx.get(
        f"{API_BASE}/api/v1/workspaces/{ws}/chat/channels",
        headers=headers,
        timeout=60,
    )
    assert channels.status_code == 200
    items = channels.json()["data"]
    if not items:
        pytest.skip("No channels in workspace")

    channel_id = items[0]["id"]
    list_res = httpx.get(
        f"{API_BASE}/api/v1/workspaces/{ws}/chat/channels/{channel_id}/members",
        headers=headers,
        timeout=60,
    )
    assert list_res.status_code == 200, list_res.text
    members = list_res.json()["data"]
    assert isinstance(members, list)
    if members:
        assert "fullName" in members[0]
        assert "isFollowing" in members[0]
