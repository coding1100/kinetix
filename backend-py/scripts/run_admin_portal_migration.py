"""Add platform admin portal tables/columns. Run once: python scripts/run_admin_portal_migration.py"""

from __future__ import annotations

from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class _Env(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    direct_url: str = ""
    database_url: str


def _sync_url(raw: str) -> str:
    if raw.startswith("postgresql+asyncpg://"):
        return raw.replace("postgresql+asyncpg://", "postgresql://", 1)
    return raw


def main() -> None:
    import psycopg2

    env = _Env()
    url = _sync_url(env.direct_url or env.database_url)
    sql_path = Path(__file__).with_name("migrate_admin_portal.sql")
    raw = sql_path.read_text(encoding="utf-8")

    conn = psycopg2.connect(url)
    conn.autocommit = True
    try:
        with conn.cursor() as cur:
            cur.execute(raw)
    finally:
        conn.close()

    print("Admin portal tables/columns are ready.")


if __name__ == "__main__":
    main()
