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
async def test_private_space_override_grants_limited_member_access(
    api_client: AsyncClient,
):
    """Was test_private_space_override_grants_guest_access. Intentionally
    changed: real ClickUp never lets a Guest be shared a whole Space (only
    a Folder/List/Task, see test_guest_cannot_be_given_space_access_but_can_
    be_given_list_access below) - a SpaceMember override for a GUEST target
    is now rejected (see add_space_member's guest check,
    spaces_service.py). The override mechanism itself is still exercised
    here, just with LIMITED_MEMBER, a role ClickUp does allow to be granted
    Space access this way."""
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

    await _set_role(api_client, owner_headers, ws_id, member_user_id, "LIMITED_MEMBER")
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


@pytest.mark.asyncio(loop_scope="session")
async def test_list_only_share_masks_private_space_name(api_client: AsyncClient):
    owner_token = await login(api_client, *OWNER)
    owner_headers = auth_headers(owner_token)
    member_token = await login(api_client, *MEMBER)
    member_headers = auth_headers(member_token)
    ws_id = await workspace_id(api_client, owner_token)
    member_user_id = await user_id(api_client, member_token)

    suffix = int(time.time() * 1000)
    space_name = f"Private List-Share Space {suffix}"
    space = await api_client.post(
        f"/api/v1/workspaces/{ws_id}/spaces",
        headers=owner_headers,
        json={"name": space_name, "isPrivate": True},
    )
    assert space.status_code == 201, space.text
    space_id = space.json()["id"]

    lst = await api_client.post(
        f"/api/v1/workspaces/{ws_id}/spaces/{space_id}/lists",
        headers=owner_headers,
        json={"name": "Only list shared"},
    )
    assert lst.status_code == 201, lst.text
    list_id = lst.json()["id"]

    await _set_role(api_client, owner_headers, ws_id, member_user_id, "GUEST")
    try:
        blocked = await api_client.get(
            f"/api/v1/workspaces/{ws_id}/lists/{list_id}", headers=member_headers
        )
        assert blocked.status_code == 403, blocked.text

        share = await api_client.post(
            f"/api/v1/workspaces/{ws_id}/lists/{list_id}/members",
            headers=owner_headers,
            json={"userId": member_user_id, "permissionLevel": "EDIT"},
        )
        assert share.status_code == 201, share.text

        guest_view = await api_client.get(
            f"/api/v1/workspaces/{ws_id}/lists/{list_id}", headers=member_headers
        )
        assert guest_view.status_code == 200, guest_view.text
        guest_space = guest_view.json()["space"]
        assert guest_space["name"] == "Shared with me"
        assert guest_space["accessible"] is False

        owner_view = await api_client.get(
            f"/api/v1/workspaces/{ws_id}/lists/{list_id}", headers=owner_headers
        )
        assert owner_view.status_code == 200, owner_view.text
        owner_space = owner_view.json()["space"]
        assert owner_space["name"] == space_name
        assert owner_space["accessible"] is True
    finally:
        await _set_role(api_client, owner_headers, ws_id, member_user_id, "MEMBER")


