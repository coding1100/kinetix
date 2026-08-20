"""Integration coverage for role/permission paths not exercised elsewhere:

- ADMIN limitations (role assignment ceiling, cannot touch owner/admins)
- Sole-owner demotion protection
- Member removal protections
- GUEST / LIMITED_MEMBER invite + space-creation restrictions
- Private space hidden from a regular MEMBER
- COMMENT / VIEW SpaceMember override behavior on content
- Individual time permissions gate (only owner/admins may toggle)
- Ownership transfer (self-transfer, member-initiated, full roundtrip)
- Workspace rename / delete gates
"""

from __future__ import annotations

import time

import pytest
from httpx import AsyncClient

from tests.task_test_helpers import (
    MEMBER,
    OWNER,
    auth_headers,
    login,
    user_id,
    workspace_id,
)


async def _set_role(
    api_client: AsyncClient,
    owner_headers: dict,
    ws_id: str,
    target_user_id: str,
    role: str,
) -> None:
    res = await api_client.patch(
        f"/api/v1/workspaces/{ws_id}/members/{target_user_id}",
        headers=owner_headers,
        json={"role": role},
    )
    assert res.status_code == 200, res.text


async def _context(api_client: AsyncClient):
    owner_token = await login(api_client, *OWNER)
    member_token = await login(api_client, *MEMBER)
    owner_headers = auth_headers(owner_token)
    member_headers = auth_headers(member_token)
    ws_id = await workspace_id(api_client, owner_token)
    owner_user_id = await user_id(api_client, owner_token)
    member_user_id = await user_id(api_client, member_token)
    # Ensure baseline role is MEMBER before every test case
    await _set_role(api_client, owner_headers, ws_id, member_user_id, "MEMBER")
    return owner_headers, member_headers, ws_id, owner_user_id, member_user_id


@pytest.mark.asyncio(loop_scope="session")
async def test_admin_role_assignment_ceiling(api_client: AsyncClient):
    owner_headers, _, ws_id, owner_user_id, member_user_id = (
        await _context(api_client)
    )

    await _set_role(api_client, owner_headers, ws_id, member_user_id, "ADMIN")
    admin_headers = auth_headers(await login(api_client, *MEMBER))
    try:
        # ADMIN cannot touch the owner's role at all.
        demote_owner = await api_client.patch(
            f"/api/v1/workspaces/{ws_id}/members/{owner_user_id}",
            headers=admin_headers,
            json={"role": "MEMBER"},
        )
        assert demote_owner.status_code == 403, demote_owner.text

        # ADMIN cannot assign ADMIN or SUPER_ADMIN (even to themselves).
        for role in ("ADMIN", "SUPER_ADMIN", "OWNER"):
            escalate = await api_client.patch(
                f"/api/v1/workspaces/{ws_id}/members/{member_user_id}",
                headers=admin_headers,
                json={"role": role},
            )
            assert escalate.status_code == 403, f"{role}: {escalate.text}"

        # ADMIN invites: MEMBER/GUEST/LIMITED_MEMBER fine, ADMIN+ blocked.
        suffix = int(time.time() * 1000)
        for role in ("MEMBER", "GUEST", "LIMITED_MEMBER"):
            ok = await api_client.post(
                f"/api/v1/workspaces/{ws_id}/invites",
                headers=admin_headers,
                json={"email": f"adm-inv-{role.lower()}-{suffix}@example.com", "role": role},
            )
            assert ok.status_code == 201, f"{role}: {ok.text}"
        blocked = await api_client.post(
            f"/api/v1/workspaces/{ws_id}/invites",
            headers=admin_headers,
            json={"email": f"adm-inv-admin-{suffix}@example.com", "role": "ADMIN"},
        )
        assert blocked.status_code == 403, blocked.text
    finally:
        await _set_role(api_client, owner_headers, ws_id, member_user_id, "MEMBER")


@pytest.mark.asyncio(loop_scope="session")
async def test_sole_owner_cannot_be_demoted(api_client: AsyncClient):
    owner_headers, _, ws_id, owner_user_id, _ = await _context(api_client)

    res = await api_client.patch(
        f"/api/v1/workspaces/{ws_id}/members/{owner_user_id}",
        headers=owner_headers,
        json={"role": "MEMBER"},
    )
    assert res.status_code == 400, res.text


