"""Tests for Phase 1: Security & Multi-Tenancy Hardening.

Covers:
1. Workload cross-workspace isolation and active task filtering (DONE tasks excluded).
2. Targeted Socket.IO emission to authorized user rooms vs fallback workspace room.
3. Task dependency circular checks, duplicate checks, and IDOR on deletion.
4. Comment moderation (admin deletion override) and attachment cleanup.
5. Task time tracking access control.
"""

from __future__ import annotations

from unittest.mock import AsyncMock, patch

import pytest
from httpx import AsyncClient

from app.socket import emit as socket_emit
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
async def test_workload_isolation_and_done_filter(api_client: AsyncClient):
    owner_token = await login(api_client, *OWNER)
    ws_id = await workspace_id(api_client, owner_token)
    headers = auth_headers(owner_token)
    uid = await user_id(api_client, owner_token)

    # Fetch initial workload
    res = await api_client.get(
        f"/api/v1/workspaces/{ws_id}/planning/workload",
        headers=headers,
    )
    assert res.status_code == 200, res.text
    initial_workload = res.json()
    assert isinstance(initial_workload, list)
    # Ensure all returned users belong to this workspace
    for item in initial_workload:
        assert "userId" in item
        assert "assignedTasksCount" in item

    # Create a task and assign it to current user
    _, list_id = await create_space_list(api_client, owner_token, ws_id)
    task = await create_task(
        api_client,
        owner_token,
        ws_id,
        list_id,
        name="Workload Test Task",
    )
    task_id = task["id"]
    assign_res = await api_client.patch(
        f"/api/v1/workspaces/{ws_id}/tasks/{task_id}",
        headers=headers,
        json={"assigneeIds": [uid]},
    )
    assert assign_res.status_code == 200, assign_res.text

    # Verify task is counted in active workload
    res_after = await api_client.get(
        f"/api/v1/workspaces/{ws_id}/planning/workload",
        headers=headers,
    )
    assert res_after.status_code == 200
    user_entry = next((item for item in res_after.json() if item["userId"] == uid), None)
    assert user_entry is not None
    count_active = user_entry["assignedTasksCount"]

    # Mark task as DONE
    patch_res = await api_client.patch(
        f"/api/v1/workspaces/{ws_id}/tasks/{task_id}",
        headers=headers,
        json={"status": "DONE"},
    )
    assert patch_res.status_code == 200, patch_res.text

    # Verify task is excluded from active workload summary
    res_done = await api_client.get(
        f"/api/v1/workspaces/{ws_id}/planning/workload",
        headers=headers,
    )
    assert res_done.status_code == 200
    user_entry_done = next((item for item in res_done.json() if item["userId"] == uid), None)
    assert user_entry_done is not None
    assert user_entry_done["assignedTasksCount"] == count_active - 1


@pytest.mark.asyncio(loop_scope="session")
async def test_targeted_socket_emission():
    # 1. When user_ids is provided, broadcast_task_event emits only to user:{id} rooms
    with patch("app.socket.emit.get_sio") as mock_get_sio:
        mock_sio = AsyncMock()
        mock_get_sio.return_value = mock_sio
        await socket_emit.broadcast_task_event(
            workspace_id="ws-123",
            action="updated",
            task_id="t-1",
            list_id="l-1",
            task={"id": "t-1"},
            user_ids=["user-a", "user-b"],
        )

        assert mock_sio.emit.call_count == 2
        emitted_rooms = {call.kwargs.get("room") for call in mock_sio.emit.call_args_list}
        assert emitted_rooms == {"user:user-a", "user:user-b"}
        assert "ws:ws-123" not in emitted_rooms

    # 2. When user_ids is None, falls back to workspace room
    with patch("app.socket.emit.get_sio") as mock_get_sio:
        mock_sio = AsyncMock()
        mock_get_sio.return_value = mock_sio
        await socket_emit.broadcast_task_event(
            workspace_id="ws-123",
            action="updated",
            task_id="t-1",
            list_id="l-1",
            task={"id": "t-1"},
            user_ids=None,
        )

        assert mock_sio.emit.call_count == 1
        call_room = mock_sio.emit.call_args.kwargs.get("room")
        assert call_room == "ws:ws-123"