@pytest.mark.asyncio(loop_scope="session")
async def test_only_admin_can_manage_space_folder_list_members(
    api_client: AsyncClient,
):
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
        json={"name": f"Admin Gate Space {suffix}"},
    )
    assert space.status_code == 201, space.text
    space_id = space.json()["id"]

    folder = await api_client.post(
        f"/api/v1/workspaces/{ws_id}/spaces/{space_id}/folders",
        headers=owner_headers,
        json={"name": "Admin Gate Folder"},
    )
    assert folder.status_code == 201, folder.text
    folder_id = folder.json()["id"]

    lst = await api_client.post(
        f"/api/v1/workspaces/{ws_id}/spaces/{space_id}/lists",
        headers=owner_headers,
        json={"name": "Admin Gate List"},
    )
    assert lst.status_code == 201, lst.text
    list_id = lst.json()["id"]

    # Plain MEMBER already has ambient EDIT on this public space (default
    # role level) - that's not enough anymore to manage sharing.
    for path in (
        f"/spaces/{space_id}/members",
        f"/folders/{folder_id}/members",
        f"/lists/{list_id}/members",
    ):
        blocked = await api_client.post(
            f"/api/v1/workspaces/{ws_id}{path}",
            headers=member_headers,
            json={"userId": member_user_id, "permissionLevel": "VIEW"},
        )
        assert blocked.status_code == 403, blocked.text

    await _set_role(api_client, owner_headers, ws_id, member_user_id, "ADMIN")
    try:
        for path in (
            f"/spaces/{space_id}/members",
            f"/folders/{folder_id}/members",
            f"/lists/{list_id}/members",
        ):
            allowed = await api_client.post(
                f"/api/v1/workspaces/{ws_id}{path}",
                headers=member_headers,
                json={"userId": member_user_id, "permissionLevel": "VIEW"},
            )
            assert allowed.status_code == 201, allowed.text

            removed = await api_client.delete(
                f"/api/v1/workspaces/{ws_id}{path}/{member_user_id}",
                headers=member_headers,
            )
            assert removed.status_code == 200, removed.text
    finally:
        await _set_role(api_client, owner_headers, ws_id, member_user_id, "MEMBER")


@pytest.mark.asyncio(loop_scope="session")
async def test_only_admin_can_toggle_privacy(api_client: AsyncClient):
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
        json={"name": f"Privacy Toggle Space {suffix}"},
    )
    assert space.status_code == 201, space.text
    space_id = space.json()["id"]

    folder = await api_client.post(
        f"/api/v1/workspaces/{ws_id}/spaces/{space_id}/folders",
        headers=owner_headers,
        json={"name": "Privacy Toggle Folder"},
    )
    assert folder.status_code == 201, folder.text
    folder_id = folder.json()["id"]

    lst = await api_client.post(
        f"/api/v1/workspaces/{ws_id}/spaces/{space_id}/lists",
        headers=owner_headers,
        json={"name": "Privacy Toggle List"},
    )
    assert lst.status_code == 201, lst.text
    list_id = lst.json()["id"]

    space_toggle = await api_client.patch(
        f"/api/v1/workspaces/{ws_id}/spaces/{space_id}",
        headers=member_headers,
        json={"isPrivate": True},
    )
    assert space_toggle.status_code == 403, space_toggle.text

    folder_toggle = await api_client.patch(
        f"/api/v1/workspaces/{ws_id}/folders/{folder_id}",
        headers=member_headers,
        json={"isPrivate": True},
    )
    assert folder_toggle.status_code == 403, folder_toggle.text

    list_toggle = await api_client.patch(
        f"/api/v1/workspaces/{ws_id}/lists/{list_id}",
        headers=member_headers,
        json={"isPrivate": True},
    )
    assert list_toggle.status_code == 403, list_toggle.text

    # A plain rename (no privacy change) is still fine for a MEMBER.
    rename = await api_client.patch(
        f"/api/v1/workspaces/{ws_id}/lists/{list_id}",
        headers=member_headers,
        json={"name": "Privacy Toggle List Renamed"},
    )
    assert rename.status_code == 200, rename.text

    owner_toggle = await api_client.patch(
        f"/api/v1/workspaces/{ws_id}/spaces/{space_id}",
        headers=owner_headers,
        json={"isPrivate": True},
    )
    assert owner_toggle.status_code == 200, owner_toggle.text
    assert owner_toggle.json()["isPrivate"] is True


