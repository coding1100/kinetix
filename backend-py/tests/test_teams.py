"""Workspace teams API tests."""

from __future__ import annotations

import time

import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy import text

from app.db.session import get_engine
from tests.task_test_helpers import MEMBER, OWNER, auth_headers, login, workspace_id


@pytest_asyncio.fixture(scope="session", autouse=True)
async def ensure_teams_schema():
    engine = get_engine()
    statements = [
        """DO $$ BEGIN
            CREATE TYPE "TeamRole" AS ENUM ('LEAD', 'MEMBER');
        EXCEPTION
            WHEN duplicate_object THEN NULL;
        END $$""",
        """CREATE TABLE IF NOT EXISTS "Team" (
            "id" TEXT PRIMARY KEY,
            "workspaceId" TEXT NOT NULL REFERENCES "Workspace"("id") ON DELETE CASCADE,
            "name" TEXT NOT NULL,
            "color" TEXT NOT NULL DEFAULT '#7B68EE',
            "icon" TEXT,
            "description" TEXT,
            "createdById" TEXT REFERENCES "User"("id") ON DELETE SET NULL,
            "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )""",
        """CREATE TABLE IF NOT EXISTS "TeamMember" (
            "id" TEXT PRIMARY KEY,
            "teamId" TEXT NOT NULL REFERENCES "Team"("id") ON DELETE CASCADE,
            "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
            "role" "TeamRole" NOT NULL DEFAULT 'MEMBER',
            "joinedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            CONSTRAINT "TeamMember_teamId_userId_key" UNIQUE ("teamId", "userId")
        )""",
        'CREATE INDEX IF NOT EXISTS "Team_workspaceId_idx" ON "Team" ("workspaceId")',
        'CREATE INDEX IF NOT EXISTS "TeamMember_teamId_idx" ON "TeamMember" ("teamId")',
        'CREATE INDEX IF NOT EXISTS "TeamMember_userId_idx" ON "TeamMember" ("userId")',
    ]
    async with engine.begin() as conn:
        for stmt in statements:
            await conn.execute(text(stmt))


@pytest.mark.asyncio(loop_scope="session")
async def test_team_crud_and_membership(api_client: AsyncClient):
    owner_token = await login(api_client, *OWNER)
    member_token = await login(api_client, *MEMBER)
    owner_headers = auth_headers(owner_token)
    member_headers = auth_headers(member_token)
    ws_id = await workspace_id(api_client, owner_token)

    member_me = await api_client.get("/api/v1/auth/me", headers=member_headers)
    assert member_me.status_code == 200
    member_user_id = member_me.json()["id"]

    name = f"Engineering {int(time.time())}"
    created = await api_client.post(
        f"/api/v1/workspaces/{ws_id}/teams",
        headers=owner_headers,
        json={"name": name, "memberIds": [member_user_id]},
    )
    assert created.status_code == 201, created.text
    team = created.json()
    team_id = team["id"]
    assert team["name"] == name
    assert team["memberCount"] >= 2
    member_ids = {m["id"] for m in team["members"]}
    assert member_user_id in member_ids

    listed = await api_client.get(
        f"/api/v1/workspaces/{ws_id}/teams",
        headers=owner_headers,
    )
    assert listed.status_code == 200, listed.text
    ids = [t["id"] for t in listed.json()["data"]]
    assert team_id in ids

    mine = await api_client.get(
        f"/api/v1/workspaces/{ws_id}/teams/mine",
        headers=member_headers,
    )
    assert mine.status_code == 200, mine.text
    my_ids = [t["id"] for t in mine.json()["data"]]
    assert team_id in my_ids

    detail = await api_client.get(
        f"/api/v1/workspaces/{ws_id}/teams/{team_id}",
        headers=owner_headers,
    )
    assert detail.status_code == 200
    assert detail.json()["id"] == team_id

    renamed = f"{name} Renamed"
    patched = await api_client.patch(
        f"/api/v1/workspaces/{ws_id}/teams/{team_id}",
        headers=owner_headers,
        json={"name": renamed, "color": "#22C55E"},
    )
    assert patched.status_code == 200, patched.text
    assert patched.json()["name"] == renamed
    assert patched.json()["color"] == "#22C55E"

    people = await api_client.get(
        f"/api/v1/workspaces/{ws_id}/members",
        headers=owner_headers,
    )
    assert people.status_code == 200
    member_row = next(
        (m for m in people.json()["data"] if m["id"] == member_user_id), None
    )
    assert member_row is not None
    assert any(t["id"] == team_id for t in member_row.get("teams", []))

    removed = await api_client.delete(
        f"/api/v1/workspaces/{ws_id}/teams/{team_id}/members/{member_user_id}",
        headers=owner_headers,
    )
    assert removed.status_code == 200, removed.text
    assert member_user_id not in {m["id"] for m in removed.json()["members"]}

    deleted = await api_client.delete(
        f"/api/v1/workspaces/{ws_id}/teams/{team_id}",
        headers=owner_headers,
    )
    assert deleted.status_code == 200, deleted.text
    assert deleted.json()["ok"] is True


@pytest.mark.asyncio(loop_scope="session")
async def test_team_member_cannot_delete_team(api_client: AsyncClient):
    owner_token = await login(api_client, *OWNER)
    member_token = await login(api_client, *MEMBER)
    owner_headers = auth_headers(owner_token)
    member_headers = auth_headers(member_token)
    ws_id = await workspace_id(api_client, owner_token)
    member_user_id = (
        await api_client.get("/api/v1/auth/me", headers=member_headers)
    ).json()["id"]

    reset_role = await api_client.patch(
        f"/api/v1/workspaces/{ws_id}/members/{member_user_id}",
        headers=owner_headers,
        json={"role": "MEMBER"},
    )
    assert reset_role.status_code == 200, reset_role.text

    created = await api_client.post(
        f"/api/v1/workspaces/{ws_id}/teams",
        headers=owner_headers,
        json={"name": f"Restricted {int(time.time())}"},
    )
    assert created.status_code == 201, created.text
    team_id = created.json()["id"]

    forbidden = await api_client.delete(
        f"/api/v1/workspaces/{ws_id}/teams/{team_id}",
        headers=member_headers,
    )
    assert forbidden.status_code == 403

    await api_client.delete(
        f"/api/v1/workspaces/{ws_id}/teams/{team_id}",
        headers=owner_headers,
    )
