"""Space-level content permissions (SpaceMember ACL) and the MEMBER invite fix."""

from __future__ import annotations

import time

import pytest
from httpx import AsyncClient

from tests.task_test_helpers import MEMBER, OWNER, auth_headers, login, user_id, workspace_id


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


@pytest.mark.asyncio(loop_scope="session")
async def test_member_can_invite_as_member(api_client: AsyncClient):
    owner_token = await login(api_client, *OWNER)
    owner_headers = auth_headers(owner_token)
    member_token = await login(api_client, *MEMBER)
    member_headers = auth_headers(member_token)
    ws_id = await workspace_id(api_client, owner_token)

    suffix = int(time.time() * 1000)
    res = await api_client.post(
        f"/api/v1/workspaces/{ws_id}/invites",
        headers=member_headers,
        json={"email": f"invitee-{suffix}@example.com", "role": "MEMBER"},
    )
    assert res.status_code == 201, res.text

    # A MEMBER still can't invite someone in above their own station.
    escalation = await api_client.post(
        f"/api/v1/workspaces/{ws_id}/invites",
        headers=member_headers,
        json={"email": f"escalate-{suffix}@example.com", "role": "ADMIN"},
    )
    assert escalation.status_code == 403, escalation.text


@pytest.mark.asyncio(loop_scope="session")
async def test_guest_has_no_default_space_access(api_client: AsyncClient):
    owner_token = await login(api_client, *OWNER)
    owner_headers = auth_headers(owner_token)
    member_token = await login(api_client, *MEMBER)
    member_headers = auth_headers(member_token)
    ws_id = await workspace_id(api_client, owner_token)
    member_user_id = await user_id(api_client, member_token)

    suffix = int(time.time() * 1000)
    space = await api_client.post(
        f"/api/v1/workspaces/{ws_id}/spaces",
        headers=owner_headers,
        json={"name": f"Guest Test Space {suffix}"},
    )
    assert space.status_code == 201, space.text
    space_id = space.json()["id"]

    await _set_role(api_client, owner_headers, ws_id, member_user_id, "GUEST")
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

        folder = await api_client.post(
            f"/api/v1/workspaces/{ws_id}/spaces/{space_id}/folders",
            headers=member_headers,
            json={"name": "Nope"},
        )
        assert folder.status_code == 403, folder.text
    finally:
        await _set_role(api_client, owner_headers, ws_id, member_user_id, "MEMBER")


@pytest.mark.asyncio(loop_scope="session")
async def test_limited_member_is_view_only_on_public_space(api_client: AsyncClient):
    owner_token = await login(api_client, *OWNER)
    owner_headers = auth_headers(owner_token)
    member_token = await login(api_client, *MEMBER)
    member_headers = auth_headers(member_token)
    ws_id = await workspace_id(api_client, owner_token)
    member_user_id = await user_id(api_client, member_token)

    suffix = int(time.time() * 1000)
    space = await api_client.post(
        f"/api/v1/workspaces/{ws_id}/spaces",
        headers=owner_headers,
        json={"name": f"Limited Test Space {suffix}"},
    )
    assert space.status_code == 201, space.text
    space_id = space.json()["id"]

    await _set_role(api_client, owner_headers, ws_id, member_user_id, "LIMITED_MEMBER")
    try:
        direct = await api_client.get(
            f"/api/v1/workspaces/{ws_id}/spaces/{space_id}", headers=member_headers
        )
        assert direct.status_code == 200, direct.text

        folder = await api_client.post(
            f"/api/v1/workspaces/{ws_id}/spaces/{space_id}/folders",
            headers=member_headers,
            json={"name": "Nope"},
        )
        assert folder.status_code == 403, folder.text
    finally:
        await _set_role(api_client, owner_headers, ws_id, member_user_id, "MEMBER")


@pytest.mark.asyncio(loop_scope="session")
async def test_private_space_override_grants_guest_access(api_client: AsyncClient):
    owner_token = await login(api_client, *OWNER)
    owner_headers = auth_headers(owner_token)
    member_token = await login(api_client, *MEMBER)
    member_headers = auth_headers(member_token)
    ws_id = await workspace_id(api_client, owner_token)
    member_user_id = await user_id(api_client, member_token)

    suffix = int(time.time() * 1000)
    space = await api_client.post(
        f"/api/v1/workspaces/{ws_id}/spaces",
        headers=owner_headers,
        json={"name": f"Private Test Space {suffix}", "isPrivate": True},
    )
    assert space.status_code == 201, space.text
    space_id = space.json()["id"]

    await _set_role(api_client, owner_headers, ws_id, member_user_id, "GUEST")
    try:
        blocked = await api_client.get(
            f"/api/v1/workspaces/{ws_id}/spaces/{space_id}", headers=member_headers
        )
        assert blocked.status_code == 403, blocked.text

        grant = await api_client.post(
            f"/api/v1/workspaces/{ws_id}/spaces/{space_id}/members",
            headers=owner_headers,
            json={"userId": member_user_id, "permissionLevel": "EDIT"},
        )
        assert grant.status_code == 201, grant.text

        allowed = await api_client.get(
            f"/api/v1/workspaces/{ws_id}/spaces/{space_id}", headers=member_headers
        )
        assert allowed.status_code == 200, allowed.text

        folder = await api_client.post(
            f"/api/v1/workspaces/{ws_id}/spaces/{space_id}/folders",
            headers=member_headers,
            json={"name": "Now allowed"},
        )
        assert folder.status_code == 201, folder.text
    finally:
        await _set_role(api_client, owner_headers, ws_id, member_user_id, "MEMBER")
