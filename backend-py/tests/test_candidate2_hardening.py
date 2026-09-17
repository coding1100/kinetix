"""Tests for Candidate 2: Workspace Administration, Member Roles & Invites Hardening."""

from __future__ import annotations

import time
import pytest
from httpx import AsyncClient
from sqlalchemy import select

from app.db.session import get_session_factory
from app.db.models.chat import ChatChannel, ChatChannelMember
from app.db.models.home import Space, SpaceMember, TaskList, ListMember, Task
from app.db.models.team import Team, TeamMember
from tests.task_test_helpers import MEMBER, OWNER, create_space_list


async def _login(client: AsyncClient, email: str, password: str) -> str:
    res = await client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": password},
    )
    assert res.status_code == 200, res.text
    return res.json()["accessToken"]


def _auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


@pytest.mark.asyncio(loop_scope="session")
async def test_owner_promotion_and_self_demotion_restrictions(api_client: AsyncClient):
    owner_token = await _login(api_client, *OWNER)
    owner_headers = _auth(owner_token)

    # Create test workspace
    ws_res = await api_client.post(
        "/api/v1/workspaces",
        headers=owner_headers,
        json={"name": f"Admin Roles WS {int(time.time())}"},
    )
    assert ws_res.status_code == 201
    ws_id = ws_res.json()["id"]

    # Invite a member and promote to ADMIN
    test_email = f"admin-target-{int(time.time() * 1000)}@example.com"
    inv_res = await api_client.post(
        f"/api/v1/workspaces/{ws_id}/invites",
        headers=owner_headers,
        json={"email": test_email, "role": "MEMBER"},
    )
    assert inv_res.status_code == 201
    token = inv_res.json()["token"]

    acc_res = await api_client.post(
        f"/api/v1/invites/{token}/accept-signup",
        json={"fullName": "Admin Target", "password": "Password123!"},
    )
    assert acc_res.status_code in (200, 201)
    member_user_id = acc_res.json()["user"]["id"]
    member_token = acc_res.json()["accessToken"]
    member_headers = _auth(member_token)

    # Owner promotes member to ADMIN
    patch_admin = await api_client.patch(
        f"/api/v1/workspaces/{ws_id}/members/{member_user_id}",
        headers=owner_headers,
        json={"role": "ADMIN"},
    )
    assert patch_admin.status_code == 200

    # 1. Attempting to promote to OWNER via member patch is blocked (must use transfer ownership)
    promote_owner = await api_client.patch(
        f"/api/v1/workspaces/{ws_id}/members/{member_user_id}",
        headers=owner_headers,
        json={"role": "OWNER"},
    )
    assert promote_owner.status_code == 400
    assert "transfer ownership" in promote_owner.text.lower()

    # 2. Attempting to change role of OWNER via member patch is blocked
    members_list = await api_client.get(
        f"/api/v1/workspaces/{ws_id}/members",
        headers=owner_headers,
    )
    owner_id = next(m["id"] for m in members_list.json()["data"] if m["role"] == "OWNER")

    demote_owner = await api_client.patch(
        f"/api/v1/workspaces/{ws_id}/members/{owner_id}",
        headers=owner_headers,
        json={"role": "ADMIN"},
    )
    assert demote_owner.status_code == 400
    assert "transfer ownership" in demote_owner.text.lower()

    # 3. Self-role change protection: admin cannot demote themselves via member patch
    self_demote = await api_client.patch(
        f"/api/v1/workspaces/{ws_id}/members/{member_user_id}",
        headers=member_headers,
        json={"role": "MEMBER"},
    )
    assert self_demote.status_code == 400
    assert "cannot change your own role" in self_demote.text.lower()


