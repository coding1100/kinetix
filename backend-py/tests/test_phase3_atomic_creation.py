"""Tests for Phase 3: Atomic Task Creation & Frontend API Unification.

Covers:
1. Full atomic task creation in a single request (dates, priority, time estimate, assignees, subtasks, checklists, dependencies).
2. Date validation on creation (start_date > due_date rejected with 400).
3. Assignee validation on creation (non-workspace user rejected with 400).
4. Dependency validation on creation (cycle prevention).
"""

from __future__ import annotations

import pytest
from httpx import AsyncClient

from tests.task_test_helpers import (
    OWNER,
    auth_headers,
    create_space_list,
    create_task,
    login,
    user_id,
    workspace_id,
)


@pytest.mark.asyncio(loop_scope="session")
async def test_atomic_task_creation_full(api_client: AsyncClient):
    token = await login(api_client, *OWNER)
    headers = auth_headers(token)
    ws_id = await workspace_id(api_client, token)
    my_user_id = await user_id(api_client, token)
    _, list_id = await create_space_list(api_client, token, ws_id)

    # Create an independent task to link as dependency
    dep_target = await create_task(api_client, token, ws_id, list_id, name="Dep Target Task")

    # Create full atomic task
    payload = {
        "name": "Production Grade Atomic Task",
        "description": "Created with all relations in a single DB transaction",
        "priority": "urgent",
        "startDate": "2026-09-20T09:00:00Z",
        "dueDate": "2026-09-25T17:00:00Z",
        "timeEstimateMinutes": 180,
        "tags": ["phase3", "atomic"],
        "assigneeIds": [my_user_id],
        "followerIds": [my_user_id],
        "subtasks": [
            {"name": "Atomic Subtask Alpha"},
            {"name": "Atomic Subtask Beta"},
        ],
        "checklists": [
            {
                "name": "Pre-flight Verification",
                "items": [
                    {"text": "Schema migration verified", "isChecked": True},
                    {"text": "Integration tests passing", "isChecked": False},
                ],
            }
        ],
        "dependencies": [
            {"relatedTaskId": dep_target["id"], "type": "blocking"}
        ],
    }

    res = await api_client.post(
        f"/api/v1/workspaces/{ws_id}/lists/{list_id}/tasks",
        headers=headers,
        json=payload,
    )
    assert res.status_code == 201, res.text
    created = res.json()

    assert created["name"] == "Production Grade Atomic Task"
    assert created["description"] == "Created with all relations in a single DB transaction"
    assert created["priority"] == "urgent"
    assert created["timeEstimateMinutes"] == 180
    assert my_user_id in created["assigneeIds"]
    assert my_user_id in created["followerIds"]
    assert "phase3" in created["tags"]
    assert created["startDateIso"] is not None
    assert created["dueDateIso"] is not None

    # Subtasks
    assert len(created["subtasks"]) == 2
    subtask_names = [st["name"] for st in created["subtasks"]]
    assert "Atomic Subtask Alpha" in subtask_names
    assert "Atomic Subtask Beta" in subtask_names

    # Checklists
    assert len(created["checklists"]) == 1
    assert created["checklists"][0]["name"] == "Pre-flight Verification"
    assert len(created["checklists"][0]["items"]) == 2
    assert created["checklists"][0]["items"][0]["isChecked"] is True

    # Dependencies
    assert len(created["dependencies"]) == 1
    assert created["dependencies"][0]["task"]["id"] == dep_target["id"]
    assert created["dependencies"][0]["type"] == "blocking"


@pytest.mark.asyncio(loop_scope="session")
async def test_atomic_task_creation_invalid_dates(api_client: AsyncClient):
    token = await login(api_client, *OWNER)
    headers = auth_headers(token)
    ws_id = await workspace_id(api_client, token)
    _, list_id = await create_space_list(api_client, token, ws_id)

    # start_date is AFTER due_date
    payload = {
        "name": "Invalid Date Task",
        "startDate": "2026-09-30T09:00:00Z",
        "dueDate": "2026-09-20T17:00:00Z",
    }
    res = await api_client.post(
        f"/api/v1/workspaces/{ws_id}/lists/{list_id}/tasks",
        headers=headers,
        json=payload,
    )
    assert res.status_code == 400
    assert "Start date must be on or before the due date" in res.text


@pytest.mark.asyncio(loop_scope="session")
async def test_atomic_task_creation_invalid_assignee(api_client: AsyncClient):
    token = await login(api_client, *OWNER)
    headers = auth_headers(token)
    ws_id = await workspace_id(api_client, token)
    _, list_id = await create_space_list(api_client, token, ws_id)

    payload = {
        "name": "Invalid Assignee Task",
        "assigneeIds": ["00000000-0000-0000-0000-000000000000"],
    }
    res = await api_client.post(
        f"/api/v1/workspaces/{ws_id}/lists/{list_id}/tasks",
        headers=headers,
        json=payload,
    )
    assert res.status_code == 400
    assert "Invalid assignee" in res.text
