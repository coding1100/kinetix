"""Quick Supabase connectivity probe."""

from __future__ import annotations

import asyncio
import ssl
import sys
from pathlib import Path

import asyncpg

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.config import get_settings


async def probe(label: str, dsn: str, ssl_mode) -> bool:
    try:
        conn = await asyncio.wait_for(
            asyncpg.connect(
                dsn,
                ssl=ssl_mode,
                statement_cache_size=0,
                timeout=20,
            ),
            timeout=25,
        )
        value = await conn.fetchval("SELECT 1")
        await conn.close()
        print(f"{label}: OK ({value})")
        return True
    except Exception as exc:
        print(f"{label}: FAIL ({type(exc).__name__}: {exc})")
        return False


async def probe_sqlalchemy() -> bool:
    from sqlalchemy import text

    from app.db.session import get_engine

    try:
        engine = get_engine()
        async with engine.connect() as conn:
            value = await conn.execute(text("SELECT 1"))
            print(f"sqlalchemy: OK ({value.scalar()})")
            return True
    except Exception as exc:
        print(f"sqlalchemy: FAIL ({type(exc).__name__}: {exc})")
        return False


async def main() -> int:
    settings = get_settings()
    dsn = settings.runtime_database_url.replace(
        "postgresql+asyncpg://", "postgresql://"
    ).replace("postgresql://", "postgres://", 1)
    if dsn.startswith("postgres://"):
        dsn = "postgresql://" + dsn[len("postgres://") :]

    print("URL:", dsn.split("@")[-1])

    if await probe_sqlalchemy():
        return 0

    ssl_ctx = ssl.create_default_context()
    for label, mode in [
        ("no-ssl", False),
        ("ssl-require", "require"),
        ("ssl-context", ssl_ctx),
    ]:
        if await probe(label, dsn, mode):
            return 0
    return 1


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
