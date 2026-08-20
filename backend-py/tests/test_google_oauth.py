"""Google OAuth ('Continue with Google') contract and flow tests."""

from __future__ import annotations

from urllib.parse import parse_qs, urlparse

import httpx
import pytest
from httpx import ASGITransport, AsyncClient

from app.config import get_settings
from app.main import app, fastapi_app
from app.services import oauth_service
from tests import conftest as test_conftest
from tests.conftest import require_py4_server

GOOGLE_START_PATH = "/api/v1/auth/google/start"
GOOGLE_CALLBACK_PATH = "/api/v1/auth/google/callback"


def _frontend_callback() -> str:
    return f"{get_settings().frontend_url}/auth/oauth/callback"


@pytest.fixture(autouse=True)
def clear_settings_cache():
    from app.config import _get_settings_cached

    _get_settings_cached.cache_clear()
    yield
    _get_settings_cached.cache_clear()


@pytest.fixture
def google_oauth_env(monkeypatch, clear_settings_cache):
    monkeypatch.setenv(
        "GOOGLE_CLIENT_ID",
        "37107834238-test.apps.googleusercontent.com",
    )
    monkeypatch.setenv("GOOGLE_CLIENT_SECRET", "test-client-secret")
    monkeypatch.setenv("API_PUBLIC_URL", "http://localhost:4001")
    monkeypatch.setenv("FRONTEND_URL", "http://localhost:3001")


@pytest.fixture
def google_oauth_disabled(monkeypatch, clear_settings_cache):
    monkeypatch.setenv("GOOGLE_CLIENT_ID", "")
    monkeypatch.setenv("GOOGLE_CLIENT_SECRET", "")


def _registered_paths_from_app() -> set[str]:
    paths = set()
    for route in fastapi_app.routes:
        if hasattr(route, "path"):
            paths.add(route.path)
        if hasattr(route, "routes"):
            for r in route.routes:
                if hasattr(r, "path"):
                    paths.add(r.path)
    return paths


@pytest.mark.asyncio
async def test_openapi_google_routes_registered():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get("/openapi.json")
    assert res.status_code == 200
    paths = res.json()["paths"]
    assert GOOGLE_START_PATH in paths
    assert GOOGLE_CALLBACK_PATH in paths
    assert "/api/v1/auth/oauth/exchange" in paths


@pytest.mark.asyncio
async def test_health_reports_google_oauth_routes():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get("/health")
    assert res.status_code == 200
    oauth = res.json()["googleOAuth"]
    assert oauth["routesRegistered"] is True
    assert GOOGLE_START_PATH in (fastapi_app.openapi().get("paths") or {})


@pytest.mark.asyncio
async def test_google_start_redirects_to_google_when_configured(
    google_oauth_env,
    monkeypatch,
):
    google_url = (
        "https://accounts.google.com/o/oauth2/v2/auth"
        "?client_id=test&response_type=code"
    )

    async def fake_start(_session, _next_path):
        return google_url

    monkeypatch.setattr(oauth_service, "start_google_oauth", fake_start)

    transport = ASGITransport(app=app)
    async with AsyncClient(
        transport=transport, base_url="http://test", follow_redirects=False
    ) as client:
        res = await client.get(
            f"{GOOGLE_START_PATH}?next=%2Fhome%2Finbox",
        )

    assert res.status_code == 302
    assert res.headers["location"] == google_url


@pytest.mark.asyncio
async def test_google_start_redirects_frontend_when_not_configured(
    google_oauth_disabled,
):
    transport = ASGITransport(app=app)
    async with AsyncClient(
        transport=transport, base_url="http://test", follow_redirects=False
    ) as client:
        res = await client.get(f"{GOOGLE_START_PATH}?next=/home/inbox")

    assert res.status_code == 302
    location = res.headers["location"]
    assert location.startswith(_frontend_callback())
    parsed = urlparse(location)
    params = parse_qs(parsed.query)
    assert params["error"] == ["OAUTH_NOT_CONFIGURED"]


