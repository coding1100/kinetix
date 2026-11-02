"""Regression tests for chat, task, invite and admin-portal defects."""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

import pytest
from httpx import AsyncClient
from sqlalchemy import select, update

from app.core.security import hash_password
from app.db.models.chat import ChatMessage, MessageReaction
from app.db.models.enums import MemberStatus, PlatformRole, WorkspaceRole
from app.db.models.home import TaskComment
from app.db.models.invite import Invite
from app.db.models.platform import PlatformStaff
from app.db.models.user import User
from app.db.models.workspace import WorkspaceMember
from app.db.session import get_session_factory
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

PASSWORD = "Password123!"
pytestmark = pytest.mark.asyncio(loop_scope="session")


def _suffix() -> str:
    return uuid.uuid4().hex[:10]


async def _create_user(*, member_of: str | None = None, role=WorkspaceRole.MEMBER) -> User:
    async with get_session_factory()() as session:
        user = User(
            email=f"audit-{_suffix()}@example.com",
            password_hash=hash_password(PASSWORD),
            full_name="Audit User",
        )
        session.add(user)
        await session.flush()
        if member_of:
            session.add(
                WorkspaceMember(
                    workspace_id=member_of,
                    user_id=user.id,
                    role=role,
                    status=MemberStatus.ACTIVE,
                )
            )
        await session.commit()
        return user


async def _owner_and_member(client: AsyncClient):
    owner = await login(client, *OWNER)
    member = await login(client, *MEMBER)
    ws_id = await workspace_id(client, owner)
    return owner, member, ws_id


async def _create_channel(client: AsyncClient, token: str, ws_id: str, member_ids: list[str]) -> str:
    res = await client.post(
        f"/api/v1/workspaces/{ws_id}/chat/channels",
        headers=auth_headers(token),
        json={"name": f"audit-{_suffix()}", "memberIds": member_ids},
    )
    assert res.status_code == 201, res.text
    return res.json()["id"]


async def _post_message(client: AsyncClient, token: str, ws_id: str, channel_id: str, body: str = "hi") -> str:
    res = await client.post(
        f"/api/v1/workspaces/{ws_id}/chat/channels/{channel_id}/messages",
        headers=auth_headers(token),
        json={"body": body},
    )
    assert res.status_code == 201, res.text
    return res.json()["id"]


# --- Chat ------------------------------------------------------------------


async def test_delete_message_with_reaction_and_replies(api_client: AsyncClient):
    owner, member, ws_id = await _owner_and_member(api_client)
    channel_id = await _create_channel(
        api_client, owner, ws_id, [await user_id(api_client, member)]
    )
    root_id = await _post_message(api_client, owner, ws_id, channel_id, "root")
    reply = await api_client.post(
        f"/api/v1/workspaces/{ws_id}/chat/channels/{channel_id}/messages/{root_id}/thread",
        headers=auth_headers(member),
        json={"body": "reply"},
    )
    assert reply.status_code == 201, reply.text
    react = await api_client.post(
        f"/api/v1/workspaces/{ws_id}/chat/messages/{root_id}/reactions",
        headers=auth_headers(member),
        json={"emoji": "👍"},
    )
    assert react.status_code == 200, react.text

    res = await api_client.delete(
        f"/api/v1/workspaces/{ws_id}/chat/messages/{root_id}",
        headers=auth_headers(owner),
    )
    assert res.status_code == 200, res.text

    async with get_session_factory()() as session:
        assert await session.get(ChatMessage, reply.json()["id"]) is None
        assert not (
            await session.scalars(
                select(MessageReaction).where(MessageReaction.message_id == root_id)
            )
        ).all()


async def test_thread_reply_to_a_reply_is_rejected(api_client: AsyncClient):
    owner, _, ws_id = await _owner_and_member(api_client)
    channel_id = await _create_channel(api_client, owner, ws_id, [])
    root_id = await _post_message(api_client, owner, ws_id, channel_id)
    thread_url = f"/api/v1/workspaces/{ws_id}/chat/channels/{channel_id}/messages"
    reply = await api_client.post(
        f"{thread_url}/{root_id}/thread", headers=auth_headers(owner), json={"body": "r1"}
    )
    assert reply.status_code == 201, reply.text

    nested = await api_client.post(
        f"{thread_url}/{reply.json()['id']}/thread",
        headers=auth_headers(owner),
        json={"body": "r2"},
    )
    assert nested.status_code == 404, nested.text


