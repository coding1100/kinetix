"""Per-member time estimate / time tracking visibility toggle (ClickUp's
Guest/Limited Member "individual permissions")."""

from __future__ import annotations

import time
import pytest
from httpx import AsyncClient

from tests.task_test_helpers import (
    MEMBER,
    OWNER,
    auth_headers,
    create_space_list,
    create_task,
    login,
    user_id,
    workspace_id,
)


@pytest.mark.asyncio(loop_scope="session")
async def test_time_permission_toggle_blocks_and_restores(api_client: AsyncClient):
    owner_token = await login(api_client, *OWNER)
    owner_headers = auth_headers(owner_token)
    member_token = await login(api_client, *MEMBER)
    member_headers = auth_headers(member_token)
    ws_id = await workspace_id(api_client, owner_token)
    member_user_id = await user_id(api_client, member_token)

    suffix = int(time.time() * 1000)
    space = await api_client.post(
        f"/api/v1/workspaces/{ws_id}/spaces",
        headers=owner_headers,
        json={"name": f"Time Space {suffix}"},
    )
    assert space.status_code == 201, space.text
    space_id = space.json()["id"]

    add_mem = await api_client.post(
        f"/api/v1/workspaces/{ws_id}/spaces/{space_id}/members",
        headers=owner_headers,
        json={"userId": member_user_id, "permissionLevel": "EDIT"},
    )
    assert add_mem.status_code in (200, 201), add_mem.text

    lst = await api_client.post(
        f"/api/v1/workspaces/{ws_id}/spaces/{space_id}/lists",
        headers=owner_headers,
        json={"name": "Time List"},
    )
    assert lst.status_code == 201, lst.text
    list_id = lst.json()["id"]

    res = await api_client.post(
        f"/api/v1/workspaces/{ws_id}/lists/{list_id}/tasks",
        headers=owner_headers,
        json={"name": "Time permission test task", "assigneeIds": [member_user_id]},
    )
    assert res.status_code == 201, res.text
    task = res.json()
    task_id = task["id"]

    try:
        off = await api_client.patch(
            f"/api/v1/workspaces/{ws_id}/members/{member_user_id}/permissions",
            headers=owner_headers,
            json={"canSeeTimeEstimate": False, "canTrackTime": False},
        )
        assert off.status_code == 200, off.text
        assert off.json() == {
            "ok": True,
            "userId": member_user_id,
            "canSeeTimeEstimate": False,
            "canTrackTime": False,
        }

        blocked_estimate = await api_client.patch(
            f"/api/v1/workspaces/{ws_id}/tasks/{task_id}",
            headers=member_headers,
            json={"timeEstimateMinutes": 60},
        )
        assert blocked_estimate.status_code == 403, blocked_estimate.text

        blocked_start = await api_client.post(
            f"/api/v1/workspaces/{ws_id}/tasks/{task_id}/time/start",
            headers=member_headers,
        )
        assert blocked_start.status_code == 403, blocked_start.text

        on = await api_client.patch(
            f"/api/v1/workspaces/{ws_id}/members/{member_user_id}/permissions",
            headers=owner_headers,
            json={"canSeeTimeEstimate": True, "canTrackTime": True},
        )
        assert on.status_code == 200, on.text

        allowed_estimate = await api_client.patch(
            f"/api/v1/workspaces/{ws_id}/tasks/{task_id}",
            headers=member_headers,
            json={"timeEstimateMinutes": 60},
        )
        assert allowed_estimate.status_code == 200, allowed_estimate.text

        allowed_start = await api_client.post(
            f"/api/v1/workspaces/{ws_id}/tasks/{task_id}/time/start",
            headers=member_headers,
        )
        assert allowed_start.status_code == 200, allowed_start.text
        await api_client.post(
            f"/api/v1/workspaces/{ws_id}/tasks/{task_id}/time/stop",
            headers=member_headers,
        )
    finally:
        await api_client.patch(
            f"/api/v1/workspaces/{ws_id}/members/{member_user_id}/permissions",
            headers=owner_headers,
            json={"canSeeTimeEstimate": True, "canTrackTime": True},
        )
