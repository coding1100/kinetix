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
    Space access this way.

    Content access (viewing) works via the override, but structural
    actions (create Folder/List, rename, delete) are a separate, higher
    bar - see _require_can_edit_structure and
    test_guest_and_limited_member_cannot_manage_structure_even_with_edit
    below - a Limited Member is excluded from those even with an
    explicit EDIT override."""
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
        assert allowed.json()["canManageStructure"] is False, allowed.json()
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


@pytest.mark.asyncio(loop_scope="session")
@pytest.mark.parametrize("role", ["MEMBER", "LIMITED_MEMBER"])
async def test_shared_private_space_shows_its_folders_and_lists(
    api_client: AsyncClient, role: str
):
    """Sharing a private Space should cascade to its (non-private) Folders
    and Lists in the tree response, same as resolve_folder_permission/
    resolve_list_permission already do for permission checks - this checks
    the actual GET /spaces/{id} payload one level up, for every role that
    can receive a Space share (not just one)."""
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
        json={"name": f"Shared Private Space {suffix}", "isPrivate": True},
    )
    assert space.status_code == 201, space.text
    space_id = space.json()["id"]

    folder = await api_client.post(
        f"/api/v1/workspaces/{ws_id}/spaces/{space_id}/folders",
        headers=owner_headers,
        json={"name": "Cascaded Folder"},
    )
    assert folder.status_code == 201, folder.text
    folder_id = folder.json()["id"]

    lst = await api_client.post(
        f"/api/v1/workspaces/{ws_id}/spaces/{space_id}/lists",
        headers=owner_headers,
        json={"folderId": folder_id, "name": "Cascaded List"},
    )
    assert lst.status_code == 201, lst.text
    list_id = lst.json()["id"]

    standalone_list = await api_client.post(
        f"/api/v1/workspaces/{ws_id}/spaces/{space_id}/lists",
        headers=owner_headers,
        json={"name": "Cascaded Standalone List"},
    )
    assert standalone_list.status_code == 201, standalone_list.text
    standalone_list_id = standalone_list.json()["id"]

    await _set_role(api_client, owner_headers, ws_id, member_user_id, role)
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

        tree = await api_client.get(
            f"/api/v1/workspaces/{ws_id}/spaces/{space_id}", headers=member_headers
        )
        assert tree.status_code == 200, tree.text
        body = tree.json()
        folder_ids_seen = {f["id"] for f in body["folders"]}
        assert folder_id in folder_ids_seen
        seen_folder = next(f for f in body["folders"] if f["id"] == folder_id)
        list_ids_in_folder = {l["id"] for l in seen_folder["lists"]}
        assert list_id in list_ids_in_folder
        standalone_ids_seen = {l["id"] for l in body["standaloneLists"]}
        assert standalone_list_id in standalone_ids_seen

        # The sidebar tree actually calls this plural endpoint, not the
        # single-space one above - check its nested structure directly
        # instead of just checking the Space id is present.
        list_tree = await api_client.get(
            f"/api/v1/workspaces/{ws_id}/spaces", headers=member_headers
        )
        assert list_tree.status_code == 200, list_tree.text
        spaces_seen = {s["id"]: s for s in list_tree.json()["data"]}
        assert space_id in spaces_seen
        space_entry = spaces_seen[space_id]
        folder_ids_in_list_endpoint = {f["id"] for f in space_entry["folders"]}
        assert folder_id in folder_ids_in_list_endpoint, space_entry
        seen_folder_in_list = next(
            f for f in space_entry["folders"] if f["id"] == folder_id
        )
        assert list_id in {l["id"] for l in seen_folder_in_list["lists"]}
        assert standalone_list_id in {
            l["id"] for l in space_entry["standaloneLists"]
        }
    finally:
        await _set_role(api_client, owner_headers, ws_id, member_user_id, "MEMBER")


@pytest.mark.asyncio(loop_scope="session")
async def test_making_list_private_removes_ambient_members_from_its_channel(
    api_client: AsyncClient,
):
    """A List's primary chat channel starts synced to whoever had ambient
    access (create_list_channel). Flipping the List to private afterwards
    must re-derive that channel's actual ChatChannelMember rows too - the
    Channels tab (GET /chat/channels) is driven purely by those rows, not
    by List privacy - or someone who only ever had ambient (non-explicit)
    access keeps seeing the channel forever, nothing else would ever prune
    them. update_list didn't call sync_list_channel_members_for_space at
    all before this fix.

    Note: GET /chat/channels/{id}/members is NOT the right endpoint to
    check this with - list-primary channels are always created with
    ChatChannel.is_private=False regardless of the List's own is_private
    (a separate, unrelated flag), and that endpoint shows every workspace
    member for a non-private channel independent of real membership rows.
    GET /chat/channels (the actual Channels tab query) is membership-row-
    driven for every channel regardless of is_private, which is what
    actually matters here.
    """
    owner_token = await login(api_client, *OWNER)
    owner_headers = auth_headers(owner_token)
    member_token = await login(api_client, *MEMBER)
    member_headers = auth_headers(member_token)
    ws_id = await workspace_id(api_client, owner_token)

    suffix = int(time.time() * 1000)
    space = await api_client.post(
        f"/api/v1/workspaces/{ws_id}/spaces",
        headers=owner_headers,
        json={"name": f"Channel Resync Space {suffix}"},
    )
    assert space.status_code == 201, space.text
    space_id = space.json()["id"]

    lst = await api_client.post(
        f"/api/v1/workspaces/{ws_id}/spaces/{space_id}/lists",
        headers=owner_headers,
        json={"name": "Soon Private List"},
    )
    assert lst.status_code == 201, lst.text
    list_id = lst.json()["id"]

    meta = await api_client.get(
        f"/api/v1/workspaces/{ws_id}/lists/{list_id}", headers=owner_headers
    )
    assert meta.status_code == 200, meta.text
    channel_id = meta.json()["channelId"]
    assert channel_id

    # MEMBER has ambient EDIT on this public Space/List by default, so they
    # were auto-added to the channel at creation time - it should show in
    # their own Channels tab.
    before = await api_client.get(
        f"/api/v1/workspaces/{ws_id}/chat/channels", headers=member_headers
    )
    assert before.status_code == 200, before.text
    channel_ids_before = {c["id"] for c in before.json()["data"]}
    assert channel_id in channel_ids_before

    patch = await api_client.patch(
        f"/api/v1/workspaces/{ws_id}/lists/{list_id}",
        headers=owner_headers,
        json={"isPrivate": True},
    )
    assert patch.status_code == 200, patch.text

    after = await api_client.get(
        f"/api/v1/workspaces/{ws_id}/chat/channels", headers=member_headers
    )
    assert after.status_code == 200, after.text
    channel_ids_after = {c["id"] for c in after.json()["data"]}
    assert channel_id not in channel_ids_after


@pytest.mark.asyncio(loop_scope="session")
async def test_private_list_channel_reports_isprivate_true(api_client: AsyncClient):
    """ChatChannel.is_private is always False for a List-primary channel
    (create_list_channel never sets it) - it's meant to mirror the List's
    own is_private instead, a separate flag on TaskList. The Channels tab
    (and GET /chat/channels/{id}, and the chat:channel:joined push) must
    report isPrivate=True for a private List's channel so the frontend's
    existing lock-icon rendering (already wired to channel.isPrivate) has
    something correct to read."""
    owner_token = await login(api_client, *OWNER)
    owner_headers = auth_headers(owner_token)
    ws_id = await workspace_id(api_client, owner_token)

    suffix = int(time.time() * 1000)
    space = await api_client.post(
        f"/api/v1/workspaces/{ws_id}/spaces",
        headers=owner_headers,
        json={"name": f"Channel Privacy Icon Space {suffix}"},
    )
    assert space.status_code == 201, space.text
    space_id = space.json()["id"]

    lst = await api_client.post(
        f"/api/v1/workspaces/{ws_id}/spaces/{space_id}/lists",
        headers=owner_headers,
        json={"name": "Private List For Icon Check", "isPrivate": True},
    )
    assert lst.status_code == 201, lst.text
    list_id = lst.json()["id"]

    meta = await api_client.get(
        f"/api/v1/workspaces/{ws_id}/lists/{list_id}", headers=owner_headers
    )
    assert meta.status_code == 200, meta.text
    channel_id = meta.json()["channelId"]
    assert channel_id

    tab = await api_client.get(
        f"/api/v1/workspaces/{ws_id}/chat/channels", headers=owner_headers
    )
    assert tab.status_code == 200, tab.text
    entry = next(c for c in tab.json()["data"] if c["id"] == channel_id)
    assert entry["isPrivate"] is True, entry

    single = await api_client.get(
        f"/api/v1/workspaces/{ws_id}/chat/channels/{channel_id}",
        headers=owner_headers,
    )
    assert single.status_code == 200, single.text
    assert single.json()["isPrivate"] is True, single.json()


@pytest.mark.asyncio(loop_scope="session")
async def test_list_shared_directly_shows_in_tree_despite_private_unshared_folder(
    api_client: AsyncClient,
):
    """A List override always wins over its parent Folder's own privacy
    (resolve_list_permission checks the List's own override before ever
    looking at the Folder) - but _build_space_payload's tree builder used
    to skip a Folder's entire list loop whenever the Folder itself failed
    its own permission check, so a directly-shared List nested under an
    otherwise-inaccessible-to-this-user Folder never reached the tree at
    all, even though the permission layer already correctly granted it.

    The Folder itself must NOT show up when the user has no access to it -
    even though one of its Lists is directly shared, the Folder's own
    existence/name shouldn't be exposed to someone who wasn't granted
    access to it. The shared List surfaces as a standalone entry instead."""
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
        json={"name": f"Nested Override Space {suffix}", "isPrivate": True},
    )
    assert space.status_code == 201, space.text
    space_id = space.json()["id"]

    folder = await api_client.post(
        f"/api/v1/workspaces/{ws_id}/spaces/{space_id}/folders",
        headers=owner_headers,
        json={"name": "Private Unshared Folder", "isPrivate": True},
    )
    assert folder.status_code == 201, folder.text
    folder_id = folder.json()["id"]

    other_list = await api_client.post(
        f"/api/v1/workspaces/{ws_id}/spaces/{space_id}/lists",
        headers=owner_headers,
        json={"folderId": folder_id, "name": "Not Shared List"},
    )
    assert other_list.status_code == 201, other_list.text

    shared_list = await api_client.post(
        f"/api/v1/workspaces/{ws_id}/spaces/{space_id}/lists",
        headers=owner_headers,
        json={"folderId": folder_id, "name": "Directly Shared List", "isPrivate": True},
    )
    assert shared_list.status_code == 201, shared_list.text
    shared_list_id = shared_list.json()["id"]

    await _set_role(api_client, owner_headers, ws_id, member_user_id, "LIMITED_MEMBER")
    try:
        # Share the Space (ambient/private) but NOT the Folder - only the
        # one List, directly.
        space_grant = await api_client.post(
            f"/api/v1/workspaces/{ws_id}/spaces/{space_id}/members",
            headers=owner_headers,
            json={"userId": member_user_id, "permissionLevel": "VIEW"},
        )
        assert space_grant.status_code == 201, space_grant.text

        list_grant = await api_client.post(
            f"/api/v1/workspaces/{ws_id}/lists/{shared_list_id}/members",
            headers=owner_headers,
            json={"userId": member_user_id, "permissionLevel": "VIEW"},
        )
        assert list_grant.status_code == 201, list_grant.text

        direct = await api_client.get(
            f"/api/v1/workspaces/{ws_id}/lists/{shared_list_id}",
            headers=member_headers,
        )
        assert direct.status_code == 200, direct.text

        tree = await api_client.get(
            f"/api/v1/workspaces/{ws_id}/spaces/{space_id}", headers=member_headers
        )
        assert tree.status_code == 200, tree.text
        body = tree.json()
        # The Folder itself must not appear - the user has no access to it,
        # only to one List inside it.
        seen_folder = next(
            (f for f in body["folders"] if f["id"] == folder_id), None
        )
        assert seen_folder is None, body
        standalone_ids = {l["id"] for l in body["standaloneLists"]}
        assert shared_list_id in standalone_ids
        # The Folder's other, unshared List must still stay hidden - not
        # leaked into standalone either.
        assert len(standalone_ids) == 1
    finally:
        await _set_role(api_client, owner_headers, ws_id, member_user_id, "MEMBER")


@pytest.mark.asyncio(loop_scope="session")
async def test_limited_member_cannot_manage_structure_even_with_edit(
    api_client: AsyncClient,
):
    """Rename/Delete/create-child-Folder-or-List are structural,
    workspace-shape-changing actions - real content EDIT access on the
    resource isn't enough on its own, a Limited Member must be blocked
    even with an explicit EDIT override on the Space/Folder/List itself
    (_require_can_edit_structure, spaces_service.py). A plain MEMBER with
    the same EDIT access is not restricted - see
    test_member_can_manage_structure_with_edit below."""
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
        json={"name": f"Structure Gate Space {suffix}"},
    )
    assert space.status_code == 201, space.text
    space_id = space.json()["id"]

    folder = await api_client.post(
        f"/api/v1/workspaces/{ws_id}/spaces/{space_id}/folders",
        headers=owner_headers,
        json={"name": "Structure Gate Folder"},
    )
    assert folder.status_code == 201, folder.text
    folder_id = folder.json()["id"]

    lst = await api_client.post(
        f"/api/v1/workspaces/{ws_id}/spaces/{space_id}/lists",
        headers=owner_headers,
        json={"folderId": folder_id, "name": "Structure Gate List"},
    )
    assert lst.status_code == 201, lst.text
    list_id = lst.json()["id"]

    await _set_role(api_client, owner_headers, ws_id, member_user_id, "LIMITED_MEMBER")
    try:
        # Give them an explicit EDIT override on everything - real content
        # access, not the ambient-role kind, so this proves the block
        # isn't just "no VIEW/EDIT" but a deliberate role exclusion.
        for endpoint, target_id in (
            ("spaces", space_id),
            ("folders", folder_id),
            ("lists", list_id),
        ):
            grant = await api_client.post(
                f"/api/v1/workspaces/{ws_id}/{endpoint}/{target_id}/members",
                headers=owner_headers,
                json={"userId": member_user_id, "permissionLevel": "EDIT"},
            )
            assert grant.status_code == 201, (endpoint, grant.text)

        new_folder = await api_client.post(
            f"/api/v1/workspaces/{ws_id}/spaces/{space_id}/folders",
            headers=member_headers,
            json={"name": "Should be blocked"},
        )
        assert new_folder.status_code == 403, new_folder.text

        new_list = await api_client.post(
            f"/api/v1/workspaces/{ws_id}/spaces/{space_id}/lists",
            headers=member_headers,
            json={"name": "Should be blocked"},
        )
        assert new_list.status_code == 403, new_list.text

        rename_folder = await api_client.patch(
            f"/api/v1/workspaces/{ws_id}/folders/{folder_id}",
            headers=member_headers,
            json={"name": "Should not rename"},
        )
        assert rename_folder.status_code == 403, rename_folder.text

        rename_list = await api_client.patch(
            f"/api/v1/workspaces/{ws_id}/lists/{list_id}",
            headers=member_headers,
            json={"name": "Should not rename"},
        )
        assert rename_list.status_code == 403, rename_list.text

        delete_list = await api_client.delete(
            f"/api/v1/workspaces/{ws_id}/lists/{list_id}", headers=member_headers
        )
        assert delete_list.status_code == 403, delete_list.text

        delete_folder = await api_client.delete(
            f"/api/v1/workspaces/{ws_id}/folders/{folder_id}", headers=member_headers
        )
        assert delete_folder.status_code == 403, delete_folder.text

        delete_space = await api_client.delete(
            f"/api/v1/workspaces/{ws_id}/spaces/{space_id}", headers=member_headers
        )
        assert delete_space.status_code == 403, delete_space.text

        # The tree payload's canManageStructure flag must reflect the same
        # block, so the frontend hides these menu items entirely.
        tree = await api_client.get(
            f"/api/v1/workspaces/{ws_id}/spaces/{space_id}", headers=member_headers
        )
        assert tree.status_code == 200, tree.text
        body = tree.json()
        assert body["canManageStructure"] is False, body
        seen_folder = next(f for f in body["folders"] if f["id"] == folder_id)
        assert seen_folder["canManageStructure"] is False, seen_folder
        seen_list = next(l for l in seen_folder["lists"] if l["id"] == list_id)
        assert seen_list["canManageStructure"] is False, seen_list
    finally:
        await _set_role(api_client, owner_headers, ws_id, member_user_id, "MEMBER")


@pytest.mark.asyncio(loop_scope="session")
async def test_guest_cannot_manage_folder_list_structure_even_with_edit(
    api_client: AsyncClient,
):
    """Same gate as test_limited_member_cannot_manage_structure_even_with_
    edit, for GUEST - scoped to Folder/List only since a Guest can never
    receive a Space-level grant at all (a separate, pre-existing rule -
    see test_guest_cannot_be_given_space_access_but_can_be_given_list_
    access), so Space-level structural actions aren't reachable to test
    here in the first place."""
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
        json={"name": f"Guest Structure Gate Space {suffix}"},
    )
    assert space.status_code == 201, space.text
    space_id = space.json()["id"]

    folder = await api_client.post(
        f"/api/v1/workspaces/{ws_id}/spaces/{space_id}/folders",
        headers=owner_headers,
        json={"name": "Guest Structure Gate Folder"},
    )
    assert folder.status_code == 201, folder.text
    folder_id = folder.json()["id"]

    lst = await api_client.post(
        f"/api/v1/workspaces/{ws_id}/spaces/{space_id}/lists",
        headers=owner_headers,
        json={"folderId": folder_id, "name": "Guest Structure Gate List"},
    )
    assert lst.status_code == 201, lst.text
    list_id = lst.json()["id"]

    await _set_role(api_client, owner_headers, ws_id, member_user_id, "GUEST")
    try:
        for endpoint, target_id in (("folders", folder_id), ("lists", list_id)):
            grant = await api_client.post(
                f"/api/v1/workspaces/{ws_id}/{endpoint}/{target_id}/members",
                headers=owner_headers,
                json={"userId": member_user_id, "permissionLevel": "EDIT"},
            )
            assert grant.status_code == 201, (endpoint, grant.text)

        new_list = await api_client.post(
            f"/api/v1/workspaces/{ws_id}/spaces/{space_id}/lists",
            headers=member_headers,
            json={"folderId": folder_id, "name": "Should be blocked"},
        )
        assert new_list.status_code == 403, new_list.text

        rename_folder = await api_client.patch(
            f"/api/v1/workspaces/{ws_id}/folders/{folder_id}",
            headers=member_headers,
            json={"name": "Should not rename"},
        )
        assert rename_folder.status_code == 403, rename_folder.text

        rename_list = await api_client.patch(
            f"/api/v1/workspaces/{ws_id}/lists/{list_id}",
            headers=member_headers,
            json={"name": "Should not rename"},
        )
        assert rename_list.status_code == 403, rename_list.text

        delete_list = await api_client.delete(
            f"/api/v1/workspaces/{ws_id}/lists/{list_id}", headers=member_headers
        )
        assert delete_list.status_code == 403, delete_list.text

        delete_folder = await api_client.delete(
            f"/api/v1/workspaces/{ws_id}/folders/{folder_id}", headers=member_headers
        )
        assert delete_folder.status_code == 403, delete_folder.text
    finally:
        await _set_role(api_client, owner_headers, ws_id, member_user_id, "MEMBER")


@pytest.mark.asyncio(loop_scope="session")
async def test_member_can_manage_structure_with_edit(api_client: AsyncClient):
    """Sanity check the other side of the same gate: a plain MEMBER
    (not Guest/Limited Member) with EDIT access is not restricted -
    only the two named roles are excluded by _require_can_edit_structure."""
    owner_token = await login(api_client, *OWNER)
    owner_headers = auth_headers(owner_token)
    member_token = await login(api_client, *MEMBER)
    member_headers = auth_headers(member_token)
    ws_id = await workspace_id(api_client, owner_token)

    suffix = int(time.time() * 1000)
    space = await api_client.post(
        f"/api/v1/workspaces/{ws_id}/spaces",
        headers=owner_headers,
        json={"name": f"Member Structure Space {suffix}"},
    )
    assert space.status_code == 201, space.text
    space_id = space.json()["id"]

    tree = await api_client.get(
        f"/api/v1/workspaces/{ws_id}/spaces/{space_id}", headers=member_headers
    )
    assert tree.status_code == 200, tree.text
    assert tree.json()["canManageStructure"] is True, tree.json()

    folder = await api_client.post(
        f"/api/v1/workspaces/{ws_id}/spaces/{space_id}/folders",
        headers=member_headers,
        json={"name": "Member Made Folder"},
    )
    assert folder.status_code == 201, folder.text
    assert folder.json()["canManageStructure"] is True, folder.json()
    folder_id = folder.json()["id"]

    rename = await api_client.patch(
        f"/api/v1/workspaces/{ws_id}/folders/{folder_id}",
        headers=member_headers,
        json={"name": "Renamed by Member"},
    )
    assert rename.status_code == 200, rename.text

    delete = await api_client.delete(
        f"/api/v1/workspaces/{ws_id}/folders/{folder_id}", headers=member_headers
    )
    assert delete.status_code == 200, delete.text
