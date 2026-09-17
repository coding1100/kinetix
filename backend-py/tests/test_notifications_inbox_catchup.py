"""Tests for Notifications, Real-Time Inbox, Task Deletion Cleanup & AI Catch-Up."""

from __future__ import annotations

import time
import httpx
import pytest

from app.services.notification_service import task_id_from_href

PASSWORD = "password123"
OWNER_EMAIL = "owner@demo.com"
ALEX_EMAIL = "alex@demo.com"


def test_task_id_from_href_formats():
    """Verify task_id_from_href parses standard, query, and path task references."""
    assert task_id_from_href("/home/tasks/t-12345") == "t-12345"
    assert task_id_from_href("/home/tasks/t-12345?tab=activity") == "t-12345"
    assert task_id_from_href("/tasks/t-999") == "t-999"
    assert task_id_from_href("/spaces/l/list-1?task=t-query-abc") == "t-query-abc"
    assert task_id_from_href("/spaces/l/list-1?foo=bar&task=t-multi&baz=qux") == "t-multi"
    assert task_id_from_href("/chat/c/general") is None
    assert task_id_from_href("/chat/dm/user-1") is None
    assert task_id_from_href("") is None
    assert task_id_from_href(None) is None


def _login(base: str, email: str) -> dict:
    res = httpx.post(
        f"{base}/api/v1/auth/login",
        json={"email": email, "password": PASSWORD},
        timeout=10,
    )
    if res.status_code != 200:
        res = httpx.post(
            f"{base}/api/v1/auth/login",
            json={"email": email, "password": "Password123!"},
            timeout=10,
        )
    assert res.status_code == 200, res.text
    token = res.json()["accessToken"]
    me = httpx.get(
        f"{base}/api/v1/auth/me",
        headers={"Authorization": f"Bearer {token}"},
        timeout=10,
    )
    assert me.status_code == 200, me.text
    body = me.json()
    return {
        "token": token,
        "workspace_id": body["workspaces"][0]["id"],
        "user_id": body["id"],
        "full_name": body.get("fullName") or "",
        "headers": {"Authorization": f"Bearer {token}"},
    }


def test_ai_catch_up_and_knowledge_query(dedicated_api_server):
    """Verify AI Catch-Up and Knowledge Query endpoints succeed with workspace_id scoping."""
    base = dedicated_api_server
    owner = _login(base, OWNER_EMAIL)
    ws_id = owner["workspace_id"]

    # 1. Fetch channel list to pick a channel for catch-up
    channels_res = httpx.get(
        f"{base}/api/v1/workspaces/{ws_id}/chat/channels",
        headers=owner["headers"],
        timeout=10,
    )
    assert channels_res.status_code == 200, channels_res.text
    channels = channels_res.json().get("data", [])
    if not channels:
        # Create a channel if none exist
        create_c = httpx.post(
            f"{base}/api/v1/workspaces/{ws_id}/chat/channels",
            headers=owner["headers"],
            json={"name": f"ai-catchup-{int(time.time())}", "isPrivate": False},
            timeout=10,
        )
        assert create_c.status_code == 201, create_c.text
        test_channel_id = create_c.json()["id"]
    else:
        test_channel_id = channels[0]["id"]

    # Post a message so there's content to summarize
    httpx.post(
        f"{base}/api/v1/workspaces/{ws_id}/chat/messages",
        headers=owner["headers"],
        json={
            "channelId": test_channel_id,
            "content": "Action item: finalize Q3 roadmap and notify the team by Friday.",
        },
        timeout=10,
    )

    # 2. Call AI Catch-Up
    catch_up_res = httpx.post(
        f"{base}/api/v1/workspaces/{ws_id}/ai/catch-up",
        headers=owner["headers"],
        json={
            "conversationType": "channel",
            "conversationId": test_channel_id,
            "limit": 20,
        },
        timeout=15,
    )
    assert catch_up_res.status_code == 200, catch_up_res.text
    catch_up_data = catch_up_res.json()
    assert "summary" in catch_up_data
    assert "actionItems" in catch_up_data
    assert "keyDecisions" in catch_up_data
    assert "mentions" in catch_up_data
    if catch_up_data["actionItems"]:
        first_action = catch_up_data["actionItems"][0]
        assert isinstance(first_action, dict)
        assert "text" in first_action
        assert "messageId" in first_action

    # 3. File upload ingestion into knowledge base
    upload_res = httpx.post(
        f"{base}/api/v1/workspaces/{ws_id}/admin/knowledge-base/upload",
        headers=owner["headers"],
        files={"file": ("remote_work_policy.txt", b"Employees may work remotely on Mondays and Fridays with manager approval.")},
        data={"category": "Policy", "title": "Remote Work Policy"},
        timeout=10,
    )
    assert upload_res.status_code == 201, upload_res.text
    uploaded_doc = upload_res.json()
    assert uploaded_doc["title"] == "Remote Work Policy"

    # 4. Call AI Knowledge Query (Sync)
    kq_res = httpx.post(
        f"{base}/api/v1/workspaces/{ws_id}/ai/knowledge-query",
        headers=owner["headers"],
        json={
            "query": "Can employees work remotely on Fridays?",
            "topK": 3,
        },
        timeout=15,
    )
    assert kq_res.status_code == 200, kq_res.text
    kq_data = kq_res.json()
    assert "answer" in kq_data
    assert "citations" in kq_data

    # 5. Call AI Knowledge Query (SSE Stream)
    stream_res = httpx.post(
        f"{base}/api/v1/workspaces/{ws_id}/ai/knowledge-query/stream",
        headers=owner["headers"],
        json={"query": "Can employees work remotely on Fridays?", "topK": 3},
        timeout=15,
    )
    assert stream_res.status_code == 200, stream_res.text
    stream_text = stream_res.text
    assert "data:" in stream_text
    assert '"type": "meta"' in stream_text
    assert '"type": "done"' in stream_text


