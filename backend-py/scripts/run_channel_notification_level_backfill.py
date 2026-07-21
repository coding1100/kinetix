"""Backfill ChatChannelMember.notificationLevel MENTIONS -> ALL. Run once:
uv run python scripts/run_channel_notification_level_backfill.py"""

from __future__ import annotations

import asyncio
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class _Env(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    direct_url: str = ""
    database_url: str


def _asyncpg_url(raw: str) -> str:
    if raw.startswith("postgresql+asyncpg://"):
        return raw.replace("postgresql+asyncpg://", "postgresql://", 1)
    return raw


async def main() -> None:
    import asyncpg

    env = _Env()
    url = _asyncpg_url(env.direct_url or env.database_url)
    sql_path = Path(__file__).with_name(
        "backfill_channel_notification_level_default.sql"
    )
    lines = [
        line
        for line in sql_path.read_text(encoding="utf-8").splitlines()
        if line.strip() and not line.strip().startswith("--")
    ]
    statement = "\n".join(lines).rstrip(";")

    conn = await asyncpg.connect(url)
    try:
        result = await conn.execute(statement)
        print(result)
    finally:
        await conn.close()

    print("ChatChannelMember.notificationLevel backfill complete.")


if __name__ == "__main__":
    asyncio.run(main())
