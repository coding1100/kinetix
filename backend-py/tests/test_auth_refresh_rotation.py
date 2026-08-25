"""Per-device refresh token tests.

test_auth_refresh.py mocks refresh_session out entirely, so the actual
lookup/expiry-sliding logic it stands on was never exercised. These tests
drive auth_service.refresh_session and issue_refresh_for_user directly
against a fake session so that logic is covered without needing a database.

Design being tested: each device/login gets its own refresh token that
keeps the SAME value for its whole life. Refreshing slides that one row's
expires_at forward by another full window; it never touches any other
row, so no device can ever strand another device's still-valid token
(the previous JWT-rotation design could, and did, in production - see
daily-report.md for 2026-08-25).
"""

from datetime import datetime, timedelta, timezone

import pytest

from app.core.errors import AppError
from app.services import auth_service


class _FakeRefreshRow:
    def __init__(self, user_id: str, token_hash: str, expires_at):
        self.id = token_hash
        self.user_id = user_id
        self.token_hash = token_hash
        self.expires_at = expires_at


class _FakeUser:
    def __init__(self, user_id="u1", email="a@test.com"):
        self.id = user_id
        self.email = email
        self.full_name = "A"
        self.avatar_url = None
        self.is_disabled = False


class _FakeSession:
    """Minimal stand-in for AsyncSession covering what refresh_session and
    issue_refresh_for_user use. `rows` holds every RefreshToken row across
    all users, as the real table does."""

    def __init__(self, rows, users):
        self.rows = rows
        self._users = {u.id: u for u in users}
        self.added = []
        self.deleted = []
        self.committed = False

    async def scalar(self, query):
        # Both call sites this test exercises do an exact token_hash lookup
        # with an expires_at > now filter, applied here via a linear scan
        # since we don't have a real SQL engine.
        whereclause = query.whereclause
        conditions = (
            list(whereclause.clauses) if hasattr(whereclause, "clauses") else [whereclause]
        )
        candidates = list(self.rows)
        for cond in conditions:
            col = cond.left.key
            if col == "tokenHash":
                value = cond.right.value
                candidates = [r for r in candidates if r.token_hash == value]
            elif col == "expiresAt":
                value = cond.right.value
                candidates = [r for r in candidates if r.expires_at > value]
        return candidates[0] if candidates else None

    async def get(self, _model, pk):
        return self._users.get(pk)

    def add(self, obj):
        self.added.append(obj)
        self.rows.append(obj)

    async def delete(self, obj):
        self.deleted.append(obj)
        if obj in self.rows:
            self.rows.remove(obj)

    async def flush(self):
        pass

    async def commit(self):
        self.committed = True


@pytest.fixture
def patched(monkeypatch):
    """Bypass random token generation and bcrypt so tests stay deterministic
    and fast; hash_reset_token (SHA-256) is left real since it's cheap and
    deterministic already."""
    monkeypatch.setattr(auth_service, "generate_token", lambda: "raw-device-token")
    monkeypatch.setattr(
        auth_service, "sign_access_token", lambda **_k: "new-access"
    )


@pytest.mark.asyncio
async def test_issue_then_refresh_keeps_same_token_value(patched):
    user = _FakeUser()
    session = _FakeSession([], [user])

    raw = await auth_service.issue_refresh_for_user(session, user.id)
    assert raw == "raw-device-token"
    assert len(session.rows) == 1
    # Force a visible gap: without this, issuance and refresh can compute
    # datetime.now() close enough together that the two expiries land on
    # the same microsecond, which would make the "slid forward" assertion
    # meaningless rather than actually wrong.
    session.rows[0].expires_at -= timedelta(seconds=5)
    first_expiry = session.rows[0].expires_at

    result = await auth_service.refresh_session(session, raw)

    assert result["accessToken"] == "new-access"
    # Same device, same token value - never rotated to a new one.
    assert result["refreshToken"] == raw
    assert len(session.rows) == 1, "refresh must not create a second row"
    assert session.rows[0].expires_at > first_expiry, "expiry must slide forward"


@pytest.mark.asyncio
async def test_two_devices_are_fully_independent(patched):
    """Regression: the old rotation design invalidated a device's token the
    moment ANY other device for the same user refreshed (or, worse, only
    once its OWN grace period elapsed - the production bug this replaces).
    Confirm refreshing device A's token never touches device B's row."""
    from app.core.security import hash_reset_token

    user = _FakeUser()
    now = datetime.now(timezone.utc)
    row_a = _FakeRefreshRow(user.id, hash_reset_token("token-a"), now + timedelta(days=7))
    row_b = _FakeRefreshRow(user.id, hash_reset_token("token-b"), now + timedelta(days=7))
    session = _FakeSession([row_a, row_b], [user])

    result_a = await auth_service.refresh_session(session, "token-a")

    assert result_a["refreshToken"] == "token-a"
    # Device B's row must be untouched: same expiry, still present, still
    # matches its own original token value.
    assert row_b.expires_at == now + timedelta(days=7)
    result_b = await auth_service.refresh_session(session, "token-b")
    assert result_b["refreshToken"] == "token-b"
    assert len(session.rows) == 2, "neither refresh should delete the other's row"


@pytest.mark.asyncio
async def test_stale_but_unexpired_token_still_refreshes(patched):
    """The scenario that broke in production: a device idle for hours (well
    past any short 'grace period') presents a token that was issued long
    ago and never used since. As long as it hasn't hit its own 7-day
    expiry, refresh must succeed - there is no rotation to have raced."""
    from app.core.security import hash_reset_token

    user = _FakeUser()
    now = datetime.now(timezone.utc)
    stale_but_valid = now - timedelta(days=6, hours=23)  # created 6d23h ago
    row = _FakeRefreshRow(
        user.id, hash_reset_token("old-device-token"), stale_but_valid + timedelta(days=7)
    )
    session = _FakeSession([row], [user])

    result = await auth_service.refresh_session(session, "old-device-token")

    assert result["accessToken"] == "new-access"
    assert result["refreshToken"] == "old-device-token"


@pytest.mark.asyncio
async def test_expired_token_is_rejected(patched):
    from app.core.security import hash_reset_token

    user = _FakeUser()
    now = datetime.now(timezone.utc)
    row = _FakeRefreshRow(
        user.id, hash_reset_token("expired-token"), now - timedelta(seconds=1)
    )
    session = _FakeSession([row], [user])

    with pytest.raises(AppError) as excinfo:
        await auth_service.refresh_session(session, "expired-token")

    assert excinfo.value.status_code == 401
    assert excinfo.value.code == "INVALID_REFRESH"


@pytest.mark.asyncio
async def test_unknown_token_is_rejected(patched):
    user = _FakeUser()
    session = _FakeSession([], [user])

    with pytest.raises(AppError) as excinfo:
        await auth_service.refresh_session(session, "never-issued")

    assert excinfo.value.status_code == 401
    assert excinfo.value.code == "INVALID_REFRESH"


@pytest.mark.asyncio
async def test_disabled_user_is_rejected(patched):
    from app.core.security import hash_reset_token

    user = _FakeUser()
    user.is_disabled = True
    now = datetime.now(timezone.utc)
    row = _FakeRefreshRow(user.id, hash_reset_token("tok"), now + timedelta(days=7))
    session = _FakeSession([row], [user])

    with pytest.raises(AppError) as excinfo:
        await auth_service.refresh_session(session, "tok")

    assert excinfo.value.status_code == 403
    assert excinfo.value.code == "ACCOUNT_DISABLED"
