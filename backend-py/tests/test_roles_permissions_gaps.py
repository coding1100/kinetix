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
    return owner_headers, member_headers, ws_id, owner_user_id, member_user_id


@pytest.mark.asyncio(loop_scope="session")
async def test_admin_role_assignment_ceiling(api_client: AsyncClient):
    owner_headers, member_headers, ws_id, owner_user_id, member_user_id = (
        await _context(api_client)
    )

    await _set_role(api_client, owner_headers, ws_id, member_user_id, "ADMIN")
    try:
        # ADMIN cannot touch the owner's role at all.
        demote_owner = await api_client.patch(
            f"/api/v1/workspaces/{ws_id}/members/{owner_user_id}",
            headers=member_headers,
            json={"role": "MEMBER"},
        )
        assert demote_owner.status_code == 403, demote_owner.text

        # ADMIN cannot assign ADMIN or SUPER_ADMIN (even to themselves).
        for role in ("ADMIN", "SUPER_ADMIN", "OWNER"):
            escalate = await api_client.patch(
                f"/api/v1/workspaces/{ws_id}/members/{member_user_id}",
                headers=member_headers,
                json={"role": role},
            )
            assert escalate.status_code == 403, f"{role}: {escalate.text}"

        # ADMIN invites: MEMBER/GUEST/LIMITED_MEMBER fine, ADMIN+ blocked.
        suffix = int(time.time() * 1000)
        for role in ("MEMBER", "GUEST", "LIMITED_MEMBER"):
            ok = await api_client.post(
                f"/api/v1/workspaces/{ws_id}/invites",
                headers=member_headers,
                json={"email": f"adm-inv-{role.lower()}-{suffix}@example.com", "role": role},
            )
            assert ok.status_code == 201, f"{role}: {ok.text}"
        blocked = await api_client.post(
            f"/api/v1/workspaces/{ws_id}/invites",
            headers=member_headers,
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
    try:
        as_admin = await api_client.delete(
            f"/api/v1/workspaces/{ws_id}/members/{owner_user_id}",
            headers=member_headers,
        )
        assert as_admin.status_code == 403, as_admin.text
    finally:
        await _set_role(api_client, owner_headers, ws_id, member_user_id, "MEMBER")


@pytest.mark.asyncio(loop_scope="session")
async def test_guest_and_limited_member_restrictions(api_client: AsyncClient):
    owner_headers, member_headers, ws_id, _, member_user_id = await _context(
        api_client
    )

    suffix = int(time.time() * 1000)
    for role in ("GUEST", "LIMITED_MEMBER"):
        await _set_role(api_client, owner_headers, ws_id, member_user_id, role)
        try:
            invite = await api_client.post(
                f"/api/v1/workspaces/{ws_id}/invites",
                headers=member_headers,
                json={"email": f"nope-{role.lower()}-{suffix}@example.com", "role": "MEMBER"},
            )
            assert invite.status_code == 403, f"{role}: {invite.text}"

            space = await api_client.post(
                f"/api/v1/workspaces/{ws_id}/spaces",
                headers=member_headers,
                json={"name": f"Should Fail {role} {suffix}"},
            )
            assert space.status_code == 403, f"{role}: {space.text}"

            promote = await api_client.patch(
                f"/api/v1/workspaces/{ws_id}/members/{member_user_id}",
                headers=member_headers,
                json={"role": "MEMBER"},
            )
            assert promote.status_code == 403, f"{role}: {promote.text}"
        finally:
            await _set_role(api_client, owner_headers, ws_id, member_user_id, "MEMBER")


@pytest.mark.asyncio(loop_scope="session")
async def test_private_space_hidden_from_regular_member(api_client: AsyncClient):
    owner_headers, member_headers, ws_id, _, _ = await _context(api_client)

    suffix = int(time.time() * 1000)
    space = await api_client.post(
        f"/api/v1/workspaces/{ws_id}/spaces",
        headers=owner_headers,
        json={"name": f"Owner Private {suffix}", "isPrivate": True},
    )
    assert space.status_code == 201, space.text
    space_id = space.json()["id"]

    try:
        listed = await api_client.get(
            f"/api/v1/workspaces/{ws_id}/spaces", headers=member_headers
        )
        assert listed.status_code == 200, listed.text
        assert space_id not in [s["id"] for s in listed.json()["data"]]

        direct = await api_client.get(
            f"/api/v1/workspaces/{ws_id}/spaces/{space_id}", headers=member_headers
        )
        assert direct.status_code == 403, direct.text

        # Owner keeps access via the explicit creator grant.
        owner_view = await api_client.get(
            f"/api/v1/workspaces/{ws_id}/spaces/{space_id}", headers=owner_headers
        )
        assert owner_view.status_code == 200, owner_view.text
    finally:
        await api_client.delete(
            f"/api/v1/workspaces/{ws_id}/spaces/{space_id}", headers=owner_headers
        )


@pytest.mark.asyncio(loop_scope="session")
async def test_comment_and_view_overrides_on_private_space(api_client: AsyncClient):
    owner_headers, member_headers, ws_id, _, member_user_id = await _context(
        api_client
    )

    suffix = int(time.time() * 1000)
    space = await api_client.post(
        f"/api/v1/workspaces/{ws_id}/spaces",
        headers=owner_headers,
        json={"name": f"Override Space {suffix}", "isPrivate": True},
    )
    assert space.status_code == 201, space.text
    space_id = space.json()["id"]

    try:
        lst = await api_client.post(
            f"/api/v1/workspaces/{ws_id}/spaces/{space_id}/lists",
            headers=owner_headers,
            json={"name": "Override List"},
        )
        assert lst.status_code == 201, lst.text
        list_id = lst.json()["id"]

        task = await api_client.post(
            f"/api/v1/workspaces/{ws_id}/lists/{list_id}/tasks",
            headers=owner_headers,
            json={"name": "Override task"},
        )
        assert task.status_code == 201, task.text
        task_id = task.json()["id"]

        # COMMENT override: can view + comment, cannot edit content.
        grant = await api_client.post(
            f"/api/v1/workspaces/{ws_id}/spaces/{space_id}/members",
            headers=owner_headers,
            json={"userId": member_user_id, "permissionLevel": "COMMENT"},
        )
        assert grant.status_code == 201, grant.text

        view = await api_client.get(
            f"/api/v1/workspaces/{ws_id}/spaces/{space_id}", headers=member_headers
        )
        assert view.status_code == 200, view.text

        comment = await api_client.post(
            f"/api/v1/workspaces/{ws_id}/tasks/{task_id}/comments",
            headers=member_headers,
            json={"body": "Commenter checking in"},
        )
        assert comment.status_code == 201, comment.text

        edit_task = await api_client.patch(
            f"/api/v1/workspaces/{ws_id}/tasks/{task_id}",
            headers=member_headers,
            json={"name": "Should not rename"},
        )
        assert edit_task.status_code == 403, edit_task.text

        folder = await api_client.post(
            f"/api/v1/workspaces/{ws_id}/spaces/{space_id}/folders",
            headers=member_headers,
            json={"name": "Nope"},
        )
        assert folder.status_code == 403, folder.text

        # Downgrade to VIEW: still sees the Space, but commenting is blocked.
        downgrade = await api_client.post(
            f"/api/v1/workspaces/{ws_id}/spaces/{space_id}/members",
            headers=owner_headers,
            json={"userId": member_user_id, "permissionLevel": "VIEW"},
        )
        assert downgrade.status_code == 201, downgrade.text

        still_view = await api_client.get(
            f"/api/v1/workspaces/{ws_id}/spaces/{space_id}", headers=member_headers
        )
        assert still_view.status_code == 200, still_view.text

        blocked_comment = await api_client.post(
            f"/api/v1/workspaces/{ws_id}/tasks/{task_id}/comments",
            headers=member_headers,
            json={"body": "Viewer should be blocked"},
        )
        assert blocked_comment.status_code == 403, blocked_comment.text

        # Removing the override drops private-space access entirely.
        removed = await api_client.delete(
            f"/api/v1/workspaces/{ws_id}/spaces/{space_id}/members/{member_user_id}",
            headers=owner_headers,
        )
        assert removed.status_code == 200, removed.text

        gone = await api_client.get(
            f"/api/v1/workspaces/{ws_id}/spaces/{space_id}", headers=member_headers
        )
        assert gone.status_code == 403, gone.text
    finally:
        await api_client.delete(
            f"/api/v1/workspaces/{ws_id}/spaces/{space_id}", headers=owner_headers
        )


@pytest.mark.asyncio(loop_scope="session")
async def test_member_cannot_toggle_time_permissions(api_client: AsyncClient):
    _, member_headers, ws_id, owner_user_id, _ = await _context(api_client)

    res = await api_client.patch(
        f"/api/v1/workspaces/{ws_id}/members/{owner_user_id}/permissions",
        headers=member_headers,
        json={"canTrackTime": False},
    )
    assert res.status_code == 403, res.text


@pytest.mark.asyncio(loop_scope="session")
async def test_transfer_ownership_rules_and_roundtrip(api_client: AsyncClient):
    owner_headers, member_headers, ws_id, owner_user_id, member_user_id = (
        await _context(api_client)
    )

    # Owner cannot transfer to themselves.
    to_self = await api_client.post(
        f"/api/v1/workspaces/{ws_id}/transfer-ownership",
        headers=owner_headers,
        json={"newOwnerUserId": owner_user_id},
    )
    assert to_self.status_code == 400, to_self.text

    # Plain MEMBER cannot initiate a transfer.
    as_member = await api_client.post(
        f"/api/v1/workspaces/{ws_id}/transfer-ownership",
        headers=member_headers,
        json={"newOwnerUserId": owner_user_id},
    )
    assert as_member.status_code == 403, as_member.text

    # Full roundtrip: owner -> member, verify roles, then transfer back.
    transferred = False
    try:
        transfer = await api_client.post(
            f"/api/v1/workspaces/{ws_id}/transfer-ownership",
            headers=owner_headers,
            json={"newOwnerUserId": member_user_id},
        )
        assert transfer.status_code == 200, transfer.text
        transferred = True

        member_ws = await api_client.get(
            f"/api/v1/workspaces/{ws_id}", headers=member_headers
        )
        assert member_ws.status_code == 200, member_ws.text
        assert member_ws.json()["role"] == "OWNER"

        owner_ws = await api_client.get(
            f"/api/v1/workspaces/{ws_id}", headers=owner_headers
        )
        assert owner_ws.status_code == 200, owner_ws.text
        assert owner_ws.json()["role"] == "ADMIN"

        # Previous owner (now ADMIN) can no longer transfer ownership.
        old_owner_try = await api_client.post(
            f"/api/v1/workspaces/{ws_id}/transfer-ownership",
            headers=owner_headers,
            json={"newOwnerUserId": member_user_id},
        )
        assert old_owner_try.status_code == 403, old_owner_try.text
    finally:
        if transferred:
            back = await api_client.post(
                f"/api/v1/workspaces/{ws_id}/transfer-ownership",
                headers=member_headers,
                json={"newOwnerUserId": owner_user_id},
            )
            assert back.status_code == 200, back.text
            # Transfer-back left the member as ADMIN; reset to MEMBER.
            await _set_role(
                api_client, owner_headers, ws_id, member_user_id, "MEMBER"
            )


@pytest.mark.asyncio(loop_scope="session")
async def test_workspace_rename_requires_admin(api_client: AsyncClient):
    _, member_headers, ws_id, _, _ = await _context(api_client)

    res = await api_client.patch(
        f"/api/v1/workspaces/{ws_id}",
        headers=member_headers,
        json={"name": "Renamed By Member"},
    )
    assert res.status_code == 403, res.text


@pytest.mark.asyncio(loop_scope="session")
async def test_delete_workspace_gates(api_client: AsyncClient):
    owner_headers, member_headers, _, _, _ = await _context(api_client)

    suffix = int(time.time() * 1000)
    name = f"Perm Delete Test {suffix}"
    created = await api_client.post(
        "/api/v1/workspaces", headers=owner_headers, json={"name": name}
    )
    assert created.status_code == 201, created.text
    new_ws_id = created.json()["id"]

    # Non-member (and non-owner) cannot delete.
    as_member = await api_client.request(
        "DELETE",
        f"/api/v1/workspaces/{new_ws_id}",
        headers=member_headers,
        json={"confirmName": name},
    )
    assert as_member.status_code == 403, as_member.text

    # Owner with wrong confirmation name is rejected.
    wrong_name = await api_client.request(
        "DELETE",
        f"/api/v1/workspaces/{new_ws_id}",
        headers=owner_headers,
        json={"confirmName": "not the name"},
    )
    assert wrong_name.status_code == 400, wrong_name.text

    # Owner with matching confirmation succeeds.
    deleted = await api_client.request(
        "DELETE",
        f"/api/v1/workspaces/{new_ws_id}",
        headers=owner_headers,
        json={"confirmName": name},
    )
    assert deleted.status_code == 200, deleted.text
    assert deleted.json()["ok"] is True
