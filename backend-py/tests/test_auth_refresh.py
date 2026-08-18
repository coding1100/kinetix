"""Refresh session cookie tests."""

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app
from app.services import auth_service


@pytest.mark.asyncio
async def test_refresh_accepts_cookie_token(monkeypatch):
    async def fake_refresh(_session, token):
        assert token == "stored-refresh-jwt"
        return {
            "user": {
                "id": "u1",
                "email": "a@test.com",
                "fullName": "A",
                "avatarUrl": None,
            },
            "accessToken": "new-access",
            "refreshToken": "new-refresh",
        }

    monkeypatch.setattr(auth_service, "refresh_session", fake_refresh)

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.post(
            "/api/v1/auth/refresh",
            cookies={"riseup_refresh": "stored-refresh-jwt"},
        )

    assert res.status_code == 200
    assert res.json()["accessToken"] == "new-access"
    assert "refreshToken" not in res.json()
    assert res.cookies.get("riseup_refresh") == "new-refresh"


@pytest.mark.asyncio
async def test_refresh_missing_token_returns_401():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.post("/api/v1/auth/refresh")
    assert res.status_code == 401