@pytest.mark.asyncio
async def test_google_start_rejects_unsafe_next_path(google_oauth_env, monkeypatch):
    captured: list[str | None] = []

    async def fake_start(_session, next_path):
        captured.append(next_path)
        return "https://accounts.google.com/o/oauth2/v2/auth?x=1"

    monkeypatch.setattr(oauth_service, "start_google_oauth", fake_start)

    transport = ASGITransport(app=app)
    async with AsyncClient(
        transport=transport, base_url="http://test", follow_redirects=False
    ) as client:
        await client.get(f"{GOOGLE_START_PATH}?next=//evil.com")

    assert captured == ["/home/inbox"]


@pytest.mark.asyncio
async def test_google_callback_google_error_redirects_frontend():
    transport = ASGITransport(app=app)
    async with AsyncClient(
        transport=transport, base_url="http://test", follow_redirects=False
    ) as client:
        res = await client.get(
            f"{GOOGLE_CALLBACK_PATH}?error=access_denied",
        )

    assert res.status_code == 302
    assert "error=access_denied" in res.headers["location"]
    assert res.headers["location"].startswith(_frontend_callback())


@pytest.mark.asyncio
async def test_google_callback_missing_params_redirects_frontend():
    transport = ASGITransport(app=app)
    async with AsyncClient(
        transport=transport, base_url="http://test", follow_redirects=False
    ) as client:
        res = await client.get(GOOGLE_CALLBACK_PATH)

    assert res.status_code == 302
    assert "error=missing_code" in res.headers["location"]


@pytest.mark.asyncio
async def test_google_callback_success_redirects_frontend_with_exchange_code(
    monkeypatch,
):
    async def fake_complete(_session, _code, _state):
        return ("exchange-code-abc", "/home/inbox")

    monkeypatch.setattr(
        oauth_service, "complete_google_callback", fake_complete
    )

    transport = ASGITransport(app=app)
    async with AsyncClient(
        transport=transport, base_url="http://test", follow_redirects=False
    ) as client:
        res = await client.get(
            f"{GOOGLE_CALLBACK_PATH}?code=google-code&state=state-token",
        )

    assert res.status_code == 302
    location = res.headers["location"]
    assert location.startswith(_frontend_callback())
    assert "code=exchange-code-abc" in location
    parsed = urlparse(location)
    assert parse_qs(parsed.query).get("next") == ["/home/inbox"]


def _live_server_has_google_routes() -> bool:
    try:
        res = httpx.get(
            f"{test_conftest.API_BASE}/openapi.json",
            timeout=5,
        )
        if res.status_code != 200:
            return False
        paths = res.json().get("paths", {})
        return GOOGLE_START_PATH in paths and GOOGLE_CALLBACK_PATH in paths
    except Exception:
        return False


def test_live_health_google_oauth_routes_registered(dedicated_api_server):
    if not _live_server_has_google_routes():
        pytest.skip("Server running without Google OAuth routes (legacy backend)")
    res = httpx.get(f"{dedicated_api_server}/health", timeout=5)
    assert res.status_code == 200
    oauth = res.json().get("googleOAuth", {})
    assert oauth.get("routesRegistered") is True


def test_live_google_start_redirects_away_from_api(dedicated_api_server):
    base = dedicated_api_server
    if not _live_server_has_google_routes():
        pytest.skip("Server running without Google OAuth routes (legacy backend)")

    res = httpx.get(
        f"{base}{GOOGLE_START_PATH}?next=%2Fhome%2Finbox",
        follow_redirects=False,
        timeout=30,
    )
    assert res.status_code == 302, (
        f"Expected 302 redirect, got {res.status_code}: {res.text[:500]}"
    )
    location = res.headers.get("location", "")
    assert location, "Missing Location header on google/start"
    assert not location.startswith(f"{base}{GOOGLE_START_PATH}"), (
        "google/start must not redirect to itself"
    )
    is_google = location.startswith("https://accounts.google.com/")
    is_frontend_error = location.startswith(_frontend_callback())
    assert is_google or is_frontend_error, (
        f"google/start should redirect to Google or frontend error callback. Got: {location}"
    )


def test_live_openapi_lists_google_start(dedicated_api_server):
    if not _live_server_has_google_routes():
        pytest.skip("Server running without Google OAuth routes (legacy backend)")
    res = httpx.get(f"{dedicated_api_server}/openapi.json", timeout=5)
    assert res.status_code == 200
    paths = res.json()["paths"]
    assert GOOGLE_START_PATH in paths
    assert GOOGLE_CALLBACK_PATH in paths
