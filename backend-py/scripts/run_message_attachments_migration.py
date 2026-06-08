"""Create MessageAttachment table if missing. Run once: python scripts/run_message_attachments_migration.py"""

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

    sql_path = Path(__file__).with_name("create_message_attachments.sql")
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
        await conn.execute(text('SELECT 1 FROM "MessageAttachment" LIMIT 1'))

    await engine.dispose()
    print("MessageAttachment table is ready.")


if __name__ == "__main__":
    asyncio.run(main())
