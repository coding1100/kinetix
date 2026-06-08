"""Profile and password settings API."""

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app


@pytest.mark.asyncio
async def test_openapi_profile_routes():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get("/openapi.json")
    assert res.status_code == 200
    paths = res.json()["paths"]
    assert "/api/v1/auth/me" in paths
    assert "patch" in paths["/api/v1/auth/me"]
    assert "/api/v1/auth/me/change-password" in paths


@pytest.mark.asyncio
async def test_patch_me_updates_profile():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        login = await client.post(
            "/api/v1/auth/login",
            json={"email": "owner@demo.com", "password": "password123"},
        )
        if login.status_code != 200:
            pytest.skip("Demo owner not in DB")

        token = login.json()["accessToken"]
        headers = {"Authorization": f"Bearer {token}"}

        me = await client.get("/api/v1/auth/me", headers=headers)
        assert me.status_code == 200
        assert "hasPassword" in me.json()

        patch = await client.patch(
            "/api/v1/auth/me",
            headers=headers,
            json={"fullName": "Demo Owner Updated"},
        )
        assert patch.status_code == 200, patch.text
        assert patch.json()["fullName"] == "Demo Owner Updated"

        await client.patch(
            "/api/v1/auth/me",
            headers=headers,
            json={"fullName": me.json()["fullName"]},
        )

        pwd = await client.post(
            "/api/v1/auth/me/change-password",
            headers=headers,
            json={
                "currentPassword": "password123",
                "newPassword": "password123",
            },
        )
        assert pwd.status_code == 200
