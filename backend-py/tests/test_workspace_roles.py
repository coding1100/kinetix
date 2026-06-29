"""Workspace role hierarchy and owner privileged channel access."""

from __future__ import annotations

import time

import pytest
from httpx import AsyncClient

from tests.task_test_helpers import MEMBER, OWNER, auth_headers, login, user_id, workspace_id
@pytest.mark.asyncio(loop_scope="session")
async def test_owner_can_access_private_channel_without_membership(
    api_client: AsyncClient,
):
    owner_token = await login(api_client, *OWNER)
    member_token = await login(api_client, *MEMBER)
    owner_headers = auth_headers(owner_token)
    member_headers = auth_headers(member_token)
    ws_id = await workspace_id(api_client, owner_token)
    member_user_id = await user_id(api_client, member_token)

    suffix = int(time.time() * 1000)
    created = await api_client.post(
        f"/api/v1/workspaces/{ws_id}/chat/channels",
        headers=member_headers,
        json={
            "name": f"private-owner-test-{suffix}",
            "isPrivate": True,
            "memberIds": [member_user_id],
        },
    )
    assert created.status_code == 201, created.text
    channel_id = created.json()["id"]
    assert created.json()["isPrivate"] is True

    owner_list = await api_client.get(
        f"/api/v1/workspaces/{ws_id}/chat/channels",
        headers=owner_headers,
    )
    assert owner_list.status_code == 200, owner_list.text
    listed_ids = [c["id"] for c in owner_list.json()["data"]]
    assert channel_id in listed_ids

    owner_detail = await api_client.get(
        f"/api/v1/workspaces/{ws_id}/chat/channels/{channel_id}",
        headers=owner_headers,
    )
    assert owner_detail.status_code == 200, owner_detail.text

    owner_messages = await api_client.get(
        f"/api/v1/workspaces/{ws_id}/chat/channels/{channel_id}/messages",
        headers=owner_headers,
    )
    assert owner_messages.status_code == 200, owner_messages.text


@pytest.mark.asyncio(loop_scope="session")
async def test_super_admin_role_and_limitations(api_client: AsyncClient):
    owner_token = await login(api_client, *OWNER)
    member_token = await login(api_client, *MEMBER)
    owner_headers = auth_headers(owner_token)
    member_headers = auth_headers(member_token)
    ws_id = await workspace_id(api_client, owner_token)
    member_user_id = await user_id(api_client, member_token)

    promoted = await api_client.patch(
        f"/api/v1/workspaces/{ws_id}/members/{member_user_id}",
        headers=owner_headers,
        json={"role": "SUPER_ADMIN"},
    )
    assert promoted.status_code == 200, promoted.text

    owner_user_id = await user_id(api_client, owner_token)

    transfer = await api_client.post(
        f"/api/v1/workspaces/{ws_id}/transfer-ownership",
        headers=member_headers,
        json={"newOwnerUserId": owner_user_id},
    )
    assert transfer.status_code == 403

    admin_assign = await api_client.patch(
        f"/api/v1/workspaces/{ws_id}/members/{member_user_id}",
        headers=member_headers,
        json={"role": "OWNER"},
    )
    assert admin_assign.status_code == 403

    suffix = int(time.time() * 1000)
    created = await api_client.post(
        f"/api/v1/workspaces/{ws_id}/chat/channels",
        headers=owner_headers,
        json={
            "name": f"private-super-{suffix}",
            "isPrivate": True,
            "memberIds": [await user_id(api_client, owner_token)],
        },
    )
    assert created.status_code == 201, created.text
    channel_id = created.json()["id"]

    super_list = await api_client.get(
        f"/api/v1/workspaces/{ws_id}/chat/channels",
        headers=member_headers,
    )
    assert super_list.status_code == 200, super_list.text
    assert channel_id in [c["id"] for c in super_list.json()["data"]]

    demoted = await api_client.patch(
        f"/api/v1/workspaces/{ws_id}/members/{member_user_id}",
        headers=owner_headers,
        json={"role": "MEMBER"},
    )
    assert demoted.status_code == 200, demoted.text
