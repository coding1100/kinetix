"""Comprehensive task management API coverage: CRUD, filters, subtasks, attachments."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock, patch

import pytest
from httpx import AsyncClient

from app.services.home_helpers import start_of_today
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
async def test_task_get_detail_fields(api_client: AsyncClient):
    token = await login(api_client, *OWNER)
    headers = auth_headers(token)
    ws_id = await workspace_id(api_client, token)
    _, list_id = await create_space_list(api_client, token, ws_id)
    task = await create_task(
        api_client, token, ws_id, list_id, name="Detail task", description="Body"
    )
    task_id = task["id"]

    detail = await api_client.get(
        f"/api/v1/workspaces/{ws_id}/tasks/{task_id}",
        headers=headers,
    )
    assert detail.status_code == 200, detail.text
    body = detail.json()
    assert body["id"] == task_id
    assert body["name"] == "Detail task"
    assert body["description"] == "Body"
    assert body["statusKey"] == "TODO"
    assert body["statusId"]
    assert body["listId"] == list_id
    assert "commentCount" in body
    assert body["commentCount"] == 0
    assert "subtaskCount" in body
    assert body["subtaskCount"] == 0
    assert body["subtasks"] == []
    assert body["attachments"] == []
    assert body["inLineup"] is False
    assert body["isFollowing"] is False
    assert body["assigneeIds"] == []
    assert body["priority"] is None


@pytest.mark.asyncio(loop_scope="session")
async def test_task_list_for_list_and_workspace_search(api_client: AsyncClient):
    token = await login(api_client, *OWNER)
    headers = auth_headers(token)
    ws_id = await workspace_id(api_client, token)
    _, list_id = await create_space_list(api_client, token, ws_id)
    unique = f"UniqueAlpha{int(datetime.now().timestamp())}"
    task = await create_task(api_client, token, ws_id, list_id, name=unique)
    task_id = task["id"]

    list_tasks = await api_client.get(
        f"/api/v1/workspaces/{ws_id}/lists/{list_id}/tasks",
        headers=headers,
    )
    assert list_tasks.status_code == 200, list_tasks.text
    ids = [t["id"] for t in list_tasks.json()["data"]]
    assert task_id in ids

    found = await api_client.get(
        f"/api/v1/workspaces/{ws_id}/tasks?search={unique}",
        headers=headers,
    )
    assert found.status_code == 200, found.text
    assert any(t["id"] == task_id for t in found.json()["data"])

    missing = await api_client.get(
        f"/api/v1/workspaces/{ws_id}/tasks?search=zzznomatch999",
        headers=headers,
    )
    assert missing.status_code == 200, missing.text
    assert not any(t["id"] == task_id for t in missing.json()["data"])


@pytest.mark.asyncio(loop_scope="session")
async def test_task_name_and_description_update(api_client: AsyncClient):
    token = await login(api_client, *OWNER)
    headers = auth_headers(token)
    ws_id = await workspace_id(api_client, token)
    _, list_id = await create_space_list(api_client, token, ws_id)
    task_id = (await create_task(api_client, token, ws_id, list_id))["id"]

    patched = await api_client.patch(
        f"/api/v1/workspaces/{ws_id}/tasks/{task_id}",
        headers=headers,
        json={"name": "Renamed", "description": "Updated body"},
    )
    assert patched.status_code == 200, patched.text
    body = patched.json()
    assert body["name"] == "Renamed"
    assert body["description"] == "Updated body"


@pytest.mark.asyncio(loop_scope="session")
async def test_task_all_priority_levels_and_clear(api_client: AsyncClient):
    token = await login(api_client, *OWNER)
    headers = auth_headers(token)
    ws_id = await workspace_id(api_client, token)
    _, list_id = await create_space_list(api_client, token, ws_id)
    task_id = (await create_task(api_client, token, ws_id, list_id))["id"]

    for level in ("urgent", "high", "normal", "low"):
        res = await api_client.patch(
            f"/api/v1/workspaces/{ws_id}/tasks/{task_id}",
            headers=headers,
            json={"priority": level},
        )
        assert res.status_code == 200, res.text
        assert res.json()["priority"] == level

    cleared = await api_client.patch(
        f"/api/v1/workspaces/{ws_id}/tasks/{task_id}",
        headers=headers,
        json={"priority": None},
    )
    assert cleared.status_code == 200, cleared.text
    assert cleared.json().get("priority") is None


@pytest.mark.asyncio(loop_scope="session")
async def test_task_due_date_set_clear_and_overdue_flag(api_client: AsyncClient):
    token = await login(api_client, *OWNER)
    headers = auth_headers(token)
    ws_id = await workspace_id(api_client, token)
    _, list_id = await create_space_list(api_client, token, ws_id)
    task_id = (await create_task(api_client, token, ws_id, list_id))["id"]

    today_iso = start_of_today().replace(hour=15).isoformat()
    set_due = await api_client.patch(
        f"/api/v1/workspaces/{ws_id}/tasks/{task_id}",
        headers=headers,
        json={"dueDate": today_iso},
    )
    assert set_due.status_code == 200, set_due.text
    assert set_due.json()["dueDate"] == "Today"
    assert set_due.json()["dueDateIso"]

    yesterday = (start_of_today() - timedelta(days=1)).isoformat()
    overdue = await api_client.patch(
        f"/api/v1/workspaces/{ws_id}/tasks/{task_id}",
        headers=headers,
        json={"dueDate": yesterday},
    )
    assert overdue.status_code == 200, overdue.text
    assert overdue.json()["overdue"] is True

    cleared = await api_client.patch(
        f"/api/v1/workspaces/{ws_id}/tasks/{task_id}",
        headers=headers,
        json={"dueDate": ""},
    )
    assert cleared.status_code == 200, cleared.text
    assert cleared.json().get("dueDate") is None
    assert cleared.json().get("dueDateIso") is None


@pytest.mark.asyncio(loop_scope="session")
async def test_task_filter_today_and_overdue(api_client: AsyncClient):
    token = await login(api_client, *OWNER)
    headers = auth_headers(token)
    ws_id = await workspace_id(api_client, token)
    _, list_id = await create_space_list(api_client, token, ws_id)

    today_task_id = (
        await create_task(api_client, token, ws_id, list_id, name="Due today")
    )["id"]
    today_due = start_of_today().replace(hour=12).isoformat()
    set_today = await api_client.patch(
        f"/api/v1/workspaces/{ws_id}/tasks/{today_task_id}",
        headers=headers,
        json={"dueDate": today_due},
    )
    assert set_today.status_code == 200, set_today.text
    assert set_today.json()["dueDate"] == "Today"

    overdue_task_id = (
        await create_task(api_client, token, ws_id, list_id, name="Was due")
    )["id"]
    await api_client.patch(
        f"/api/v1/workspaces/{ws_id}/tasks/{overdue_task_id}",
        headers=headers,
        json={"dueDate": (start_of_today() - timedelta(days=2)).isoformat()},
    )

    today_res = await api_client.get(
        f"/api/v1/workspaces/{ws_id}/tasks?filter=today",
        headers=headers,
    )
    assert today_res.status_code == 200, today_res.text
    today_ids = {t["id"] for t in today_res.json()["data"]}
    assert today_task_id in today_ids

    overdue_res = await api_client.get(
        f"/api/v1/workspaces/{ws_id}/tasks?filter=overdue",
        headers=headers,
    )
    assert overdue_res.status_code == 200, overdue_res.text
    overdue_ids = {t["id"] for t in overdue_res.json()["data"]}
    assert overdue_task_id in overdue_ids

    done = await api_client.patch(
        f"/api/v1/workspaces/{ws_id}/tasks/{overdue_task_id}",
        headers=headers,
        json={"status": "DONE"},
    )
    assert done.status_code == 200, done.text

    overdue_after_done = await api_client.get(
        f"/api/v1/workspaces/{ws_id}/tasks?filter=overdue",
        headers=headers,
    )
    assert overdue_task_id not in {t["id"] for t in overdue_after_done.json()["data"]}


@pytest.mark.asyncio(loop_scope="session")
async def test_task_assignees_add_replace_clear_and_filter(api_client: AsyncClient):
    owner_token = await login(api_client, *OWNER)
    member_token = await login(api_client, *MEMBER)
    owner_headers = auth_headers(owner_token)
    member_headers = auth_headers(member_token)
    ws_id = await workspace_id(api_client, owner_token)
    member_uid = await user_id(api_client, member_token)
    owner_uid = await user_id(api_client, owner_token)
    _, list_id = await create_space_list(api_client, owner_token, ws_id)
    task_id = (await create_task(api_client, owner_token, ws_id, list_id))["id"]

    assigned = await api_client.patch(
        f"/api/v1/workspaces/{ws_id}/tasks/{task_id}",
        headers=owner_headers,
        json={"assigneeIds": [member_uid]},
    )
    assert assigned.status_code == 200, assigned.text
    assert member_uid in assigned.json()["assigneeIds"]

    member_tasks = await api_client.get(
        f"/api/v1/workspaces/{ws_id}/tasks?filter=assigned",
        headers=member_headers,
    )
    assert member_tasks.status_code == 200, member_tasks.text
    assert any(t["id"] == task_id for t in member_tasks.json()["data"])

    replaced = await api_client.patch(
        f"/api/v1/workspaces/{ws_id}/tasks/{task_id}",
        headers=owner_headers,
        json={"assigneeIds": [owner_uid]},
    )
    assert replaced.status_code == 200, replaced.text
    assert replaced.json()["assigneeIds"] == [owner_uid]

    cleared = await api_client.patch(
        f"/api/v1/workspaces/{ws_id}/tasks/{task_id}",
        headers=owner_headers,
        json={"assigneeIds": []},
    )
    assert cleared.status_code == 200, cleared.text
    assert cleared.json()["assigneeIds"] == []


@pytest.mark.asyncio(loop_scope="session")
async def test_task_invalid_assignee_and_status(api_client: AsyncClient):
    token = await login(api_client, *OWNER)
    headers = auth_headers(token)
    ws_id = await workspace_id(api_client, token)
    _, list_id = await create_space_list(api_client, token, ws_id)
    task_id = (await create_task(api_client, token, ws_id, list_id))["id"]

    bad_assignee = await api_client.patch(
        f"/api/v1/workspaces/{ws_id}/tasks/{task_id}",
        headers=headers,
        json={"assigneeIds": ["00000000-0000-0000-0000-000000000099"]},
    )
    assert bad_assignee.status_code == 400, bad_assignee.text

    bad_status = await api_client.patch(
        f"/api/v1/workspaces/{ws_id}/tasks/{task_id}",
        headers=headers,
        json={"statusId": "00000000-0000-0000-0000-000000000099"},
    )
    assert bad_status.status_code == 400, bad_status.text


@pytest.mark.asyncio(loop_scope="session")
async def test_task_invalid_list_move(api_client: AsyncClient):
    token = await login(api_client, *OWNER)
    headers = auth_headers(token)
    ws_id = await workspace_id(api_client, token)
    _, list_id = await create_space_list(api_client, token, ws_id)
    task_id = (await create_task(api_client, token, ws_id, list_id))["id"]

    moved = await api_client.patch(
        f"/api/v1/workspaces/{ws_id}/tasks/{task_id}",
        headers=headers,
        json={"listId": "00000000-0000-0000-0000-000000000099"},
    )
    assert moved.status_code == 400, moved.text


@pytest.mark.asyncio(loop_scope="session")
async def test_task_status_legacy_keys(api_client: AsyncClient):
    token = await login(api_client, *OWNER)
    headers = auth_headers(token)
    ws_id = await workspace_id(api_client, token)
    _, list_id = await create_space_list(api_client, token, ws_id)
    task_id = (await create_task(api_client, token, ws_id, list_id))["id"]

    for status in ("OPEN", "IN_PROGRESS", "DONE", "TODO"):
        res = await api_client.patch(
            f"/api/v1/workspaces/{ws_id}/tasks/{task_id}",
            headers=headers,
            json={"status": status},
        )
        assert res.status_code == 200, res.text
        assert res.json()["statusKey"] == status


@pytest.mark.asyncio(loop_scope="session")
async def test_subtask_create_list_toggle_and_nested_rejected(api_client: AsyncClient):
    token = await login(api_client, *OWNER)
    headers = auth_headers(token)
    ws_id = await workspace_id(api_client, token)
    _, list_id = await create_space_list(api_client, token, ws_id)
    parent_id = (await create_task(api_client, token, ws_id, list_id, name="Parent"))["id"]

    sub = await api_client.post(
        f"/api/v1/workspaces/{ws_id}/tasks/{parent_id}/subtasks",
        headers=headers,
        json={"name": "Sub item"},
    )
    assert sub.status_code == 201, sub.text
    sub_id = sub.json()["id"]
    assert sub.json()["name"] == "Sub item"
    assert sub.json()["statusKey"] == "TODO"

    detail = await api_client.get(
        f"/api/v1/workspaces/{ws_id}/tasks/{parent_id}",
        headers=headers,
    )
    assert detail.status_code == 200, detail.text
    body = detail.json()
    assert body["subtaskCount"] == 1
    assert len(body["subtasks"]) == 1
    assert body["subtasks"][0]["id"] == sub_id

    list_tasks = await api_client.get(
        f"/api/v1/workspaces/{ws_id}/lists/{list_id}/tasks",
        headers=headers,
    )
    list_ids = [t["id"] for t in list_tasks.json()["data"]]
    assert parent_id in list_ids
    assert sub_id not in list_ids

    nested = await api_client.post(
        f"/api/v1/workspaces/{ws_id}/tasks/{sub_id}/subtasks",
        headers=headers,
        json={"name": "Nested"},
    )
    assert nested.status_code == 400, nested.text

    done = await api_client.patch(
        f"/api/v1/workspaces/{ws_id}/tasks/{sub_id}",
        headers=headers,
        json={"status": "DONE"},
    )
    assert done.status_code == 200, done.text
    assert done.json()["statusKey"] == "DONE"


@pytest.mark.asyncio(loop_scope="session")
async def test_subtask_parent_not_found(api_client: AsyncClient):
    token = await login(api_client, *OWNER)
    headers = auth_headers(token)
    ws_id = await workspace_id(api_client, token)

    res = await api_client.post(
        f"/api/v1/workspaces/{ws_id}/tasks/00000000-0000-0000-0000-000000000099/subtasks",
        headers=headers,
        json={"name": "Orphan"},
    )
    assert res.status_code == 404, res.text


@pytest.mark.asyncio(loop_scope="session")
async def test_task_comments_increment_count(api_client: AsyncClient):
    token = await login(api_client, *OWNER)
    headers = auth_headers(token)
    ws_id = await workspace_id(api_client, token)
    _, list_id = await create_space_list(api_client, token, ws_id)
    task_id = (await create_task(api_client, token, ws_id, list_id))["id"]

    for i in range(2):
        res = await api_client.post(
            f"/api/v1/workspaces/{ws_id}/tasks/{task_id}/comments",
            headers=headers,
            json={"body": f"Comment {i}"},
        )
        assert res.status_code == 201, res.text

    detail = await api_client.get(
        f"/api/v1/workspaces/{ws_id}/tasks/{task_id}",
        headers=headers,
    )
    assert detail.status_code == 200, detail.text
    body = detail.json()
    assert body["commentCount"] == 2
    assert len(body["comments"]) == 2
    assert all(c.get("createdAt") for c in body["comments"])


@pytest.mark.asyncio(loop_scope="session")
async def test_task_lineup_reflected_on_detail(api_client: AsyncClient):
    token = await login(api_client, *OWNER)
    headers = auth_headers(token)
    ws_id = await workspace_id(api_client, token)
    _, list_id = await create_space_list(api_client, token, ws_id)
    task_id = (await create_task(api_client, token, ws_id, list_id))["id"]

    added = await api_client.post(
        f"/api/v1/workspaces/{ws_id}/home/lineup",
        headers=headers,
        json={"taskId": task_id},
    )
    assert added.status_code == 201, added.text

    detail = await api_client.get(
        f"/api/v1/workspaces/{ws_id}/tasks/{task_id}",
        headers=headers,
    )
    assert detail.status_code == 200, detail.text
    assert detail.json()["inLineup"] is True

    removed = await api_client.delete(
        f"/api/v1/workspaces/{ws_id}/home/lineup/{task_id}",
        headers=headers,
    )
    assert removed.status_code == 200, removed.text

    after = await api_client.get(
        f"/api/v1/workspaces/{ws_id}/tasks/{task_id}",
        headers=headers,
    )
    assert after.json()["inLineup"] is False


@pytest.mark.asyncio(loop_scope="session")
async def test_task_create_validation_and_not_found(api_client: AsyncClient):
    token = await login(api_client, *OWNER)
    headers = auth_headers(token)
    ws_id = await workspace_id(api_client, token)

    bad_list = await api_client.post(
        f"/api/v1/workspaces/{ws_id}/lists/00000000-0000-0000-0000-000000000099/tasks",
        headers=headers,
        json={"name": "Nope"},
    )
    assert bad_list.status_code == 404, bad_list.text

    _, list_id = await create_space_list(api_client, token, ws_id)
    empty_name = await api_client.post(
        f"/api/v1/workspaces/{ws_id}/lists/{list_id}/tasks",
        headers=headers,
        json={"name": ""},
    )
    assert empty_name.status_code in (400, 422), empty_name.text

    missing = await api_client.get(
        f"/api/v1/workspaces/{ws_id}/tasks/00000000-0000-0000-0000-000000000099",
        headers=headers,
    )
    assert missing.status_code == 404, missing.text


@pytest.mark.asyncio(loop_scope="session")
async def test_task_unauthorized(api_client: AsyncClient):
    token = await login(api_client, *OWNER)
    ws_id = await workspace_id(api_client, token)
    _, list_id = await create_space_list(api_client, token, ws_id)
    task_id = (await create_task(api_client, token, ws_id, list_id))["id"]

    no_auth = await api_client.get(
        f"/api/v1/workspaces/{ws_id}/tasks/{task_id}",
    )
    assert no_auth.status_code == 401, no_auth.text


@pytest.mark.asyncio(loop_scope="session")
async def test_task_attachment_when_s3_not_configured(api_client: AsyncClient):
    token = await login(api_client, *OWNER)
    headers = auth_headers(token)
    ws_id = await workspace_id(api_client, token)
    _, list_id = await create_space_list(api_client, token, ws_id)
    task_id = (await create_task(api_client, token, ws_id, list_id))["id"]

    mock_settings = MagicMock()
    mock_settings.s3_configured = False

    with patch(
        "app.services.task_attachment_service.get_settings",
        return_value=mock_settings,
    ):
        res = await api_client.post(
            f"/api/v1/workspaces/{ws_id}/tasks/{task_id}/attachments/presign",
            headers=headers,
            json={
                "fileName": "doc.txt",
                "mimeType": "text/plain",
                "sizeBytes": 12,
            },
        )
    assert res.status_code == 503, res.text


@pytest.mark.asyncio(loop_scope="session")
async def test_task_attachment_presign_upload_and_list(api_client: AsyncClient):
    token = await login(api_client, *OWNER)
    headers = auth_headers(token)
    ws_id = await workspace_id(api_client, token)
    _, list_id = await create_space_list(api_client, token, ws_id)
    task_id = (await create_task(api_client, token, ws_id, list_id))["id"]

    mock_settings = MagicMock()
    mock_settings.s3_configured = True
    mock_settings.attachment_max_bytes = 26_214_400
    mock_settings.s3_presign_expires_seconds = 900

    with (
        patch(
            "app.services.task_attachment_service.get_settings",
            return_value=mock_settings,
        ),
        patch(
            "app.services.task_attachment_service.presign_put",
            return_value="https://example.com/upload",
        ),
        patch("app.services.task_attachment_service.put_object"),
        patch(
            "app.services.s3_service.presign_get",
            return_value="https://example.com/download",
        ),
    ):
        presign = await api_client.post(
            f"/api/v1/workspaces/{ws_id}/tasks/{task_id}/attachments/presign",
            headers=headers,
            json={
                "fileName": "notes.txt",
                "mimeType": "text/plain",
                "sizeBytes": 5,
            },
        )
        assert presign.status_code == 201, presign.text
        attachment_id = presign.json()["attachmentId"]
        assert presign.json()["uploadUrl"]

        upload = await api_client.post(
            f"/api/v1/workspaces/{ws_id}/tasks/{task_id}/attachments/{attachment_id}/upload",
            headers=headers,
            files={"file": ("notes.txt", b"hello", "text/plain")},
        )
        assert upload.status_code == 200, upload.text
        assert upload.json()["status"] == "ready"

        detail = await api_client.get(
            f"/api/v1/workspaces/{ws_id}/tasks/{task_id}",
            headers=headers,
        )
        assert detail.status_code == 200, detail.text
        attachments = detail.json()["attachments"]
        assert len(attachments) == 1
        assert attachments[0]["id"] == attachment_id
        assert attachments[0]["fileName"] == "notes.txt"
        assert attachments[0]["status"] == "ready"
        assert attachments[0]["downloadUrl"]


@pytest.mark.asyncio(loop_scope="session")
async def test_task_attachment_upload_wrong_user(api_client: AsyncClient):
    owner_token = await login(api_client, *OWNER)
    member_token = await login(api_client, *MEMBER)
    owner_headers = auth_headers(owner_token)
    member_headers = auth_headers(member_token)
    ws_id = await workspace_id(api_client, owner_token)
    _, list_id = await create_space_list(api_client, owner_token, ws_id)
    task_id = (await create_task(api_client, owner_token, ws_id, list_id))["id"]

    mock_settings = MagicMock()
    mock_settings.s3_configured = True
    mock_settings.attachment_max_bytes = 26_214_400
    mock_settings.s3_presign_expires_seconds = 900

    with (
        patch(
            "app.services.task_attachment_service.get_settings",
            return_value=mock_settings,
        ),
        patch(
            "app.services.task_attachment_service.presign_put",
            return_value="https://example.com/upload",
        ),
    ):
        presign = await api_client.post(
            f"/api/v1/workspaces/{ws_id}/tasks/{task_id}/attachments/presign",
            headers=owner_headers,
            json={
                "fileName": "secret.txt",
                "mimeType": "text/plain",
                "sizeBytes": 4,
            },
        )
        assert presign.status_code == 201, presign.text
        attachment_id = presign.json()["attachmentId"]

        upload = await api_client.post(
            f"/api/v1/workspaces/{ws_id}/tasks/{task_id}/attachments/{attachment_id}/upload",
            headers=member_headers,
            files={"file": ("secret.txt", b"data", "text/plain")},
        )
    assert upload.status_code == 404, upload.text


@pytest.mark.asyncio(loop_scope="session")
async def test_delete_parent_task_removes_subtasks(api_client: AsyncClient):
    token = await login(api_client, *OWNER)
    headers = auth_headers(token)
    ws_id = await workspace_id(api_client, token)
    _, list_id = await create_space_list(api_client, token, ws_id)
    parent_id = (await create_task(api_client, token, ws_id, list_id))["id"]

    sub = await api_client.post(
        f"/api/v1/workspaces/{ws_id}/tasks/{parent_id}/subtasks",
        headers=headers,
        json={"name": "Child"},
    )
    assert sub.status_code == 201, sub.text
    sub_id = sub.json()["id"]

    deleted = await api_client.delete(
        f"/api/v1/workspaces/{ws_id}/tasks/{parent_id}",
        headers=headers,
    )
    assert deleted.status_code == 200, deleted.text

    gone_parent = await api_client.get(
        f"/api/v1/workspaces/{ws_id}/tasks/{parent_id}",
        headers=headers,
    )
    assert gone_parent.status_code == 404, gone_parent.text

    gone_sub = await api_client.get(
        f"/api/v1/workspaces/{ws_id}/tasks/{sub_id}",
        headers=headers,
    )
    assert gone_sub.status_code == 404, gone_sub.text