@pytest.mark.asyncio(loop_scope="session")
async def test_invite_management_permissions_and_lifecycle(api_client: AsyncClient):
    owner_token = await _login(api_client, *OWNER)
    owner_headers = _auth(owner_token)

    ws_res = await api_client.post(
        "/api/v1/workspaces",
        headers=owner_headers,
        json={"name": f"Invite Permissions WS {int(time.time())}"},
    )
    assert ws_res.status_code == 201
    ws_id = ws_res.json()["id"]

    # Create two members: Member A and Member B
    inv_a = await api_client.post(
        f"/api/v1/workspaces/{ws_id}/invites",
        headers=owner_headers,
        json={"email": f"mem-a-{int(time.time() * 1000)}@example.com", "role": "MEMBER"},
    )
    acc_a = await api_client.post(
        f"/api/v1/invites/{inv_a.json()['token']}/accept-signup",
        json={"fullName": "Member A", "password": "Password123!"},
    )
    mem_a_headers = _auth(acc_a.json()["accessToken"])

    inv_b = await api_client.post(
        f"/api/v1/workspaces/{ws_id}/invites",
        headers=owner_headers,
        json={"email": f"mem-b-{int(time.time() * 1000)}@example.com", "role": "MEMBER"},
    )
    acc_b = await api_client.post(
        f"/api/v1/invites/{inv_b.json()['token']}/accept-signup",
        json={"fullName": "Member B", "password": "Password123!"},
    )
    mem_b_headers = _auth(acc_b.json()["accessToken"])

    # Owner creates an invite
    owner_inv = await api_client.post(
        f"/api/v1/workspaces/{ws_id}/invites",
        headers=owner_headers,
        json={"email": f"guest-target-{int(time.time() * 1000)}@example.com", "role": "GUEST"},
    )
    owner_inv_id = owner_inv.json()["id"]

    # Member A tries to cancel Owner's invite -> forbidden (403)
    cancel_forbidden = await api_client.delete(
        f"/api/v1/workspaces/{ws_id}/invites/{owner_inv_id}",
        headers=mem_a_headers,
    )
    assert cancel_forbidden.status_code == 403

    # Member A tries to resend Owner's invite -> forbidden (403)
    resend_forbidden = await api_client.post(
        f"/api/v1/workspaces/{ws_id}/invites/{owner_inv_id}/resend",
        headers=mem_a_headers,
    )
    assert resend_forbidden.status_code == 403

    # Member B creates their own invite
    b_inv = await api_client.post(
        f"/api/v1/workspaces/{ws_id}/invites",
        headers=mem_b_headers,
        json={"email": f"target-b-{int(time.time() * 1000)}@example.com", "role": "GUEST"},
    )
    b_inv_id = b_inv.json()["id"]

    # Member A cannot cancel Member B's invite -> forbidden (403)
    a_cancel_b = await api_client.delete(
        f"/api/v1/workspaces/{ws_id}/invites/{b_inv_id}",
        headers=mem_a_headers,
    )
    assert a_cancel_b.status_code == 403

    # Member B CAN cancel their own invite -> 200
    b_cancel_own = await api_client.delete(
        f"/api/v1/workspaces/{ws_id}/invites/{b_inv_id}",
        headers=mem_b_headers,
    )
    assert b_cancel_own.status_code == 200

    # Accepting a canceled invite returns 410
    accept_canceled = await api_client.post(
        f"/api/v1/invites/{b_inv.json()['token']}/accept-signup",
        json={"fullName": "Cancelled User", "password": "Password123!"},
    )
    assert accept_canceled.status_code == 410