def test_inbox_and_unread_summary_flows(dedicated_api_server):
    """Verify inbox updates, read-all, and unread summary count alignment."""
    base = dedicated_api_server
    owner = _login(base, OWNER_EMAIL)
    alex = _login(base, ALEX_EMAIL)
    ws_id = owner["workspace_id"]

    # Trigger a notification to alex
    unique_chan = f"sync-notif-{int(time.time())}"
    create_chan = httpx.post(
        f"{base}/api/v1/workspaces/{ws_id}/chat/channels",
        headers=owner["headers"],
        json={"name": unique_chan, "isPrivate": True, "memberIds": [alex["user_id"]]},
        timeout=10,
    )
    assert create_chan.status_code == 201, create_chan.text

    # Check alex's inbox
    inbox_res = httpx.get(
        f"{base}/api/v1/workspaces/{ws_id}/home/inbox?tab=all",
        headers=alex["headers"],
        timeout=10,
    )
    assert inbox_res.status_code == 200, inbox_res.text
    items = inbox_res.json()["data"]
    assert len(items) > 0
    target_item = items[0]

    # Test update_inbox_item: mark as read
    patch_res = httpx.patch(
        f"{base}/api/v1/workspaces/{ws_id}/home/inbox/{target_item['id']}",
        headers=alex["headers"],
        json={"unread": False},
        timeout=10,
    )
    assert patch_res.status_code == 200, patch_res.text
    assert patch_res.json()["unread"] is False

    # Test update_inbox_item: move to LATER bucket
    patch_bucket = httpx.patch(
        f"{base}/api/v1/workspaces/{ws_id}/home/inbox/{target_item['id']}",
        headers=alex["headers"],
        json={"bucket": "LATER", "unread": True},
        timeout=10,
    )
    assert patch_bucket.status_code == 200, patch_bucket.text
    assert patch_bucket.json()["bucket"] == "later"

    # Test mark_all_notifications_read
    read_all_res = httpx.post(
        f"{base}/api/v1/workspaces/{ws_id}/home/notifications/read-all",
        headers=alex["headers"],
        timeout=10,
    )
    assert read_all_res.status_code == 200, read_all_res.text
    assert "updated" in read_all_res.json()

    # Test unread-summary
    summary_res = httpx.get(
        f"{base}/api/v1/workspaces/{ws_id}/home/unread-summary",
        headers=alex["headers"],
        timeout=10,
    )
    assert summary_res.status_code == 200, summary_res.text
    assert "home" in summary_res.json()
    assert isinstance(summary_res.json()["home"], int)