@pytest.mark.asyncio(loop_scope="session")
async def test_guest_cannot_be_given_space_access_but_can_be_given_list_access(
    api_client: AsyncClient,
):
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
        json={"name": f"Guest Share Space {suffix}"},
    )
    assert space.status_code == 201, space.text
    space_id = space.json()["id"]

    lst = await api_client.post(
        f"/api/v1/workspaces/{ws_id}/spaces/{space_id}/lists",
        headers=owner_headers,
        json={"name": "Guest Share List"},
    )
    assert lst.status_code == 201, lst.text
    list_id = lst.json()["id"]

    await _set_role(api_client, owner_headers, ws_id, member_user_id, "GUEST")
    try:
        space_share = await api_client.post(
            f"/api/v1/workspaces/{ws_id}/spaces/{space_id}/members",
            headers=owner_headers,
            json={"userId": member_user_id, "permissionLevel": "VIEW"},
        )
        assert space_share.status_code == 400, space_share.text

        list_share = await api_client.post(
            f"/api/v1/workspaces/{ws_id}/lists/{list_id}/members",
            headers=owner_headers,
            json={"userId": member_user_id, "permissionLevel": "VIEW"},
        )
        assert list_share.status_code == 201, list_share.text
    finally:
        await _set_role(api_client, owner_headers, ws_id, member_user_id, "MEMBER")


@pytest.mark.asyncio(loop_scope="session")
async def test_private_folder_and_list_narrow_access_below_space(
    api_client: AsyncClient,
):
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
        json={"name": f"Narrow Access Space {suffix}"},
    )
    assert space.status_code == 201, space.text
    space_id = space.json()["id"]

    # MEMBER has full ambient EDIT on this public space by default.
    folder = await api_client.post(
        f"/api/v1/workspaces/{ws_id}/spaces/{space_id}/folders",
        headers=owner_headers,
        json={"name": "Private Folder", "isPrivate": True},
    )
    assert folder.status_code == 201, folder.text
    folder_id = folder.json()["id"]

    lst = await api_client.post(
        f"/api/v1/workspaces/{ws_id}/spaces/{space_id}/lists",
        headers=owner_headers,
        json={"folderId": folder_id, "name": "List In Private Folder"},
    )
    assert lst.status_code == 201, lst.text
    list_id = lst.json()["id"]

    standalone_private_list = await api_client.post(
        f"/api/v1/workspaces/{ws_id}/spaces/{space_id}/lists",
        headers=owner_headers,
        json={"name": "Standalone Private List", "isPrivate": True},
    )
    assert standalone_private_list.status_code == 201, standalone_private_list.text
    standalone_list_id = standalone_private_list.json()["id"]

    # A private Folder/List should no longer be reachable by a plain MEMBER
    # despite their ambient Space-level EDIT.
    blocked_folder_list = await api_client.get(
        f"/api/v1/workspaces/{ws_id}/lists/{list_id}", headers=member_headers
    )
    assert blocked_folder_list.status_code == 403, blocked_folder_list.text

    blocked_standalone = await api_client.get(
        f"/api/v1/workspaces/{ws_id}/lists/{standalone_list_id}",
        headers=member_headers,
    )
    assert blocked_standalone.status_code == 403, blocked_standalone.text

    # They also shouldn't show up in the Space tree at all.
    tree = await api_client.get(
        f"/api/v1/workspaces/{ws_id}/spaces/{space_id}", headers=member_headers
    )
    assert tree.status_code == 200, tree.text
    tree_body = tree.json()
    folder_ids_seen = {f["id"] for f in tree_body["folders"]}
    standalone_ids_seen = {l["id"] for l in tree_body["standaloneLists"]}
    assert folder_id not in folder_ids_seen
    assert standalone_list_id not in standalone_ids_seen

    # An explicit ListMember override still grants access to a private List.
    override = await api_client.post(
        f"/api/v1/workspaces/{ws_id}/lists/{standalone_list_id}/members",
        headers=owner_headers,
        json={"userId": member_user_id, "permissionLevel": "VIEW"},
    )
    assert override.status_code == 201, override.text

    now_visible = await api_client.get(
        f"/api/v1/workspaces/{ws_id}/lists/{standalone_list_id}",
        headers=member_headers,
    )
    assert now_visible.status_code == 200, now_visible.text