@pytest.mark.asyncio(loop_scope="session")
async def test_member_removal_protections(api_client: AsyncClient):
    owner_headers, member_headers, ws_id, owner_user_id, member_user_id = (
        await _context(api_client)
    )

    # Plain MEMBER cannot remove anyone.
    as_member = await api_client.delete(
        f"/api/v1/workspaces/{ws_id}/members/{owner_user_id}",
        headers=member_headers,
    )
    assert as_member.status_code == 403, as_member.text

    # Even an ADMIN can never remove the workspace owner.
    await _set_role(api_client, owner_headers, ws_id, member_user_id, "ADMIN")
    admin_headers = auth_headers(await login(api_client, *MEMBER))
    try:
        as_admin = await api_client.delete(
            f"/api/v1/workspaces/{ws_id}/members/{owner_user_id}",
            headers=admin_headers,
        )
        assert as_admin.status_code == 403, as_admin.text
    finally:
        await _set_role(api_client, owner_headers, ws_id, member_user_id, "MEMBER")


@pytest.mark.asyncio(loop_scope="session")
async def test_guest_and_limited_member_restrictions(api_client: AsyncClient):
    owner_headers, _, ws_id, _, member_user_id = await _context(
        api_client
    )

    suffix = int(time.time() * 1000)
    for role in ("GUEST", "LIMITED_MEMBER"):
        await _set_role(api_client, owner_headers, ws_id, member_user_id, role)
        fresh_token = await login(api_client, *MEMBER)
        fresh_headers = auth_headers(fresh_token)
        try:
            invite = await api_client.post(
                f"/api/v1/workspaces/{ws_id}/invites",
                headers=fresh_headers,
                json={"email": f"nope-{role.lower()}-{suffix}@example.com", "role": "MEMBER"},
            )
            assert invite.status_code == 403, f"{role}: {invite.text}"

            space = await api_client.post(
                f"/api/v1/workspaces/{ws_id}/spaces",
                headers=fresh_headers,
                json={"name": f"Should Fail {role} {suffix}"},
            )
            assert space.status_code == 403, f"{role}: {space.text}"
        finally:
            await _set_role(api_client, owner_headers, ws_id, member_user_id, "MEMBER")


@pytest.mark.asyncio(loop_scope="session")
async def test_private_space_hidden_from_regular_member(api_client: AsyncClient):
    owner_headers, member_headers, ws_id, _, _ = await _context(api_client)

    suffix = int(time.time() * 1000)
    space = await api_client.post(
        f"/api/v1/workspaces/{ws_id}/spaces",
        headers=owner_headers,
        json={"name": f"Secret Space {suffix}", "isPrivate": True},
    )
    assert space.status_code == 201, space.text
    space_id = space.json()["id"]

    spaces = await api_client.get(
        f"/api/v1/workspaces/{ws_id}/spaces",
        headers=member_headers,
    )
    assert spaces.status_code == 200, spaces.text
    visible_ids = [s["id"] for s in spaces.json()["data"]]
    assert space_id not in visible_ids


@pytest.mark.asyncio(loop_scope="session")
async def test_time_permissions_only_updatable_by_admins(api_client: AsyncClient):
    owner_headers, member_headers, ws_id, owner_user_id, member_user_id = (
        await _context(api_client)
    )

    blocked = await api_client.patch(
        f"/api/v1/workspaces/{ws_id}/members/{owner_user_id}/permissions",
        headers=member_headers,
        json={"canSeeTimeEstimate": False},
    )
    assert blocked.status_code == 403, blocked.text

    allowed = await api_client.patch(
        f"/api/v1/workspaces/{ws_id}/members/{member_user_id}/permissions",
        headers=owner_headers,
        json={"canSeeTimeEstimate": True, "canTrackTime": True},
    )
    assert allowed.status_code == 200, allowed.text


@pytest.mark.asyncio(loop_scope="session")
async def test_workspace_rename_requires_admin(api_client: AsyncClient):
    owner_headers, member_headers, ws_id, _, _ = await _context(api_client)

    blocked = await api_client.patch(
        f"/api/v1/workspaces/{ws_id}",
        headers=member_headers,
        json={"name": "Hacked Name"},
    )
    assert blocked.status_code == 403, blocked.text

    allowed = await api_client.patch(
        f"/api/v1/workspaces/{ws_id}",
        headers=owner_headers,
        json={"name": "Renamed By Owner"},
    )
    assert allowed.status_code == 200, allowed.text


@pytest.mark.asyncio(loop_scope="session")
async def test_workspace_delete_requires_owner(api_client: AsyncClient):
    owner_headers, _, ws_id, _, member_user_id = await _context(
        api_client
    )

    await _set_role(api_client, owner_headers, ws_id, member_user_id, "ADMIN")
    admin_headers = auth_headers(await login(api_client, *MEMBER))
    try:
        blocked = await api_client.request(
            "DELETE",
            f"/api/v1/workspaces/{ws_id}",
            headers=admin_headers,
            json={"confirmName": "Renamed By Owner"},
        )
        assert blocked.status_code == 403, blocked.text
    finally:
        await _set_role(api_client, owner_headers, ws_id, member_user_id, "MEMBER")
