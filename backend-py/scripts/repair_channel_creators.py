"""Repair wrong createdById (e.g. backfill picked owner instead of real creator).

Sets createdById from first message author when it differs from stored value,
and fixes NULL creators for channels with no messages using earliest member.

Run: python scripts/repair_channel_creators.py
"""

from __future__ import annotations

import asyncio
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine


class _Env(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    direct_url: str = ""
    database_url: str


def _async_url(raw: str) -> str:
    if raw.startswith("postgresql://"):
        return raw.replace("postgresql://", "postgresql+asyncpg://", 1)
    if raw.startswith("postgres://"):
        return raw.replace("postgres://", "postgresql+asyncpg://", 1)
    return raw


async def main() -> None:
    env = _Env()
    url = _async_url(env.direct_url or env.database_url)
    engine = create_async_engine(url, connect_args={"statement_cache_size": 0})

    sql_path = Path(__file__).with_name("repair_channel_creators.sql")
    raw = sql_path.read_text(encoding="utf-8")
    statements: list[str] = []
    for block in raw.split(";"):
        lines = [
            line
            for line in block.strip().splitlines()
            if line.strip() and not line.strip().startswith("--")
        ]
        if lines:
            statements.append("\n".join(lines))

    async with engine.begin() as conn:
        for stmt in statements:
            await conn.execute(text(stmt))

    await engine.dispose()
    print("Channel creator repair complete.")


if __name__ == "__main__":
    asyncio.run(main())
