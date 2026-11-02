"""Task access: assigning someone shares the List with them, and workspace
admins (Owner, Super Admin, Admin) can open everything in their workspace."""

from __future__ import annotations

import uuid

import pytest
from httpx import AsyncClient
from sqlalchemy import select

from app.core.security import hash_password
from app.db.models.enums import MemberStatus, PermissionLevel, WorkspaceRole
from app.db.models.home import ListMember
from app.db.models.user import User
from app.db.models.workspace import WorkspaceMember
from app.db.session import get_session_factory
from tests.task_test_helpers import (
    OWNER,
    auth_headers,
    create_space_list,
    create_task,
    login,
    workspace_id,
)

PASSWORD = "Password123!"
pytestmark = pytest.mark.asyncio(loop_scope="session")


async def _member(api_client: AsyncClient, ws_id: str, role: WorkspaceRole) -> tuple[str, str]:
    """Create a fresh workspace member with `role`; returns (user id, token)."""
    async with get_session_factory()() as session:
        user = User(
            email=f"access-{uuid.uuid4().hex[:10]}@example.com",
            password_hash=hash_password(PASSWORD),
            full_name=f"Access {role.value}",
        )
        session.add(user)
        await session.flush()
        session.add(
            WorkspaceMember(
                workspace_id=ws_id, user_id=user.id, role=role, status=MemberStatus.ACTIVE
            )
        )
        await session.commit()
        return user.id, await login(api_client, user.email, PASSWORD)


async def _list_grant(list_id: str, user_id: str) -> PermissionLevel | None:
    async with get_session_factory()() as session:
        return await session.scalar(
            select(ListMember.permission_level).where(
                ListMember.list_id == list_id,
                ListMember.user_id == user_id,
                ListMember.status == MemberStatus.ACTIVE,
            )
        )


async def _setup(api_client: AsyncClient):
    """A member-owned List nobody else has been shared on."""
    owner = await login(api_client, *OWNER)
    ws_id = await workspace_id(api_client, owner)
    creator_id, creator = await _member(api_client, ws_id, WorkspaceRole.MEMBER)
    _, list_id = await create_space_list(api_client, creator, ws_id)
    return ws_id, creator_id, creator, list_id


def _task_url(ws_id: str, task_id: str) -> str:
    return f"/api/v1/workspaces/{ws_id}/tasks/{task_id}"


async def test_assignee_on_create_can_open_task(api_client: AsyncClient):
    ws_id, _, creator, list_id = await _setup(api_client)
    assignee_id, assignee = await _member(api_client, ws_id, WorkspaceRole.MEMBER)

    res = await api_client.post(
        f"/api/v1/workspaces/{ws_id}/lists/{list_id}/tasks",
        headers=auth_headers(creator),
        json={"name": "assigned on create", "assigneeIds": [assignee_id]},
    )
    assert res.status_code == 201, res.text
    task_id = res.json()["id"]

    assert (await api_client.get(_task_url(ws_id, task_id), headers=auth_headers(assignee))).status_code == 200
    assert await _list_grant(list_id, assignee_id) == PermissionLevel.EDIT
    patched = await api_client.patch(
        _task_url(ws_id, task_id), headers=auth_headers(assignee), json={"name": "renamed by assignee"}
    )
    assert patched.status_code == 200, patched.text


async def test_assignee_on_update_can_open_task_and_sees_it_in_assigned(api_client: AsyncClient):
    ws_id, _, creator, list_id = await _setup(api_client)
    task = await create_task(api_client, creator, ws_id, list_id, name="assigned later")
    assignee_id, assignee = await _member(api_client, ws_id, WorkspaceRole.MEMBER)

    assert (await api_client.get(_task_url(ws_id, task["id"]), headers=auth_headers(assignee))).status_code == 403
    res = await api_client.patch(
        _task_url(ws_id, task["id"]), headers=auth_headers(creator), json={"assigneeIds": [assignee_id]}
    )
    assert res.status_code == 200, res.text

    assert (await api_client.get(_task_url(ws_id, task["id"]), headers=auth_headers(assignee))).status_code == 200
    listed = await api_client.get(
        f"/api/v1/workspaces/{ws_id}/tasks", headers=auth_headers(assignee), params={"filter": "assigned"}
    )
    assert task["id"] in {t["id"] for t in listed.json()["data"]}


async def test_existing_lower_grant_is_raised_to_edit(api_client: AsyncClient):
    ws_id, _, creator, list_id = await _setup(api_client)
    task = await create_task(api_client, creator, ws_id, list_id, name="view-only assignee")
    assignee_id, assignee = await _member(api_client, ws_id, WorkspaceRole.MEMBER)
    async with get_session_factory()() as session:
        session.add(
            ListMember(
                list_id=list_id,
                user_id=assignee_id,
                status=MemberStatus.ACTIVE,
                permission_level=PermissionLevel.VIEW,
            )
        )
        await session.commit()

    await api_client.patch(
        _task_url(ws_id, task["id"]), headers=auth_headers(creator), json={"assigneeIds": [assignee_id]}
    )
    assert await _list_grant(list_id, assignee_id) == PermissionLevel.EDIT
    res = await api_client.patch(
        _task_url(ws_id, task["id"]), headers=auth_headers(assignee), json={"name": "assignee can edit"}
    )
    assert res.status_code == 200, res.text


