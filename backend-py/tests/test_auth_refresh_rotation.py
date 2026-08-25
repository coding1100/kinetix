"""Refresh-token rotation and grace-period tests.

test_auth_refresh.py mocks refresh_session out entirely, so the rotation
logic it stands on was never actually exercised. These tests drive
auth_service.refresh_session directly against a fake session so the
grace-period branch is covered without needing a database.
"""

from datetime import datetime, timedelta, timezone

import pytest

from app.core.errors import AppError
from app.services import auth_service


class _FakeRefreshRow:
    def __init__(self, token_hash: str, expires_at, rotated_at=None):
        self.id = token_hash
        self.token_hash = token_hash
        self.expires_at = expires_at
        self.rotated_at = rotated_at


class _FakeUser:
    def __init__(self, user_id="u1", email="a@test.com"):
        self.id = user_id
        self.email = email
        self.full_name = "A"
        self.avatar_url = None
        self.is_disabled = False


class _FakeScalarResult:
    def __init__(self, rows):
        self._rows = rows

    def all(self):
        return self._rows


class _FakeSession:
    """Minimal stand-in for AsyncSession covering what refresh_session uses."""

    def __init__(self, rows, user):
        self._rows = rows
        self._user = user
        self.added = []
        self.deleted = []
        self.committed = False

    async def scalars(self, _query):
        return _FakeScalarResult(self._rows)

    async def get(self, _model, _pk):
        return self._user

    def add(self, obj):
        self.added.append(obj)

    async def delete(self, obj):
        self.deleted.append(obj)

    async def flush(self):
        pass

    async def commit(self):
        self.committed = True


@pytest.fixture
def patched(monkeypatch):
    """Bypass JWT signing/verification and bcrypt so tests stay fast."""
    monkeypatch.setattr(
        auth_service, "verify_refresh_token", lambda _t: {"sub": "u1"}
    )
    monkeypatch.setattr(
        auth_service, "sign_access_token", lambda **_k: "new-access"
    )
    monkeypatch.setattr(
        auth_service, "sign_refresh_token", lambda _uid: "brand-new-refresh"
    )
    monkeypatch.setattr(auth_service, "hash_token", lambda t: f"hash::{t}")
    monkeypatch.setattr(
        auth_service,
        "verify_token_hash",
        lambda token, token_hash: token_hash == f"hash::{token}",
    )


@pytest.mark.asyncio
async def test_unrotated_token_rotates_and_issues_new_refresh(patched):
    now = datetime.now(timezone.utc)
    row = _FakeRefreshRow("hash::current", now + timedelta(days=7))
    session = _FakeSession([row], _FakeUser())

    result = await auth_service.refresh_session(session, "current")

    assert result["accessToken"] == "new-access"
    assert result["refreshToken"] == "brand-new-refresh"
    assert row.rotated_at is not None, "token should be marked rotated"
    assert session.committed


@pytest.mark.asyncio
async def test_reuse_within_grace_period_returns_a_usable_refresh_token(patched):
    """Regression: the grace branch must hand back a token the route can
    re-arm the cookie with. Returning None here dropped the Set-Cookie, so a
    tab that lost a concurrent-refresh race kept a cookie whose Max-Age was
    never renewed and got force-logged-out on a later refresh."""
    now = datetime.now(timezone.utc)
    row = _FakeRefreshRow(
        "hash::current",
        now + timedelta(days=7),
        rotated_at=now - timedelta(seconds=5),
    )
    session = _FakeSession([row], _FakeUser())

    result = await auth_service.refresh_session(session, "current")

    assert result["accessToken"] == "new-access"
    assert result["refreshToken"] is not None, (
        "grace-period reuse must return a token so /auth/refresh re-sets the "
        "cookie; returning None silently stops renewing its Max-Age"
    )
    assert result["refreshToken"] == "current"


@pytest.mark.asyncio
async def test_reuse_outside_grace_period_is_rejected(patched):
    now = datetime.now(timezone.utc)
    row = _FakeRefreshRow(
        "hash::current",
        now + timedelta(days=7),
        rotated_at=now - auth_service.ROTATION_GRACE_PERIOD - timedelta(seconds=5),
    )
    session = _FakeSession([row], _FakeUser())

    with pytest.raises(AppError) as excinfo:
        await auth_service.refresh_session(session, "current")

    assert excinfo.value.status_code == 401
    assert excinfo.value.code == "INVALID_REFRESH"


@pytest.mark.asyncio
async def test_unknown_token_is_rejected(patched):
    now = datetime.now(timezone.utc)
    row = _FakeRefreshRow("hash::someone-else", now + timedelta(days=7))
    session = _FakeSession([row], _FakeUser())

    with pytest.raises(AppError) as excinfo:
        await auth_service.refresh_session(session, "current")

    assert excinfo.value.status_code == 401
    assert excinfo.value.code == "INVALID_REFRESH"


@pytest.mark.asyncio
async def test_disabled_user_is_rejected(patched):
    now = datetime.now(timezone.utc)
    row = _FakeRefreshRow("hash::current", now + timedelta(days=7))
    user = _FakeUser()
    user.is_disabled = True
    session = _FakeSession([row], user)

    with pytest.raises(AppError) as excinfo:
        await auth_service.refresh_session(session, "current")

    assert excinfo.value.status_code == 403
    assert excinfo.value.code == "ACCOUNT_DISABLED"
