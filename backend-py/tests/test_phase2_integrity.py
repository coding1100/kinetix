"""Tests for Phase 2: Data Integrity & Status Consistency.

Covers:
1. Task move across lists: destination list permission checks, status remapping, subtask migration.
2. Status synchronization: ensuring Task.status reflects StatusGroup.DONE.
3. Status customization: graceful remapping within the same status group instead of silent wipe to TODO.
4. Multi-hop transitive dependency cycle prevention.
"""

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
async def test_transitive_dependency_cycle_prevention(api_client: AsyncClient):
    token = await login(api_client, *OWNER)
    headers = auth_headers(token)
    ws_id = await workspace_id(api_client, token)
    _, list_id = await create_space_list(api_client, token, ws_id)

    task_a = await create_task(api_client, token, ws_id, list_id, name="Chain A")
    task_b = await create_task(api_client, token, ws_id, list_id, name="Chain B")
    task_c = await create_task(api_client, token, ws_id, list_id, name="Chain C")

    # 1. Chain: A blocks B
    res_ab = await api_client.post(
        f"/api/v1/workspaces/{ws_id}/tasks/{task_a['id']}/dependencies",
        headers=headers,
        json={"relatedTaskId": task_b["id"], "type": "blocking"},
    )
    assert res_ab.status_code == 201, res_ab.text

    # 2. Chain: B blocks C
    res_bc = await api_client.post(
        f"/api/v1/workspaces/{ws_id}/tasks/{task_b['id']}/dependencies",
        headers=headers,
        json={"relatedTaskId": task_c["id"], "type": "blocking"},
    )
    assert res_bc.status_code == 201, res_bc.text

    # 3. Transitive Cycle: C blocks A must be rejected!
    res_ca = await api_client.post(
        f"/api/v1/workspaces/{ws_id}/tasks/{task_c['id']}/dependencies",
        headers=headers,
        json={"relatedTaskId": task_a["id"], "type": "blocking"},
    )
    assert res_ca.status_code == 400
    assert "circular" in res_ca.text.lower() or "cycle" in res_ca.text.lower()


@pytest.mark.asyncio(loop_scope="session")
async def test_task_move_across_lists_and_subtasks(api_client: AsyncClient):
    token = await login(api_client, *OWNER)
    headers = auth_headers(token)
    ws_id = await workspace_id(api_client, token)

    # Create Source and Destination lists
    _, src_list_id = await create_space_list(api_client, token, ws_id, list_name="Source List")
    _, dst_list_id = await create_space_list(api_client, token, ws_id, list_name="Dest List")

    # Create task with a subtask in source list
    task = await create_task(api_client, token, ws_id, src_list_id, name="Parent To Move")
    subtask_res = await api_client.post(
        f"/api/v1/workspaces/{ws_id}/tasks/{task['id']}/subtasks",
        headers=headers,
        json={"name": "Subtask To Follow"},
    )
    assert subtask_res.status_code == 201, subtask_res.text
    subtask_id = subtask_res.json()["id"]

    # Move parent task to destination list
    move_res = await api_client.patch(
        f"/api/v1/workspaces/{ws_id}/tasks/{task['id']}",
        headers=headers,
        json={"listId": dst_list_id},
    )
    assert move_res.status_code == 200, move_res.text
    moved_task = move_res.json()
    assert moved_task["listId"] == dst_list_id
    assert moved_task["statusId"] is not None

    # Verify destination list contains the statusId assigned to the moved task
    dst_list_res = await api_client.get(
        f"/api/v1/workspaces/{ws_id}/lists/{dst_list_id}",
        headers=headers,
    )
    assert dst_list_res.status_code == 200
    dst_statuses = {s["id"] for s in dst_list_res.json().get("statuses", [])}
    assert moved_task["statusId"] in dst_statuses

    # Verify subtask was also migrated to the destination list
    subtask_detail = await api_client.get(
        f"/api/v1/workspaces/{ws_id}/tasks/{subtask_id}",
        headers=headers,
    )
    assert subtask_detail.status_code == 200
    assert subtask_detail.json()["listId"] == dst_list_id


@pytest.mark.asyncio(loop_scope="session")
async def test_task_move_forbidden_without_target_permission(api_client: AsyncClient):
    owner_token = await login(api_client, *OWNER)
    member_token = await login(api_client, *MEMBER)
    owner_headers = auth_headers(owner_token)
    member_headers = auth_headers(member_token)
    ws_id = await workspace_id(api_client, owner_token)
    member_uid = await user_id(api_client, member_token)

    # 1. Create a space & list shared with member
    space_shared, list_shared = await create_space_list(api_client, owner_token, ws_id)
    await api_client.post(
        f"/api/v1/workspaces/{ws_id}/spaces/{space_shared}/members",
        headers=owner_headers,
        json={"userId": member_uid, "permissionLevel": "EDIT"},
    )
    task = await create_task(api_client, owner_token, ws_id, list_shared, name="Shared Task")

    # 2. Create a private space & list NOT shared with member
    space_private = await api_client.post(
        f"/api/v1/workspaces/{ws_id}/spaces",
        headers=owner_headers,
        json={"name": f"Strict Private Space {int(time.time() * 1000)}", "isPrivate": True},
    )
    assert space_private.status_code == 201
    private_space_id = space_private.json()["id"]
    private_list_res = await api_client.post(
        f"/api/v1/workspaces/{ws_id}/spaces/{private_space_id}/lists",
        headers=owner_headers,
        json={"name": "Confidential List"},
    )
    assert private_list_res.status_code == 201
    private_list_id = private_list_res.json()["id"]

    # 3. Member attempts to move task into the private list -> 403 Forbidden
    unauthorized_move = await api_client.patch(
        f"/api/v1/workspaces/{ws_id}/tasks/{task['id']}",
        headers=member_headers,
        json={"listId": private_list_id},
    )
    assert unauthorized_move.status_code == 403