async def test_first_message_author_cannot_delete_channel(api_client: AsyncClient):
    owner, member, ws_id = await _owner_and_member(api_client)
    channel_id = await _create_channel(
        api_client, owner, ws_id, [await user_id(api_client, member)]
    )
    await _post_message(api_client, member, ws_id, channel_id)

    res = await api_client.delete(
        f"/api/v1/workspaces/{ws_id}/chat/channels/{channel_id}",
        headers=auth_headers(member),
    )
    assert res.status_code == 403, res.text


async def test_blank_channel_name_is_rejected(api_client: AsyncClient):
    owner, _, ws_id = await _owner_and_member(api_client)
    res = await api_client.post(
        f"/api/v1/workspaces/{ws_id}/chat/channels",
        headers=auth_headers(owner),
        json={"name": "   "},
    )
    assert res.status_code == 400, res.text


async def test_view_only_member_cannot_rename_list_via_channel(api_client: AsyncClient):
    owner, member, ws_id = await _owner_and_member(api_client)
    member_id = await user_id(api_client, member)
    space_id, list_id = await create_space_list(api_client, owner, ws_id)
    share = await api_client.post(
        f"/api/v1/workspaces/{ws_id}/spaces/{space_id}/members",
        headers=auth_headers(owner),
        json={"userId": member_id, "permissionLevel": "VIEW"},
    )
    assert share.status_code == 201, share.text
    lst = await api_client.get(
        f"/api/v1/workspaces/{ws_id}/lists/{list_id}", headers=auth_headers(owner)
    )
    channel_id = lst.json()["channelId"]

    res = await api_client.patch(
        f"/api/v1/workspaces/{ws_id}/chat/channels/{channel_id}",
        headers=auth_headers(member),
        json={"name": f"renamed-{_suffix()}"},
    )
    assert res.status_code == 403, res.text


async def test_removing_another_channel_member_succeeds(api_client: AsyncClient):
    owner, member, ws_id = await _owner_and_member(api_client)
    member_id = await user_id(api_client, member)
    channel_id = await _create_channel(api_client, owner, ws_id, [member_id])

    res = await api_client.delete(
        f"/api/v1/workspaces/{ws_id}/chat/channels/{channel_id}/members/{member_id}",
        headers=auth_headers(owner),
    )
    assert res.status_code == 200, res.text


async def test_huddle_patch_cannot_end_huddle(api_client: AsyncClient):
    owner, member, ws_id = await _owner_and_member(api_client)
    channel_id = await _create_channel(
        api_client, owner, ws_id, [await user_id(api_client, member)]
    )
    url = f"/api/v1/workspaces/{ws_id}/chat/channels/{channel_id}/huddles"
    started = await api_client.post(f"{url}/start", headers=auth_headers(owner), json={})
    assert started.status_code == 201, started.text
    huddle_id = started.json()["id"]

    res = await api_client.patch(
        f"{url}/{huddle_id}", headers=auth_headers(member), json={"isActive": False}
    )
    assert res.status_code == 200, res.text
    assert res.json()["isActive"] is True


async def test_mark_unread_from_message(api_client: AsyncClient):
    owner, member, ws_id = await _owner_and_member(api_client)
    channel_id = await _create_channel(
        api_client, owner, ws_id, [await user_id(api_client, member)]
    )
    await _post_message(api_client, owner, ws_id, channel_id, "one")
    second = await _post_message(api_client, owner, ws_id, channel_id, "two")
    await _post_message(api_client, owner, ws_id, channel_id, "three")

    res = await api_client.post(
        f"/api/v1/workspaces/{ws_id}/chat/channels/{channel_id}/unread",
        headers=auth_headers(member),
        params={"messageId": second},
    )
    assert res.status_code == 200, res.text
    assert res.json()["unread"] == 2


