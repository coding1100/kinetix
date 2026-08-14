"""Profile and password settings API."""

import httpx
import pytest

from tests.conftest import API_BASE, require_py4_server


@pytest.fixture(scope="module")
def api_ready():
    require_py4_server()
    return True


def test_openapi_profile_routes(api_ready):
    res = httpx.get(f"{API_BASE}/openapi.json", timeout=10)
    assert res.status_code == 200
    paths = res.json()["paths"]
    assert "/api/v1/auth/me" in paths
    assert "patch" in paths["/api/v1/auth/me"]
    assert "/api/v1/auth/me/change-password" in paths


def test_patch_me_updates_profile(api_ready):
    login = httpx.post(
        f"{API_BASE}/api/v1/auth/login",
        json={"email": "owner@demo.com", "password": "password123"},
        timeout=10,
    )
    if login.status_code != 200:
        pytest.skip("Demo owner not in DB")

    token = login.json()["accessToken"]
    headers = {"Authorization": f"Bearer {token}"}

    me = httpx.get(f"{API_BASE}/api/v1/auth/me", headers=headers, timeout=10)
    assert me.status_code == 200
    assert "hasPassword" in me.json()

    patch = httpx.patch(
        f"{API_BASE}/api/v1/auth/me",
        headers=headers,
        json={"fullName": "Demo Owner Updated"},
        timeout=10,
    )
    assert patch.status_code == 200, patch.text
    assert patch.json()["fullName"] == "Demo Owner Updated"

    httpx.patch(
        f"{API_BASE}/api/v1/auth/me",
        headers=headers,
        json={"fullName": me.json()["fullName"]},
        timeout=10,
    )

    pwd = httpx.post(
        f"{API_BASE}/api/v1/auth/me/change-password",
        headers=headers,
        json={
            "currentPassword": "password123",
            "newPassword": "password123",
        },
        timeout=10,
    )
    assert pwd.status_code == 400
