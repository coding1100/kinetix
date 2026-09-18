import json
import uuid
import pytest
from httpx import AsyncClient

from app.mcp.server import mcp
from app.mcp.auth import get_mcp_db_session

OWNER = ("owner@demo.com", "password123")


async def _login(client: AsyncClient, email: str, password: str) -> str:
    res = await client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": password},
    )
    if res.status_code != 200:
        res = await client.post(
            "/api/v1/auth/login",
            json={"email": email, "password": "Password123!"},
        )
    assert res.status_code == 200, res.text
    return res.json()["accessToken"]


def _auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


@pytest.mark.asyncio(loop_scope="session")
async def test_mcp_context_resolution(api_client: AsyncClient):
    token = await _login(api_client, *OWNER)

    async with get_mcp_db_session(api_key_or_token=token) as (session, ctx):
        assert ctx.user_email == "owner@demo.com"
        assert ctx.workspace_id is not None
        assert ctx.role is not None


@pytest.mark.asyncio(loop_scope="session")
async def test_mcp_workspace_structure_tool(api_client: AsyncClient, monkeypatch: pytest.MonkeyPatch):
    token = await _login(api_client, *OWNER)
    monkeypatch.setenv("KINETIX_API_KEY", token)

    # Call tool via FastMCP
    res = await mcp.call_tool("kinetix_get_workspace_structure", {})
    assert not res.is_error

    # Parse output
    text_content = res.content[0].text
    data = json.loads(text_content)
    assert "workspace" in data
    assert "spaces" in data
    assert isinstance(data["spaces"], list)


@pytest.mark.asyncio(loop_scope="session")
async def test_mcp_task_lifecycle_and_resources(api_client: AsyncClient, monkeypatch: pytest.MonkeyPatch):
    token = await _login(api_client, *OWNER)
    monkeypatch.setenv("KINETIX_API_KEY", token)
    headers = _auth(token)

    # Get workspace ID
    me = await api_client.get("/api/v1/auth/me", headers=headers)
    assert me.status_code == 200
    workspace_id = me.json()["workspaces"][0]["id"]

    # Create a test space and list
    suffix = str(uuid.uuid4())[:8]
    space_res = await api_client.post(
        f"/api/v1/workspaces/{workspace_id}/spaces",
        headers=headers,
        json={"name": f"MCP Test Space {suffix}"},
    )
    assert space_res.status_code == 201
    space_id = space_res.json()["id"]

    list_res = await api_client.post(
        f"/api/v1/workspaces/{workspace_id}/spaces/{space_id}/lists",
        headers=headers,
        json={"name": "MCP Tool Tasks"},
    )
    assert list_res.status_code == 201
    list_id = list_res.json()["id"]

    # 1. Create task via MCP tool
    task_title = f"AI Automated Task {suffix}"
    create_res = await mcp.call_tool(
        "kinetix_create_task",
        {
            "title": task_title,
            "list_id": list_id,
            "description": "Generated via Claude MCP protocol.",
            "priority": "high",
        },
    )
    assert not create_res.is_error
    created_data = json.loads(create_res.content[0].text)
    task_id = created_data["id"]
    assert created_data["name"] == task_title
    assert created_data["priority"].upper() == "HIGH"

    # 2. List tasks via MCP tool
    list_tasks_res = await mcp.call_tool(
        "kinetix_list_tasks",
        {"list_id": list_id},
    )
    assert not list_tasks_res.is_error
    tasks_data = json.loads(list_tasks_res.content[0].text)
    assert any(t["id"] == task_id for t in tasks_data["tasks"])

    # 3. Get task details via MCP tool
    get_task_res = await mcp.call_tool(
        "kinetix_get_task",
        {"task_id": task_id},
    )
    assert not get_task_res.is_error
    task_details = json.loads(get_task_res.content[0].text)
    assert task_details["id"] == task_id
    assert task_details["description"] == "Generated via Claude MCP protocol."

    # 4. Read workspace structure resource
    ws_resource = await mcp.read_resource("kinetix://workspace/structure")
    assert len(ws_resource.contents) > 0
    assert "Workspace:" in ws_resource.contents[0].content

    # 5. Read task detail resource
    task_resource = await mcp.read_resource(f"kinetix://tasks/{task_id}")
    assert len(task_resource.contents) > 0
    assert task_title in task_resource.contents[0].content
    assert "Generated via Claude MCP protocol." in task_resource.contents[0].content
