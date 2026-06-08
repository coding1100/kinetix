"""Chat API contract and integration tests (requires PY-4 server on port 4001)."""

import httpx
import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app
from tests.conftest import API_BASE, require_py4_server


@pytest.mark.asyncio
async def test_openapi_chat_routes_registered():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get("/openapi.json")
    assert res.status_code == 200
    paths = res.json()["paths"]
    assert "/api/v1/workspaces/{workspace_id}/chat/channels" in paths
    assert (
        "/api/v1/workspaces/{workspace_id}/chat/channels/{channel_id}/members"
        in paths
    )
    assert "/api/v1/workspaces/{workspace_id}/chat/dms" in paths


def test_live_health_phase_py4():
    require_py4_server()
    res = httpx.get(f"{API_BASE}/health", timeout=10)
    assert res.status_code == 200
    body = res.json()
    assert body["runtime"] == "fastapi"
    assert "PY-5" in body["phase"] or "PY-4" in body["phase"]


def test_live_list_channels(auth_context: dict):
    ws = auth_context["workspace_id"]
    token = auth_context["token"]
    res = httpx.get(
        f"{API_BASE}/api/v1/workspaces/{ws}/chat/channels",
        headers={"Authorization": f"Bearer {token}"},
        timeout=60,
    )
    assert res.status_code == 200, res.text
    data = res.json()["data"]
    assert isinstance(data, list)
    if data:
        assert "name" in data[0]
        assert "unread" in data[0]


def test_live_list_dms(auth_context: dict):
    ws = auth_context["workspace_id"]
    token = auth_context["token"]
    res = httpx.get(
        f"{API_BASE}/api/v1/workspaces/{ws}/chat/dms",
        headers={"Authorization": f"Bearer {token}"},
        timeout=60,
    )
    assert res.status_code == 200, res.text
    data = res.json()["data"]
    assert isinstance(data, list)
    if data:
        assert "name" in data[0]
        assert "isGroup" in data[0]


def test_live_channel_messages(auth_context: dict):
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
        pytest.skip("No seeded channels")
    channel_id = items[0]["id"]
    res = httpx.get(
        f"{API_BASE}/api/v1/workspaces/{ws}/chat/channels/{channel_id}/messages",
        headers=headers,
        timeout=60,
    )
    assert res.status_code == 200, res.text
    assert "data" in res.json()