async def test_mark_dm_unread_from_message(api_client: AsyncClient):
    owner, member, ws_id = await _owner_and_member(api_client)
    dm = await api_client.post(
        f"/api/v1/workspaces/{ws_id}/chat/dms",
        headers=auth_headers(owner),
        json={"userIds": [await user_id(api_client, member)]},
    )
    assert dm.status_code == 201, dm.text
    url = f"/api/v1/workspaces/{ws_id}/chat/dms/{dm.json()['id']}"
    sent = []
    for body in ("one", "two", "three"):
        res = await api_client.post(
            f"{url}/messages", headers=auth_headers(owner), json={"body": body}
        )
        assert res.status_code == 201, res.text
        sent.append(res.json()["id"])

    res = await api_client.post(
        f"{url}/unread", headers=auth_headers(member), params={"messageId": sent[2]}
    )
    assert res.status_code == 200, res.text
    assert res.json()["unread"] == 1


# --- Tasks -----------------------------------------------------------------


async def test_task_list_hides_private_list_inside_shared_space(api_client: AsyncClient):
    owner, member, ws_id = await _owner_and_member(api_client)
    member_id = await user_id(api_client, member)
    space_id, _ = await create_space_list(api_client, owner, ws_id)
    share = await api_client.post(
        f"/api/v1/workspaces/{ws_id}/spaces/{space_id}/members",
        headers=auth_headers(owner),
        json={"userId": member_id, "permissionLevel": "VIEW"},
    )
    assert share.status_code == 201, share.text
    private = await api_client.post(
        f"/api/v1/workspaces/{ws_id}/spaces/{space_id}/lists",
        headers=auth_headers(owner),
        json={"name": "Private", "isPrivate": True},
    )
    assert private.status_code == 201, private.text
    name = f"secret-{_suffix()}"
    await create_task(api_client, owner, ws_id, private.json()["id"], name=name)

    res = await api_client.get(
        f"/api/v1/workspaces/{ws_id}/tasks",
        headers=auth_headers(member),
        params={"search": name},
    )
    assert res.status_code == 200, res.text
    assert res.json()["data"] == []


async def test_deleting_root_comment_removes_its_replies(api_client: AsyncClient):
    owner, _, ws_id = await _owner_and_member(api_client)
    _, list_id = await create_space_list(api_client, owner, ws_id)
    task = await create_task(api_client, owner, ws_id, list_id)
    url = f"/api/v1/workspaces/{ws_id}/tasks/{task['id']}/comments"
    root = await api_client.post(url, headers=auth_headers(owner), json={"body": "root"})
    assert root.status_code == 201, root.text
    async with get_session_factory()() as session:
        root_id = await session.scalar(
            select(TaskComment.id).where(TaskComment.task_id == task["id"])
        )
    reply = await api_client.post(
        url, headers=auth_headers(owner), json={"body": "reply", "parentCommentId": root_id}
    )
    assert reply.status_code == 201, reply.text

    res = await api_client.delete(f"{url}/{root_id}", headers=auth_headers(owner))
    assert res.status_code == 200, res.text
    async with get_session_factory()() as session:
        remaining = (
            await session.scalars(
                select(TaskComment).where(TaskComment.task_id == task["id"])
            )
        ).all()
    assert remaining == []


async def test_timer_can_be_stopped_after_tracking_is_disabled(api_client: AsyncClient):
    owner, member, ws_id = await _owner_and_member(api_client)
    member_id = await user_id(api_client, member)
    space_id, list_id = await create_space_list(api_client, owner, ws_id)
    await api_client.post(
        f"/api/v1/workspaces/{ws_id}/spaces/{space_id}/members",
        headers=auth_headers(owner),
        json={"userId": member_id, "permissionLevel": "EDIT"},
    )
    task = await create_task(api_client, owner, ws_id, list_id)
    perms_url = f"/api/v1/workspaces/{ws_id}/members/{member_id}/permissions"
    time_url = f"/api/v1/workspaces/{ws_id}/tasks/{task['id']}/time"
    try:
        start = await api_client.post(f"{time_url}/start", headers=auth_headers(member))
        assert start.status_code == 200, start.text
        off = await api_client.patch(
            perms_url, headers=auth_headers(owner), json={"canTrackTime": False}
        )
        assert off.status_code == 200, off.text

        stop = await api_client.post(f"{time_url}/stop", headers=auth_headers(member))
        assert stop.status_code == 200, stop.text
    finally:
        await api_client.patch(
            perms_url, headers=auth_headers(owner), json={"canTrackTime": True}
        )
        await api_client.post(f"{time_url}/stop", headers=auth_headers(member))