def test_task_deletion_cleans_inbox_items(dedicated_api_server):
    """Verify that deleting a task removes all corresponding InboxItem rows."""
    base = dedicated_api_server
    owner = _login(base, OWNER_EMAIL)
    ws_id = owner["workspace_id"]

    # 1. Create a space and list
    suffix = int(time.time() * 1000)
    space = httpx.post(
        f"{base}/api/v1/workspaces/{ws_id}/spaces",
        headers=owner["headers"],
        json={"name": f"Del Test Space {suffix}"},
        timeout=10,
    )
    assert space.status_code == 201, space.text
    space_id = space.json()["id"]

    lst = httpx.post(
        f"{base}/api/v1/workspaces/{ws_id}/spaces/{space_id}/lists",
        headers=owner["headers"],
        json={"name": "Del Test List"},
        timeout=10,
    )
    assert lst.status_code == 201, lst.text
    list_id = lst.json()["id"]

    # 2. Create a task
    create_task = httpx.post(
        f"{base}/api/v1/workspaces/{ws_id}/lists/{list_id}/tasks",
        headers=owner["headers"],
        json={"name": f"Deletion Cleanup Task {suffix}"},
        timeout=10,
    )
    assert create_task.status_code == 201, create_task.text
    task_id = create_task.json()["id"]

    # 3. Add a comment to trigger task activity / notification
    comment_res = httpx.post(
        f"{base}/api/v1/workspaces/{ws_id}/tasks/{task_id}/comments",
        headers=owner["headers"],
        json={"body": "Notification test comment on task"},
        timeout=10,
    )
    assert comment_res.status_code in (200, 201), comment_res.text

    # 4. Delete the task
    del_res = httpx.delete(
        f"{base}/api/v1/workspaces/{ws_id}/tasks/{task_id}",
        headers=owner["headers"],
        timeout=10,
    )
    assert del_res.status_code == 200, del_res.text
    assert del_res.json().get("ok") is True

    # 5. Check inbox items - no items should have href matching this task_id
    inbox_res = httpx.get(
        f"{base}/api/v1/workspaces/{ws_id}/home/inbox?tab=all",
        headers=owner["headers"],
        timeout=10,
    )
    assert inbox_res.status_code == 200, inbox_res.text
    remaining_items = inbox_res.json()["data"]
    for item in remaining_items:
        assert task_id not in (item.get("href") or ""), f"Orphaned inbox item found for deleted task: {item}"


def test_mark_channel_read_clears_channel_inbox_notifications(dedicated_api_server):
    """Verify that opening/marking a channel as read clears corresponding channel InboxItems."""
    base = dedicated_api_server
    owner = _login(base, OWNER_EMAIL)
    alex = _login(base, ALEX_EMAIL)
    ws_id = owner["workspace_id"]

    # 1. Create a public channel
    suffix = int(time.time() * 1000)
    ch_res = httpx.post(
        f"{base}/api/v1/workspaces/{ws_id}/chat/channels",
        headers=owner["headers"],
        json={"name": f"notif-sync-{suffix}", "isPrivate": False},
        timeout=10,
    )
    assert ch_res.status_code == 201, ch_res.text
    ch_id = ch_res.json()["id"]

    # 2. Add Alex to the channel
    add_res = httpx.post(
        f"{base}/api/v1/workspaces/{ws_id}/chat/channels/{ch_id}/members",
        headers=owner["headers"],
        json={"userIds": [alex["user_id"]]},
        timeout=10,
    )
    assert add_res.status_code in (200, 201), add_res.text

    # 3. Owner sends a message @mentioning in the channel
    alex_name = "\xa0".join(alex["full_name"].split())
    msg_res = httpx.post(
        f"{base}/api/v1/workspaces/{ws_id}/chat/channels/{ch_id}/messages",
        headers=owner["headers"],
        json={"body": f"Hello @{alex_name} please check this update!"},
        timeout=10,
    )
    assert msg_res.status_code == 201, msg_res.text

    # 4. Verify Alex has an unread notification for this channel
    notif_res = httpx.get(
        f"{base}/api/v1/workspaces/{ws_id}/home/notifications",
        headers=alex["headers"],
        timeout=10,
    )
    assert notif_res.status_code == 200, notif_res.text
    alex_notifs = notif_res.json()["data"]
    ch_notif = next((n for n in alex_notifs if f"/c/{ch_id}" in (n.get("href") or "")), None)
    assert ch_notif is not None, "Alex should have an inbox notification for the mention"
    assert ch_notif["unread"] is True

    # 5. Alex opens the channel (calls mark_channel_read)
    read_res = httpx.post(
        f"{base}/api/v1/workspaces/{ws_id}/chat/channels/{ch_id}/read",
        headers=alex["headers"],
        timeout=10,
    )
    assert read_res.status_code == 200, read_res.text
    assert read_res.json()["unread"] == 0

    # 6. Verify Alex's notification for this channel is now marked as read
    after_notif = httpx.get(
        f"{base}/api/v1/workspaces/{ws_id}/home/notifications",
        headers=alex["headers"],
        timeout=10,
    )
    assert after_notif.status_code == 200, after_notif.text
    alex_after = after_notif.json()["data"]
    ch_notif_after = next((n for n in alex_after if f"/c/{ch_id}" in (n.get("href") or "")), None)
    assert ch_notif_after is not None
    assert ch_notif_after["unread"] is False, "Notification must be marked read when channel is marked read"