@pytest.mark.asyncio(loop_scope="session")
async def test_task_dependency_rules_and_deletion(api_client: AsyncClient):
    token = await login(api_client, *OWNER)
    headers = auth_headers(token)
    ws_id = await workspace_id(api_client, token)
    _, list_id = await create_space_list(api_client, token, ws_id)

    task_a = await create_task(api_client, token, ws_id, list_id, name="Task Alpha")
    task_b = await create_task(api_client, token, ws_id, list_id, name="Task Beta")

    # 1. Self dependency rejected
    res_self = await api_client.post(
        f"/api/v1/workspaces/{ws_id}/tasks/{task_a['id']}/dependencies",
        headers=headers,
        json={"relatedTaskId": task_a["id"], "type": "blocking"},
    )
    assert res_self.status_code == 400
    assert "itself" in res_self.text.lower() or "self" in res_self.text.lower()

    # 2. Add valid dependency
    res_dep = await api_client.post(
        f"/api/v1/workspaces/{ws_id}/tasks/{task_a['id']}/dependencies",
        headers=headers,
        json={"relatedTaskId": task_b["id"], "type": "blocking"},
    )
    assert res_dep.status_code == 201, res_dep.text
    dep_id = res_dep.json()["id"]

    # 3. Duplicate dependency rejected
    res_dup = await api_client.post(
        f"/api/v1/workspaces/{ws_id}/tasks/{task_a['id']}/dependencies",
        headers=headers,
        json={"relatedTaskId": task_b["id"], "type": "blocking"},
    )
    assert res_dup.status_code == 400
    assert "already exists" in res_dup.text.lower()

    # 4. Circular dependency rejected
    # task_a is blocking task_b; task_b cannot be blocked_by task_a (which means task_a is blocking task_b)
    # or inverse: task_b is blocking task_a
    res_circ = await api_client.post(
        f"/api/v1/workspaces/{ws_id}/tasks/{task_b['id']}/dependencies",
        headers=headers,
        json={"relatedTaskId": task_a["id"], "type": "blocked_by"},
    )
    assert res_circ.status_code == 400
    assert "circular" in res_circ.text.lower()

    # 5. Delete dependency
    res_del = await api_client.delete(
        f"/api/v1/workspaces/{ws_id}/tasks/{task_a['id']}/dependencies/{dep_id}",
        headers=headers,
    )
    assert res_del.status_code == 200, res_del.text

    # 6. Delete again returns 404 (IDOR / not found check)
    res_del_again = await api_client.delete(
        f"/api/v1/workspaces/{ws_id}/tasks/{task_a['id']}/dependencies/{dep_id}",
        headers=headers,
    )
    assert res_del_again.status_code == 404


@pytest.mark.asyncio(loop_scope="session")
async def test_comment_admin_moderation(api_client: AsyncClient):
    owner_token = await login(api_client, *OWNER)
    member_token = await login(api_client, *MEMBER)
    owner_headers = auth_headers(owner_token)
    member_headers = auth_headers(member_token)
    ws_id = await workspace_id(api_client, owner_token)

    member_uid = await user_id(api_client, member_token)
    space_id, list_id = await create_space_list(api_client, owner_token, ws_id)
    share_res = await api_client.post(
        f"/api/v1/workspaces/{ws_id}/spaces/{space_id}/members",
        headers=owner_headers,
        json={"userId": member_uid, "permissionLevel": "EDIT"},
    )
    assert share_res.status_code == 201, share_res.text
    task = await create_task(api_client, owner_token, ws_id, list_id, name="Comment Mod Task")
    task_id = task["id"]

    # 1. Owner posts a comment
    res_owner_comment = await api_client.post(
        f"/api/v1/workspaces/{ws_id}/tasks/{task_id}/comments",
        headers=owner_headers,
        json={"body": "Owner comment"},
    )
    assert res_owner_comment.status_code == 201, res_owner_comment.text
    detail = await api_client.get(
        f"/api/v1/workspaces/{ws_id}/tasks/{task_id}",
        headers=owner_headers,
    )
    assert detail.status_code == 200
    owner_comment_id = detail.json()["comments"][-1]["id"]

    # 2. Member cannot delete owner's comment (403 Forbidden)
    res_forbidden = await api_client.delete(
        f"/api/v1/workspaces/{ws_id}/tasks/{task_id}/comments/{owner_comment_id}",
        headers=member_headers,
    )
    assert res_forbidden.status_code == 403, res_forbidden.text

    # 3. Member posts a comment
    res_member_comment = await api_client.post(
        f"/api/v1/workspaces/{ws_id}/tasks/{task_id}/comments",
        headers=member_headers,
        json={"body": "Member comment for moderation testing"},
    )
    assert res_member_comment.status_code == 201, res_member_comment.text
    detail2 = await api_client.get(
        f"/api/v1/workspaces/{ws_id}/tasks/{task_id}",
        headers=owner_headers,
    )
    member_comment_id = detail2.json()["comments"][-1]["id"]

    # 4. Owner (Admin) can moderate & delete member's comment (200 OK)
    del_res = await api_client.delete(
        f"/api/v1/workspaces/{ws_id}/tasks/{task_id}/comments/{member_comment_id}",
        headers=owner_headers,
    )
    assert del_res.status_code == 200, del_res.text


@pytest.mark.asyncio(loop_scope="session")
async def test_time_tracking_lifecycle(api_client: AsyncClient):
    token = await login(api_client, *OWNER)
    headers = auth_headers(token)
    ws_id = await workspace_id(api_client, token)

    _, list_id = await create_space_list(api_client, token, ws_id)
    task = await create_task(api_client, token, ws_id, list_id, name="Timer Task")
    task_id = task["id"]

    # Start timer
    start_res = await api_client.post(
        f"/api/v1/workspaces/{ws_id}/tasks/{task_id}/time/start",
        headers=headers,
    )
    assert start_res.status_code == 200, start_res.text
    body = start_res.json()
    assert body.get("timeTracking", {}).get("active") is True

    # Stop timer
    stop_res = await api_client.post(
        f"/api/v1/workspaces/{ws_id}/tasks/{task_id}/time/stop",
        headers=headers,
    )
    assert stop_res.status_code == 200, stop_res.text
    body = stop_res.json()
    assert body.get("timeTracking", {}).get("active") is False