async def test_malformed_task_dates_return_400(api_client: AsyncClient):
    owner, _, ws_id = await _owner_and_member(api_client)
    _, list_id = await create_space_list(api_client, owner, ws_id)
    created = await api_client.post(
        f"/api/v1/workspaces/{ws_id}/lists/{list_id}/tasks",
        headers=auth_headers(owner),
        json={"name": "bad date", "dueDate": "not-a-date"},
    )
    assert created.status_code == 400, created.text
    task = await create_task(api_client, owner, ws_id, list_id)
    for field in ("dueDate", "startDate"):
        res = await api_client.patch(
            f"/api/v1/workspaces/{ws_id}/tasks/{task['id']}",
            headers=auth_headers(owner),
            json={field: "2026-13-45"},
        )
        assert res.status_code == 400, res.text


async def test_date_order_check_respects_utc_offsets(api_client: AsyncClient):
    owner, _, ws_id = await _owner_and_member(api_client)
    _, list_id = await create_space_list(api_client, owner, ws_id)
    # 10:00+05:00 is 05:00Z, which is before the 06:00Z due date.
    dates = {"startDate": "2026-01-01T10:00:00+05:00", "dueDate": "2026-01-01T06:00:00Z"}
    created = await api_client.post(
        f"/api/v1/workspaces/{ws_id}/lists/{list_id}/tasks",
        headers=auth_headers(owner),
        json={"name": "offset dates", **dates},
    )
    assert created.status_code == 201, created.text
    task = await create_task(api_client, owner, ws_id, list_id)
    patched = await api_client.patch(
        f"/api/v1/workspaces/{ws_id}/tasks/{task['id']}",
        headers=auth_headers(owner),
        json=dates,
    )
    assert patched.status_code == 200, patched.text


async def test_subtask_cannot_move_to_another_list(api_client: AsyncClient):
    owner, _, ws_id = await _owner_and_member(api_client)
    space_id, list_id = await create_space_list(api_client, owner, ws_id)
    other = await api_client.post(
        f"/api/v1/workspaces/{ws_id}/spaces/{space_id}/lists",
        headers=auth_headers(owner),
        json={"name": "Other"},
    )
    parent = await create_task(api_client, owner, ws_id, list_id)
    sub = await api_client.post(
        f"/api/v1/workspaces/{ws_id}/tasks/{parent['id']}/subtasks",
        headers=auth_headers(owner),
        json={"name": "child"},
    )
    assert sub.status_code == 201, sub.text

    res = await api_client.patch(
        f"/api/v1/workspaces/{ws_id}/tasks/{sub.json()['id']}",
        headers=auth_headers(owner),
        json={"listId": other.json()["id"]},
    )
    assert res.status_code == 400, res.text


# --- Invites ---------------------------------------------------------------


async def test_suspended_member_cannot_be_reinvited(api_client: AsyncClient):
    owner, _, ws_id = await _owner_and_member(api_client)
    user = await _create_user(member_of=ws_id)
    async with get_session_factory()() as session:
        await session.execute(
            update(WorkspaceMember)
            .where(WorkspaceMember.workspace_id == ws_id, WorkspaceMember.user_id == user.id)
            .values(status=MemberStatus.SUSPENDED)
        )
        await session.commit()

    res = await api_client.post(
        f"/api/v1/workspaces/{ws_id}/invites",
        headers=auth_headers(owner),
        json={"email": user.email, "role": "MEMBER"},
    )
    assert res.status_code == 409, res.text


