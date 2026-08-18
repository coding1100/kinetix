"""Unit tests for production-grade planning features: Templates, Portfolios, Gantt, Workload, Automations, Whiteboards."""

from __future__ import annotations

import pytest
from httpx import AsyncClient

from tests.task_test_helpers import (
    OWNER,
    auth_headers,
    create_space_list,
    create_task,
    login,
    workspace_id,
)


@pytest.mark.asyncio(loop_scope="session")
async def test_templates_flow(api_client: AsyncClient):
    token = await login(api_client, *OWNER)
    headers = auth_headers(token)
    ws_id = await workspace_id(api_client, token)

    # 1. Create a task template
    create_res = await api_client.post(
        f"/api/v1/workspaces/{ws_id}/templates",
        headers=headers,
        json={
            "name": "Sprint Bug Template",
            "scope": "TASK",
            "category": "Engineering",
            "templateData": {
                "description": "Standard bug report",
                "priority": "HIGH",
                "tags": ["bug", "triage"],
            },
        },
    )
    assert create_res.status_code == 200, create_res.text
    t_id = create_res.json()["id"]

    # 2. List templates
    list_res = await api_client.get(
        f"/api/v1/workspaces/{ws_id}/templates?scope=TASK",
        headers=headers,
    )
    assert list_res.status_code == 200, list_res.text
    assert any(t["id"] == t_id for t in list_res.json())

    # 3. Instantiate template into a task
    _, list_id = await create_space_list(api_client, token, ws_id)
    inst_res = await api_client.post(
        f"/api/v1/workspaces/{ws_id}/templates/{t_id}/instantiate",
        headers=headers,
        json={"listId": list_id, "name": "Instantiated Bug Task"},
    )
    assert inst_res.status_code == 200, inst_res.text
    inst_body = inst_res.json()
    assert inst_body["name"] == "Instantiated Bug Task"
    assert inst_body["listId"] == list_id


@pytest.mark.asyncio(loop_scope="session")
async def test_portfolios_flow(api_client: AsyncClient):
    token = await login(api_client, *OWNER)
    headers = auth_headers(token)
    ws_id = await workspace_id(api_client, token)
    _, list_id = await create_space_list(api_client, token, ws_id)

    # 1. Create Portfolio
    port_res = await api_client.post(
        f"/api/v1/workspaces/{ws_id}/portfolios",
        headers=headers,
        json={
            "name": "Q3 Core Initiatives",
            "description": "High level tracking",
            "color": "#00FF00",
            "listIds": [list_id],
        },
    )
    assert port_res.status_code == 200, port_res.text
    p_id = port_res.json()["id"]

    # 2. Get Portfolio Summary
    sum_res = await api_client.get(
        f"/api/v1/workspaces/{ws_id}/portfolios/{p_id}/summary",
        headers=headers,
    )
    assert sum_res.status_code == 200, sum_res.text
    body = sum_res.json()
    assert body["name"] == "Q3 Core Initiatives"
    assert body["totalLists"] == 1
    assert "statusHealth" in body


@pytest.mark.asyncio(loop_scope="session")
async def test_gantt_and_workload_endpoints(api_client: AsyncClient):
    token = await login(api_client, *OWNER)
    headers = auth_headers(token)
    ws_id = await workspace_id(api_client, token)

    # Gantt endpoint
    gantt_res = await api_client.get(
        f"/api/v1/workspaces/{ws_id}/planning/gantt",
        headers=headers,
    )
    assert gantt_res.status_code == 200, gantt_res.text
    assert "tasks" in gantt_res.json()
    assert "dependencies" in gantt_res.json()

    # Workload endpoint
    wl_res = await api_client.get(
        f"/api/v1/workspaces/{ws_id}/planning/workload",
        headers=headers,
    )
    assert wl_res.status_code == 200, wl_res.text
    assert isinstance(wl_res.json(), list)


@pytest.mark.asyncio(loop_scope="session")
async def test_automations_and_whiteboards(api_client: AsyncClient):
    token = await login(api_client, *OWNER)
    headers = auth_headers(token)
    ws_id = await workspace_id(api_client, token)

    # 1. Automations
    auto_res = await api_client.post(
        f"/api/v1/workspaces/{ws_id}/automations",
        headers=headers,
        json={
            "name": "Auto Assign Lead",
            "triggerType": "STATUS_CHANGED",
            "triggerConfig": {"targetStatus": "DONE"},
            "actionType": "ADD_TAG",
            "actionConfig": {"tag": "completed"},
        },
    )
    assert auto_res.status_code == 200, auto_res.text

    # 2. Whiteboards
    wb_res = await api_client.post(
        f"/api/v1/workspaces/{ws_id}/whiteboards",
        headers=headers,
        json={
            "name": "Architecture Mindmap",
            "canvasData": {"nodes": [{"id": "1", "label": "API"}], "edges": []},
        },
    )
    assert wb_res.status_code == 200, wb_res.text
    wb_id = wb_res.json()["id"]

    # Patch whiteboard
    wb_patch = await api_client.patch(
        f"/api/v1/workspaces/{ws_id}/whiteboards/{wb_id}",
        headers=headers,
        json={"name": "Updated Architecture Mindmap"},
    )
    assert wb_patch.status_code == 200, wb_patch.text
    assert wb_patch.json()["name"] == "Updated Architecture Mindmap"
