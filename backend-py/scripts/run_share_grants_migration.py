"""Apply share-grants migration (SpaceMember email/status + FolderMember/ListMember).
Run once: uv run python scripts/run_share_grants_migration.py"""

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
    sql_path = Path(__file__).with_name("migrate_share_grants.sql")
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

    conn = await asyncpg.connect(url)
    try:
        for stmt in statements:
            await conn.execute(stmt)
        print("Migration applied: SpaceMember email/status, FolderMember, ListMember")
    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(main())
