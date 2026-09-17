import json
import uuid
import pytest
from httpx import AsyncClient

from app.mcp.server import mcp

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
async def test_mcp_task_advanced_ops(api_client: AsyncClient):
    token = await _login(api_client, *OWNER)
    headers = _auth(token)

    me = await api_client.get("/api/v1/auth/me", headers=headers)
    assert me.status_code == 200
    workspace_id = me.json()["workspaces"][0]["id"]

    suffix = str(uuid.uuid4())[:8]
    space_res = await api_client.post(
        f"/api/v1/workspaces/{workspace_id}/spaces",
        headers=headers,
        json={"name": f"MCP Adv Space {suffix}"},
    )
    assert space_res.status_code == 201
    space_id = space_res.json()["id"]

    list_res = await api_client.post(
        f"/api/v1/workspaces/{workspace_id}/spaces/{space_id}/lists",
        headers=headers,
        json={"name": "MCP Adv List"},
    )
    assert list_res.status_code == 201
    list_id = list_res.json()["id"]

    # 1. Create task
    create_res = await mcp.call_tool(
        "kinetix_create_task",
        {"title": f"Initial Task {suffix}", "list_id": list_id, "priority": "low"},
    )
    assert not create_res.is_error
    task_data = json.loads(create_res.content[0].text)
    task_id = task_data["id"]

    # 2. Update task (title, status, priority)
    updated_title = f"Updated Task {suffix}"
    update_res = await mcp.call_tool(
        "kinetix_update_task",
        {
            "task_id": task_id,
            "title": updated_title,
            "status": "IN_PROGRESS",
            "priority": "urgent",
        },
    )
    assert not update_res.is_error
    updated_data = json.loads(update_res.content[0].text)
    assert updated_data["name"] == updated_title
    assert updated_data["priority"].upper() == "URGENT"

    # 3. Create subtask
    subtask_title = f"Nested Subtask {suffix}"
    sub_res = await mcp.call_tool(
        "kinetix_create_subtask",
        {"parent_task_id": task_id, "title": subtask_title},
    )
    assert not sub_res.is_error
    sub_data = json.loads(sub_res.content[0].text)
    assert sub_data["name"] == subtask_title
    assert sub_data["parentTaskId"] == task_id

    # 4. Add task comment
    comment_content = "Automated progress note from AI Agent."
    comment_res = await mcp.call_tool(
        "kinetix_add_task_comment",
        {"task_id": task_id, "content": comment_content},
    )
    assert not comment_res.is_error
    comment_data = json.loads(comment_res.content[0].text)
    assert comment_data["content"] == comment_content
    assert comment_data["commentsCount"] >= 1

    # 5. Verify full task reflects changes
    get_res = await mcp.call_tool("kinetix_get_task", {"task_id": task_id})
    assert not get_res.is_error
    full_task = json.loads(get_res.content[0].text)
    assert full_task["name"] == updated_title
    assert full_task["priority"].upper() == "URGENT"
    assert len(full_task["subtasks"]) >= 1
    assert full_task["commentsCount"] >= 1


