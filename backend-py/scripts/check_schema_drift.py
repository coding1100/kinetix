"""Diff every ORM model's columns against the live DB schema. Read-only, no changes made.

Run: python scripts/check_schema_drift.py

Reports:
  - MISSING (in model, not in DB) -> exactly what causes "column X does not exist" errors
  - EXTRA   (in DB, not in model) -> informational, usually harmless
"""

from __future__ import annotations

import asyncio

from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

import app.db.models  # noqa: F401 - registers all tables on Base.metadata
from app.db.base import Base


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

    any_drift = False
    async with engine.begin() as conn:
        for table in Base.metadata.sorted_tables:
            model_columns = {col.name for col in table.columns}

            result = await conn.execute(
                text(
                    "SELECT column_name FROM information_schema.columns "
                    "WHERE table_schema = 'public' AND table_name = :table_name"
                ),
                {"table_name": table.name},
            )
            db_columns = {row[0] for row in result}

            if not db_columns:
                any_drift = True
                print(f"[{table.name}] TABLE MISSING FROM DB")
                continue

            missing = sorted(model_columns - db_columns)
            extra = sorted(db_columns - model_columns)

            if missing:
                any_drift = True
                print(f"[{table.name}] MISSING (model has, DB doesn't): {missing}")
            if extra:
                print(f"[{table.name}] EXTRA (DB has, model doesn't): {extra}")

    await engine.dispose()

    if any_drift:
        print("\nSchema drift found - run the matching scripts/run_*_migration.py for each MISSING entry above.")
    else:
        print("\nNo drift - DB schema matches all ORM models.")


if __name__ == "__main__":
    asyncio.run(main())
