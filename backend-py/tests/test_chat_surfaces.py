"""Chat canvas and huddle API contract."""

import httpx
import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app
from tests.conftest import API_BASE, require_py4_server


@pytest.mark.asyncio
async def test_openapi_canvas_and_huddle_routes_registered():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get("/openapi.json")
    assert res.status_code == 200
    paths = res.json()["paths"]
    base = "/api/v1/workspaces/{workspace_id}/chat/channels/{channel_id}"
    assert f"{base}/canvas" in paths
    assert f"{base}/huddles" in paths
    assert f"{base}/huddles/start" in paths


def test_live_channel_huddle_lifecycle(auth_context: dict):
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
        pytest.skip("No seeded channels")

    channel_id = items[0]["id"]
    start = httpx.post(
        f"{API_BASE}/api/v1/workspaces/{ws}/chat/channels/{channel_id}/huddles/start",
        headers=headers,
        json={"title": "Test huddle", "notes": "Created by automated tests"},
        timeout=60,
    )
    assert start.status_code == 201, start.text
    huddle = start.json()
    assert huddle["isActive"] is True
    assert huddle["participantCount"] >= 1
    huddle_id = huddle["id"]

    current = httpx.get(
        f"{API_BASE}/api/v1/workspaces/{ws}/chat/channels/{channel_id}/huddles",
        headers=headers,
        timeout=60,
    )
    assert current.status_code == 200, current.text
    current_body = current.json()
    assert current_body["current"]["id"] == huddle_id

    end = httpx.post(
        f"{API_BASE}/api/v1/workspaces/{ws}/chat/channels/{channel_id}/huddles/{huddle_id}/end",
        headers=headers,
        timeout=60,
    )
    assert end.status_code == 200, end.text
    assert end.json()["isActive"] is False


def test_live_channel_canvas_save_and_conflict(auth_context: dict):
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
        pytest.skip("No seeded channels")

    channel_id = items[0]["id"]
    url = f"{API_BASE}/api/v1/workspaces/{ws}/chat/channels/{channel_id}/canvas"
    original_response = httpx.get(url, headers=headers, timeout=60)
    assert original_response.status_code == 200, original_response.text
    original = original_response.json()

    saved_response = httpx.put(
        url,
        headers=headers,
        json={
            "title": "Canvas integration test",
            "body": "# Saved\n- autosave contract",
            "expectedRevision": original["revision"],
        },
        timeout=60,
    )
    assert saved_response.status_code == 200, saved_response.text
    saved = saved_response.json()
    assert saved["revision"] == original["revision"] + 1
    assert saved["updatedById"]

    stale_response = httpx.put(
        url,
        headers=headers,
        json={
            "title": "Stale update",
            "body": "must not win",
            "expectedRevision": original["revision"],
        },
        timeout=60,
    )
    assert stale_response.status_code == 409, stale_response.text
    assert stale_response.json()["error"]["code"] == "CANVAS_CONFLICT"

    restored_response = httpx.put(
        url,
        headers=headers,
        json={
            "title": original["title"],
            "body": original["body"],
            "expectedRevision": saved["revision"],
        },
        timeout=60,
    )
    assert restored_response.status_code == 200, restored_response.text