@pytest.mark.asyncio(loop_scope="session")
async def test_status_customization_remapping(api_client: AsyncClient):
    token = await login(api_client, *OWNER)
    headers = auth_headers(token)
    ws_id = await workspace_id(api_client, token)

    _, list_id = await create_space_list(api_client, token, ws_id, list_name="Custom Status List")

    # Configure custom statuses: TO DO, In Progress, Review, Completed
    config_body = {
        "statusConfig": [
            {"name": "To Do", "color": "#d3d3d3", "statusGroup": "NOT_STARTED", "legacyKey": "TODO"},
            {"name": "In Progress", "color": "#3498db", "statusGroup": "ACTIVE", "legacyKey": "IN_PROGRESS"},
            {"name": "Review", "color": "#e67e22", "statusGroup": "ACTIVE"},
            {"name": "Completed", "color": "#2ecc71", "statusGroup": "DONE", "legacyKey": "DONE"},
        ]
    }
    update_cfg = await api_client.patch(
        f"/api/v1/workspaces/{ws_id}/lists/{list_id}",
        headers=headers,
        json=config_body,
    )
    assert update_cfg.status_code == 200, update_cfg.text
    list_detail = await api_client.get(
        f"/api/v1/workspaces/{ws_id}/lists/{list_id}",
        headers=headers,
    )
    assert list_detail.status_code == 200
    statuses = list_detail.json().get("statuses", [])
    review_status = next(s for s in statuses if s["name"] == "Review")

    # Create task and set status to "Review"
    task = await create_task(api_client, token, ws_id, list_id, name="Review Task")
    patch_res = await api_client.patch(
        f"/api/v1/workspaces/{ws_id}/tasks/{task['id']}",
        headers=headers,
        json={"statusId": review_status["id"]},
    )
    assert patch_res.status_code == 200
    assert patch_res.json()["statusId"] == review_status["id"]

    # Now modify status config to remove "Review" (keeping "In Progress" in ACTIVE)
    new_config = {
        "statusConfig": [
            {"name": "To Do", "color": "#d3d3d3", "statusGroup": "NOT_STARTED", "legacyKey": "TODO"},
            {"name": "In Progress", "color": "#3498db", "statusGroup": "ACTIVE", "legacyKey": "IN_PROGRESS"},
            {"name": "Completed", "color": "#2ecc71", "statusGroup": "DONE", "legacyKey": "DONE"},
        ]
    }
    update_cfg2 = await api_client.patch(
        f"/api/v1/workspaces/{ws_id}/lists/{list_id}",
        headers=headers,
        json=new_config,
    )
    assert update_cfg2.status_code == 200, update_cfg2.text
    list_detail2 = await api_client.get(
        f"/api/v1/workspaces/{ws_id}/lists/{list_id}",
        headers=headers,
    )
    assert list_detail2.status_code == 200
    in_progress_status = next(s for s in list_detail2.json()["statuses"] if s["name"] == "In Progress")

    # Verify task was gracefully remapped to "In Progress", NOT wiped to "To Do" or NULL!
    task_after = await api_client.get(
        f"/api/v1/workspaces/{ws_id}/tasks/{task['id']}",
        headers=headers,
    )
    assert task_after.status_code == 200
    assert task_after.json()["statusId"] == in_progress_status["id"]
    assert task_after.json()["statusKey"] == "IN_PROGRESS"


@pytest.mark.asyncio(loop_scope="session")
async def test_status_sync_to_done_status_group(api_client: AsyncClient):
    token = await login(api_client, *OWNER)
    headers = auth_headers(token)
    ws_id = await workspace_id(api_client, token)

    _, list_id = await create_space_list(api_client, token, ws_id)
    # Add custom DONE status named "Shipped"
    config = {
        "statusConfig": [
            {"name": "Open", "color": "#d3d3d3", "statusGroup": "NOT_STARTED", "legacyKey": "TODO"},
            {"name": "Shipped", "color": "#2ecc71", "statusGroup": "DONE"},
        ]
    }
    await api_client.patch(
        f"/api/v1/workspaces/{ws_id}/lists/{list_id}",
        headers=headers,
        json=config,
    )
    list_info = (await api_client.get(f"/api/v1/workspaces/{ws_id}/lists/{list_id}", headers=headers)).json()
    shipped_status = next(s for s in list_info["statuses"] if s["name"] == "Shipped")

    task = await create_task(api_client, token, ws_id, list_id, name="Shipping Task")
    # Patch statusId to Shipped
    patch_res = await api_client.patch(
        f"/api/v1/workspaces/{ws_id}/tasks/{task['id']}",
        headers=headers,
        json={"statusId": shipped_status["id"]},
    )
    assert patch_res.status_code == 200
    patched_task = patch_res.json()
    assert patched_task["statusId"] == shipped_status["id"]
    # TaskStatus must be synchronized to DONE
    assert patched_task["statusKey"] == "DONE"
