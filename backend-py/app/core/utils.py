import re
import secrets
from datetime import datetime, timezone


def generate_token(nbytes: int = 32) -> str:
    return secrets.token_hex(nbytes)


def as_aware_utc(dt: datetime) -> datetime:
    """Every timestamp column in this DB is `timestamp without time zone`
    (schema drift from the SQLAlchemy models, which declare
    DateTime(timezone=True)) but is always populated with a UTC instant -
    CURRENT_TIMESTAMP runs with the session timezone set to UTC. asyncpg
    therefore hands back a naive datetime that is, in fact, UTC.

    Calling .isoformat() on that naive value omits the offset entirely
    (e.g. "2026-08-06T07:41:59"), and the frontend's `new Date(...)` parses
    a timezone-less string as local time, not UTC - silently shifting every
    displayed timestamp by the viewer's UTC offset. Stamp it as UTC before
    formatting so the offset travels with the value.

    Safe to call on an already-aware datetime (returned unchanged).
    """
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt


def utc_isoformat(dt: datetime) -> str:
    """as_aware_utc(dt).isoformat() — the form used at nearly every call site
    that serializes a created_at/updated_at/etc. for the frontend."""
    return as_aware_utc(dt).isoformat()


def slugify(name: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", name.lower().strip())
    return slug.strip("-")[:48] or "workspace"


async def unique_workspace_slug(base: str, exists) -> str:
    slug = slugify(base)
    suffix = 0
    while True:
        candidate = slug if suffix == 0 else f"{slug}-{suffix}"
        if not await exists(candidate):
            return candidate
        suffix += 1
