"""Print createdById for Members channel."""

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
    engine = create_async_engine(
        _async_url(env.direct_url or env.database_url),
        connect_args={"statement_cache_size": 0},
    )
    async with engine.begin() as conn:
        rows = (
            await conn.execute(
                text(
                    """
                    SELECT c.id, c.name, c."createdById", u.email,
                           (SELECT COUNT(*) FROM "ChatMessage" m
                            WHERE m."channelId" = c.id AND m."parentId" IS NULL) AS msg_count
                    FROM "ChatChannel" c
                    LEFT JOIN "User" u ON u.id = c."createdById"
                    WHERE lower(c.name) LIKE '%members channel%'
                    """
                )
            )
        ).all()
        for row in rows:
            print(dict(row._mapping))
        alex = await conn.execute(
            text('SELECT id, email FROM "User" WHERE email = :e'),
            {"e": "alex@demo.com"},
        )
        print("alex", alex.first())

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