@pytest.mark.asyncio(loop_scope="session")
async def test_member_removal_cascades_and_task_unassignment(api_client: AsyncClient):
    owner_token = await _login(api_client, *OWNER)
    owner_headers = _auth(owner_token)

    ws_res = await api_client.post(
        "/api/v1/workspaces",
        headers=owner_headers,
        json={"name": f"Cascade WS {int(time.time())}"},
    )
    assert ws_res.status_code == 201
    ws_id = ws_res.json()["id"]

    # Invite user to be offboarded
    offboard_email = f"offboard-{int(time.time() * 1000)}@example.com"
    inv_res = await api_client.post(
        f"/api/v1/workspaces/{ws_id}/invites",
        headers=owner_headers,
        json={"email": offboard_email, "role": "MEMBER"},
    )
    acc_res = await api_client.post(
        f"/api/v1/invites/{inv_res.json()['token']}/accept-signup",
        json={"fullName": "Offboard Target", "password": "Password123!"},
    )
    target_user_id = acc_res.json()["user"]["id"]

    # Create Space, List, and Task assigned to target_user_id
    space_id, list_id = await create_space_list(api_client, owner_token, ws_id)
    task_res = await api_client.post(
        f"/api/v1/workspaces/{ws_id}/lists/{list_id}/tasks",
        headers=owner_headers,
        json={
            "name": "Cascade test task",
            "assigneeIds": [target_user_id],
        },
    )
    assert task_res.status_code == 201
    task_id = task_res.json()["id"]

    # Create a Team and add target_user_id to it
    team_res = await api_client.post(
        f"/api/v1/workspaces/{ws_id}/teams",
        headers=owner_headers,
        json={"name": "Cascade Test Team"},
    )
    assert team_res.status_code == 201
    team_id = team_res.json()["id"]

    add_team_mem = await api_client.post(
        f"/api/v1/workspaces/{ws_id}/teams/{team_id}/members",
        headers=owner_headers,
        json={"userId": target_user_id, "role": "MEMBER"},
    )
    assert add_team_mem.status_code in (200, 201)

    # In DB directly: add SpaceMember, ListMember, and ChatChannelMember for target_user_id
    factory = get_session_factory()
    async with factory() as session:
        # Chat channel
        channel = ChatChannel(
            workspace_id=ws_id,
            name="cascade-channel",
            is_private=True,
        )
        session.add(channel)
        await session.flush()
        session.add(
            ChatChannelMember(
                channel_id=channel.id,
                user_id=target_user_id,
            )
        )
        # SpaceMember
        session.add(
            SpaceMember(
                space_id=space_id,
                user_id=target_user_id,
                permission_level="EDIT",
            )
        )
        # ListMember
        session.add(
            ListMember(
                list_id=list_id,
                user_id=target_user_id,
                permission_level="EDIT",
            )
        )
        await session.commit()

    # Verify rows exist before removal
    async with factory() as session:
        tm = await session.scalar(
            select(TeamMember).where(TeamMember.team_id == team_id, TeamMember.user_id == target_user_id)
        )
        assert tm is not None
        sm = await session.scalar(
            select(SpaceMember).where(SpaceMember.space_id == space_id, SpaceMember.user_id == target_user_id)
        )
        assert sm is not None
        lm = await session.scalar(
            select(ListMember).where(ListMember.list_id == list_id, ListMember.user_id == target_user_id)
        )
        assert lm is not None
        cm = await session.scalar(
            select(ChatChannelMember).where(ChatChannelMember.user_id == target_user_id)
        )
        assert cm is not None

    # Remove the member from the workspace
    remove_res = await api_client.delete(
        f"/api/v1/workspaces/{ws_id}/members/{target_user_id}",
        headers=owner_headers,
    )
    assert remove_res.status_code == 200

    # Verify all associations have cascaded away and task has unassigned the user
    async with factory() as session:
        tm_after = await session.scalar(
            select(TeamMember).where(TeamMember.team_id == team_id, TeamMember.user_id == target_user_id)
        )
        assert tm_after is None

        sm_after = await session.scalar(
            select(SpaceMember).where(SpaceMember.space_id == space_id, SpaceMember.user_id == target_user_id)
        )
        assert sm_after is None

        lm_after = await session.scalar(
            select(ListMember).where(ListMember.list_id == list_id, ListMember.user_id == target_user_id)
        )
        assert lm_after is None

        cm_after = await session.scalar(
            select(ChatChannelMember).where(ChatChannelMember.user_id == target_user_id)
        )
        assert cm_after is None

        # Verify task assignee unassigned
        t_after = await session.get(Task, task_id)
        assert t_after is not None
        assert target_user_id not in t_after.assignee_ids