@pytest.mark.asyncio(loop_scope="session")
async def test_mcp_chat_channels_and_personal_dms(api_client: AsyncClient):
    token = await _login(api_client, *OWNER)
    headers = _auth(token)

    me = await api_client.get("/api/v1/auth/me", headers=headers)
    assert me.status_code == 200
    workspace_id = me.json()["workspaces"][0]["id"]

    suffix = str(uuid.uuid4())[:8]
    chan_name = f"mcp-chan-{suffix}"
    chan_res = await api_client.post(
        f"/api/v1/workspaces/{workspace_id}/chat/channels",
        headers=headers,
        json={"name": chan_name, "topic": "MCP Collaboration Test"},
    )
    assert chan_res.status_code == 201
    channel_id = chan_res.json()["id"]

    # 1. List channels
    channels_res = await mcp.call_tool("kinetix_list_channels", {"workspace_id": workspace_id})
    assert not channels_res.is_error
    channels_data = json.loads(channels_res.content[0].text)
    assert any(c["id"] == channel_id for c in channels_data["channels"])

    # 2. Post channel message by channel_id
    message_text = f"Hello team from Claude MCP subagent! {suffix}"
    post_res = await mcp.call_tool(
        "kinetix_post_channel_message",
        {"channel_id": channel_id, "content": message_text},
    )
    assert not post_res.is_error
    posted_data = json.loads(post_res.content[0].text)
    assert posted_data["content"] == message_text

    # 3. Post channel message by channel_name
    name_msg_text = f"Second message sent via channel_name {suffix}"
    post_name_res = await mcp.call_tool(
        "kinetix_post_channel_message",
        {"channel_name": chan_name, "content": name_msg_text, "workspace_id": workspace_id},
    )
    assert not post_name_res.is_error

    # 4. Get channel messages
    get_msgs_res = await mcp.call_tool(
        "kinetix_get_channel_messages",
        {"channel_id": channel_id, "limit": 10},
    )
    assert not get_msgs_res.is_error
    msgs_data = json.loads(get_msgs_res.content[0].text)
    assert any(m["content"] == message_text for m in msgs_data["messages"])
    assert any(m["content"] == name_msg_text for m in msgs_data["messages"])

    # 5. Read channel messages resource
    chan_resource = await mcp.read_resource(f"kinetix://channels/{channel_id}/messages")
    assert len(chan_resource.contents) > 0
    assert message_text in chan_resource.contents[0].content

    # 6. Send Personal Direct Message (Self-DM or to team member)
    dm_text = f"Private note to self via MCP {suffix}"
    dm_res = await mcp.call_tool(
        "kinetix_send_direct_message",
        {"recipient_email_or_id": "owner@demo.com", "content": dm_text, "workspace_id": workspace_id},
    )
    assert not dm_res.is_error
    dm_data = json.loads(dm_res.content[0].text)
    conv_id = dm_data["conversationId"]
    assert dm_data["content"] == dm_text

    # 7. List direct conversations
    dms_list_res = await mcp.call_tool("kinetix_list_direct_conversations", {"workspace_id": workspace_id})
    assert not dms_list_res.is_error
    dms_data = json.loads(dms_list_res.content[0].text)
    assert any(d["id"] == conv_id for d in dms_data["conversations"])

    # 8. Read direct messages
    get_dm_msgs_res = await mcp.call_tool(
        "kinetix_get_direct_messages",
        {"conversation_id": conv_id, "limit": 10},
    )
    assert not get_dm_msgs_res.is_error
    dm_msgs_data = json.loads(get_dm_msgs_res.content[0].text)
    assert any(m["content"] == dm_text for m in dm_msgs_data["messages"])

    # 9. Read DM resource
    dm_resource = await mcp.read_resource(f"kinetix://dms/{conv_id}/messages")
    assert len(dm_resource.contents) > 0
    assert dm_text in dm_resource.contents[0].content

    # 10. Personal Post
    post_pub_res = await mcp.call_tool(
        "kinetix_create_personal_post",
        {"channel": "announcements", "content": f"Automated bulletin {suffix}"},
    )
    assert not post_pub_res.is_error
    post_pub_data = json.loads(post_pub_res.content[0].text)
    assert post_pub_data["channel"] == "announcements"


@pytest.mark.asyncio(loop_scope="session")
async def test_mcp_search_tool(api_client: AsyncClient):
    token = await _login(api_client, *OWNER)

    search_res = await mcp.call_tool(
        "kinetix_search",
        {"query": "Task", "scope": "all"},
    )
    assert not search_res.is_error
    data = json.loads(search_res.content[0].text)
    assert data["query"] == "Task"
    assert "tasks" in data


@pytest.mark.asyncio(loop_scope="session")
async def test_mcp_prompts(api_client: AsyncClient):
    # Test rendering daily_standup_report prompt
    standup_rendered = await mcp.render_prompt("daily_standup_report", {})
    assert len(standup_rendered.messages) > 0
    text_content = standup_rendered.messages[0].content.text
    assert "daily standup" in text_content.lower()

    # Test rendering task_spec_generator prompt
    spec_rendered = await mcp.render_prompt(
        "task_spec_generator", {"task_title": "OAuth Token Refresh Security"}
    )
    assert len(spec_rendered.messages) > 0
    spec_text = spec_rendered.messages[0].content.text
    assert "OAuth Token Refresh Security" in spec_text