async def test_moving_task_shares_target_list_with_assignees(api_client: AsyncClient):
    ws_id, _, creator, list_id = await _setup(api_client)
    assignee_id, assignee = await _member(api_client, ws_id, WorkspaceRole.MEMBER)
    res = await api_client.post(
        f"/api/v1/workspaces/{ws_id}/lists/{list_id}/tasks",
        headers=auth_headers(creator),
        json={"name": "moves", "assigneeIds": [assignee_id]},
    )
    task_id = res.json()["id"]
    sub_assignee_id, sub_assignee = await _member(api_client, ws_id, WorkspaceRole.MEMBER)
    subtask = await api_client.post(
        f"{_task_url(ws_id, task_id)}/subtasks", headers=auth_headers(creator), json={"name": "sub"}
    )
    assert subtask.status_code == 201, subtask.text
    subtask_id = subtask.json()["id"]
    assigned = await api_client.patch(
        _task_url(ws_id, subtask_id), headers=auth_headers(creator), json={"assigneeIds": [sub_assignee_id]}
    )
    assert assigned.status_code == 200, assigned.text
    _, target_list_id = await create_space_list(api_client, creator, ws_id)

    moved = await api_client.patch(
        _task_url(ws_id, task_id), headers=auth_headers(creator), json={"listId": target_list_id}
    )
    assert moved.status_code == 200, moved.text
    assert await _list_grant(target_list_id, assignee_id) == PermissionLevel.EDIT
    assert await _list_grant(target_list_id, sub_assignee_id) == PermissionLevel.EDIT
    assert (await api_client.get(_task_url(ws_id, task_id), headers=auth_headers(assignee))).status_code == 200
    assert (await api_client.get(_task_url(ws_id, subtask_id), headers=auth_headers(sub_assignee))).status_code == 200


async def test_checklist_item_assignee_can_open_task(api_client: AsyncClient):
    ws_id, _, creator, list_id = await _setup(api_client)
    task = await create_task(api_client, creator, ws_id, list_id, name="checklist")
    assignee_id, assignee = await _member(api_client, ws_id, WorkspaceRole.MEMBER)
    checklist = await api_client.post(
        f"{_task_url(ws_id, task['id'])}/checklists", headers=auth_headers(creator), json={"name": "Steps"}
    )
    assert checklist.status_code == 201, checklist.text
    item = await api_client.post(
        f"{_task_url(ws_id, task['id'])}/checklists/{checklist.json()['id']}/items",
        headers=auth_headers(creator),
        json={"text": "do it", "assigneeId": assignee_id},
    )
    assert item.status_code == 201, item.text
    assert (await api_client.get(_task_url(ws_id, task["id"]), headers=auth_headers(assignee))).status_code == 200


@pytest.mark.parametrize(
    "role", [WorkspaceRole.OWNER, WorkspaceRole.SUPER_ADMIN, WorkspaceRole.ADMIN]
)
async def test_workspace_admins_open_unshared_tasks(api_client: AsyncClient, role: WorkspaceRole):
    ws_id, _, creator, list_id = await _setup(api_client)
    task = await create_task(api_client, creator, ws_id, list_id, name=f"unshared for {role.value}")
    if role == WorkspaceRole.OWNER:
        admin = await login(api_client, *OWNER)
    else:
        _, admin = await _member(api_client, ws_id, role)

    assert (await api_client.get(_task_url(ws_id, task["id"]), headers=auth_headers(admin))).status_code == 200
    listed = await api_client.get(f"/api/v1/workspaces/{ws_id}/tasks", headers=auth_headers(admin))
    assert task["id"] in {t["id"] for t in listed.json()["data"]}


async def test_plain_member_still_cannot_open_unshared_task(api_client: AsyncClient):
    ws_id, _, creator, list_id = await _setup(api_client)
    task = await create_task(api_client, creator, ws_id, list_id, name="private to creator")
    _, outsider = await _member(api_client, ws_id, WorkspaceRole.MEMBER)

    assert (await api_client.get(_task_url(ws_id, task["id"]), headers=auth_headers(outsider))).status_code == 403
    listed = await api_client.get(f"/api/v1/workspaces/{ws_id}/tasks", headers=auth_headers(outsider))
    assert task["id"] not in {t["id"] for t in listed.json()["data"]}


async def test_assigned_filter_never_lists_a_task_the_user_cannot_open(api_client: AsyncClient):
    ws_id, _, creator, list_id = await _setup(api_client)
    assignee_id, assignee = await _member(api_client, ws_id, WorkspaceRole.MEMBER)
    res = await api_client.post(
        f"/api/v1/workspaces/{ws_id}/lists/{list_id}/tasks",
        headers=auth_headers(creator),
        json={"name": "access revoked", "assigneeIds": [assignee_id]},
    )
    task_id = res.json()["id"]
    owner = await login(api_client, *OWNER)
    removed = await api_client.delete(
        f"/api/v1/workspaces/{ws_id}/lists/{list_id}/members/{assignee_id}", headers=auth_headers(owner)
    )
    assert removed.status_code == 200, removed.text

    assert (await api_client.get(_task_url(ws_id, task_id), headers=auth_headers(assignee))).status_code == 403
    listed = await api_client.get(
        f"/api/v1/workspaces/{ws_id}/tasks", headers=auth_headers(assignee), params={"filter": "assigned"}
    )
    assert task_id not in {t["id"] for t in listed.json()["data"]}
