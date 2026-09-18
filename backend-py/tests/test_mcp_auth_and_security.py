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
async def test_unauthenticated_mcp_rejection(monkeypatch: pytest.MonkeyPatch):
    """Verifies that unauthenticated calls without any token are strictly rejected

    and do NOT fall back to any dev/admin user.
    """
    monkeypatch.delenv("KINETIX_API_KEY", raising=False)
    monkeypatch.delenv("KINETIX_USER_TOKEN", raising=False)
    monkeypatch.delenv("KINETIX_USER_EMAIL", raising=False)
    monkeypatch.delenv("KINETIX_USER_ID", raising=False)

    with pytest.raises(Exception) as exc_info:
        async with get_mcp_db_session() as (session, ctx):
            pass

    err_msg = str(exc_info.value)
    assert "UNAUTHORIZED" in err_msg or "Authentication required" in err_msg


@pytest.mark.asyncio(loop_scope="session")
async def test_personal_access_token_lifecycle_and_mcp_auth(
    api_client: AsyncClient, monkeypatch: pytest.MonkeyPatch
):
    """Tests generating a PAT, using it to authenticate MCP tools,

    and verifying that revoking the PAT terminates access.
    """
    jwt_token = await _login(api_client, *OWNER)
    headers = _auth(jwt_token)

    # 1. Generate PAT via REST API
    key_name = f"Test MCP Key {uuid.uuid4().hex[:6]}"
    create_res = await api_client.post(
        "/api/v1/auth/api-keys",
        headers=headers,
        json={"name": key_name, "expiresDays": 30},
    )
    assert create_res.status_code == 201, create_res.text
    key_data = create_res.json()
    pat_token = key_data["token"]
    key_id = key_data["id"]
    assert pat_token.startswith("knx_pat_")
    assert key_data["name"] == key_name

    # 2. List API keys and verify presence
    list_res = await api_client.get("/api/v1/auth/api-keys", headers=headers)
    assert list_res.status_code == 200
    listed_keys = list_res.json()["keys"]
    assert any(k["id"] == key_id for k in listed_keys)

    # 3. Use PAT in MCP tool invocation
    monkeypatch.setenv("KINETIX_API_KEY", pat_token)
    res = await mcp.call_tool("kinetix_get_workspace_structure", {})
    assert not res.is_error
    data = json.loads(res.content[0].text)
    assert "workspace" in data
    assert data["workspace"]["userRole"] == "OWNER"

    # 4. Revoke the PAT
    revoke_res = await api_client.delete(f"/api/v1/auth/api-keys/{key_id}", headers=headers)
    assert revoke_res.status_code == 200

    # 5. Verify revoked PAT is rejected
    with pytest.raises(Exception) as exc_info:
        async with get_mcp_db_session(api_key_or_token=pat_token) as (session, ctx):
            pass
    assert "UNAUTHORIZED" in str(exc_info.value) or "revoked" in str(exc_info.value).lower()


@pytest.mark.asyncio(loop_scope="session")
async def test_mcp_task_deletion_and_search(
    api_client: AsyncClient, monkeypatch: pytest.MonkeyPatch
):
    """Tests the new kinetix_delete_task tool and verifies kinetix_search does not fail on docs."""
    jwt_token = await _login(api_client, *OWNER)
    headers = _auth(jwt_token)
    monkeypatch.setenv("KINETIX_API_KEY", jwt_token)

    me = await api_client.get("/api/v1/auth/me", headers=headers)
    assert me.status_code == 200
    workspace_id = me.json()["workspaces"][0]["id"]

    suffix = str(uuid.uuid4())[:8]
    space_res = await api_client.post(
        f"/api/v1/workspaces/{workspace_id}/spaces",
        headers=headers,
        json={"name": f"Del Test Space {suffix}"},
    )
    assert space_res.status_code == 201
    space_id = space_res.json()["id"]

    list_res = await api_client.post(
        f"/api/v1/workspaces/{workspace_id}/spaces/{space_id}/lists",
        headers=headers,
        json={"name": "Del List"},
    )
    assert list_res.status_code == 201
    list_id = list_res.json()["id"]

    # 1. Create task
    create_res = await mcp.call_tool(
        "kinetix_create_task",
        {"title": f"Task to Delete {suffix}", "list_id": list_id},
    )
    assert not create_res.is_error
    task_id = json.loads(create_res.content[0].text)["id"]

    # 2. Add comment
    comment_res = await mcp.call_tool(
        "kinetix_add_task_comment",
        {"task_id": task_id, "content": "Comment to delete"},
    )
    assert not comment_res.is_error

    # 3. Test kinetix_search docs & tasks
    search_res = await mcp.call_tool(
        "kinetix_search",
        {"query": "Delete", "scope": "all"},
    )
    assert not search_res.is_error
    search_data = json.loads(search_res.content[0].text)
    assert "docs" in search_data
    assert search_data["docs"] is not None

    # 4. Delete the task via kinetix_delete_task
    del_res = await mcp.call_tool("kinetix_delete_task", {"task_id": task_id})
    assert not del_res.is_error
    del_data = json.loads(del_res.content[0].text)
    assert del_data["id"] == task_id

    # 5. Verify task is no longer retrievable
    with pytest.raises(Exception) as exc_info:
        await mcp.call_tool("kinetix_get_task", {"task_id": task_id})
    assert "NOT_FOUND" in str(exc_info.value)
