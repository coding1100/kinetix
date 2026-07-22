"""Diff every ORM model's columns against the live DB schema. Read-only, no changes made.

Run: python scripts/check_schema_drift.py

Reports:
  - MISSING (in model, not in DB) -> exactly what causes "column X does not exist" errors,
    plus which scripts/run_*_migration.py to run to fix it
  - EXTRA   (in DB, not in model) -> informational, usually harmless
"""

from __future__ import annotations

import asyncio
import re
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

import app.db.models  # noqa: F401 - registers all tables on Base.metadata
from app.db.base import Base

SCRIPTS_DIR = Path(__file__).parent


def _sql_files_by_table() -> dict[str, list[str]]:
    """Map table name -> .sql files that CREATE/ALTER it, by scanning scripts/*.sql."""
    table_pattern = re.compile(
        r'(?:ALTER TABLE|CREATE TABLE(?:\s+IF NOT EXISTS)?)\s+"([^"]+)"', re.IGNORECASE
    )
    result: dict[str, list[str]] = {}
    for sql_file in SCRIPTS_DIR.glob("*.sql"):
        raw = sql_file.read_text(encoding="utf-8")
        for table_name in table_pattern.findall(raw):
            result.setdefault(table_name, []).append(sql_file.name)
    return result


def _runner_by_sql_file() -> dict[str, str]:
    """Map .sql filename -> the run_*.py script that applies it, by scanning
    scripts/run_*.py for their `Path(__file__).with_name("<file>.sql")` call."""
    with_name_pattern = re.compile(r'with_name\(\s*["\']([^"\']+\.sql)["\']\s*\)')
    result: dict[str, str] = {}
    for py_file in SCRIPTS_DIR.glob("run_*.py"):
        raw = py_file.read_text(encoding="utf-8")
        match = with_name_pattern.search(raw)
        if match:
            result[match.group(1)] = py_file.name
    return result


def _scripts_for_table(table_name: str, sql_by_table: dict, runner_by_sql: dict) -> str:
    sql_files = sql_by_table.get(table_name, [])
    if not sql_files:
        return "no matching migration script found - check for a scripts/migrate_*.sql covering this table"
    labels = []
    for sql_file in sql_files:
        runner = runner_by_sql.get(sql_file)
        labels.append(runner if runner else f"{sql_file} (no run_*.py wraps it - run via psql directly)")
    return ", ".join(sorted(set(labels)))


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

    sql_by_table = _sql_files_by_table()
    runner_by_sql = _runner_by_sql_file()

    any_drift = False
    scripts_to_run: list[str] = []
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
                suggestion = _scripts_for_table(table.name, sql_by_table, runner_by_sql)
                print(f"[{table.name}] TABLE MISSING FROM DB -> run: {suggestion}")
                scripts_to_run.extend(suggestion.split(", "))
                continue

            missing = sorted(model_columns - db_columns)
            extra = sorted(db_columns - model_columns)

            if missing:
                any_drift = True
                suggestion = _scripts_for_table(table.name, sql_by_table, runner_by_sql)
                print(f"[{table.name}] MISSING (model has, DB doesn't): {missing} -> run: {suggestion}")
                scripts_to_run.extend(suggestion.split(", "))
            if extra:
                print(f"[{table.name}] EXTRA (DB has, model doesn't): {extra}")

    await engine.dispose()

    if any_drift:
        runnable = sorted({s for s in scripts_to_run if s.endswith(".py")})
        unresolved = sorted({s for s in scripts_to_run if not s.endswith(".py")})
        print("\nSchema drift found. Scripts to run:")
        for script in runnable:
            print(f"  python scripts/{script}")
        for note in unresolved:
            print(f"  MANUAL: {note}")
    else:
        print("\nNo drift - DB schema matches all ORM models.")


if __name__ == "__main__":
    asyncio.run(main())