async def test_suspended_member_cannot_accept_pending_invite(api_client: AsyncClient):
    owner, _, ws_id = await _owner_and_member(api_client)
    user = await _create_user()
    invite = await api_client.post(
        f"/api/v1/workspaces/{ws_id}/invites",
        headers=auth_headers(owner),
        json={"email": user.email},
    )
    assert invite.status_code == 201, invite.text
    async with get_session_factory()() as session:
        session.add(
            WorkspaceMember(
                workspace_id=ws_id,
                user_id=user.id,
                role=WorkspaceRole.MEMBER,
                status=MemberStatus.SUSPENDED,
            )
        )
        await session.commit()

    res = await api_client.post(
        f"/api/v1/invites/{invite.json()['token']}/accept",
        headers=auth_headers(await login(api_client, user.email, PASSWORD)),
    )
    assert res.status_code == 403, res.text


async def test_second_owner_cannot_be_invited(api_client: AsyncClient):
    owner, _, ws_id = await _owner_and_member(api_client)
    res = await api_client.post(
        f"/api/v1/workspaces/{ws_id}/invites",
        headers=auth_headers(owner),
        json={"email": f"audit-{_suffix()}@example.com", "role": "OWNER"},
    )
    assert res.status_code == 409, res.text


async def test_expired_invite_does_not_block_reinvite(api_client: AsyncClient):
    owner, _, ws_id = await _owner_and_member(api_client)
    email = f"audit-{_suffix()}@example.com"
    url = f"/api/v1/workspaces/{ws_id}/invites"
    first = await api_client.post(url, headers=auth_headers(owner), json={"email": email})
    assert first.status_code == 201, first.text
    async with get_session_factory()() as session:
        await session.execute(
            update(Invite)
            .where(Invite.id == first.json()["id"])
            .values(expires_at=datetime.now(timezone.utc) - timedelta(days=1))
        )
        await session.commit()

    again = await api_client.post(url, headers=auth_headers(owner), json={"email": email})
    assert again.status_code == 201, again.text


# --- Admin portal ------------------------------------------------------------


async def _super_admin(client: AsyncClient) -> tuple[User, str]:
    admin = await _create_user()
    async with get_session_factory()() as session:
        session.add(PlatformStaff(user_id=admin.id, role=PlatformRole.SUPER_ADMIN))
        await session.commit()
    return admin, await login(client, admin.email, PASSWORD)


async def test_super_admin_cannot_disable_self(api_client: AsyncClient):
    admin, token = await _super_admin(api_client)
    res = await api_client.post(
        f"/api/v1/admin/users/{admin.id}/disable", headers=auth_headers(token)
    )
    assert res.status_code == 400, res.text


async def test_admin_reactivate_only_applies_to_suspended_members(api_client: AsyncClient):
    _, token = await _super_admin(api_client)
    owner = await login(api_client, *OWNER)
    ws_id = await workspace_id(api_client, owner)
    user = await _create_user(member_of=ws_id)
    async with get_session_factory()() as session:
        await session.execute(
            update(WorkspaceMember)
            .where(WorkspaceMember.workspace_id == ws_id, WorkspaceMember.user_id == user.id)
            .values(status=MemberStatus.INVITED)
        )
        await session.commit()

    res = await api_client.post(
        f"/api/v1/admin/workspaces/{ws_id}/members/{user.id}/reactivate",
        headers=auth_headers(token),
    )
    assert res.status_code == 400, res.text


async def test_admin_transfer_ownership_by_id_rejects_disabled_user(api_client: AsyncClient):
    _, token = await _super_admin(api_client)
    created = await api_client.post(
        "/api/v1/admin/workspaces",
        headers=auth_headers(token),
        json={"name": f"Audit {_suffix()}"},
    )
    assert created.status_code == 201, created.text
    ws_id = created.json()["id"]
    disabled = await _create_user()
    async with get_session_factory()() as session:
        await session.execute(
            update(User).where(User.id == disabled.id).values(is_disabled=True)
        )
        await session.commit()

    res = await api_client.post(
        f"/api/v1/admin/workspaces/{ws_id}/transfer-ownership",
        headers=auth_headers(token),
        json={"newOwnerUserId": disabled.id},
    )
    assert res.status_code == 400, res.text

