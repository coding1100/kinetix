"""Add parentCommentId column to TaskComment for threaded replies."""

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
    sql_path = Path(__file__).with_name("migrate_task_comment_threads.sql")
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

    conn = psycopg2.connect(url)
    try:
        with conn.cursor() as cur:
            for stmt in statements:
                cur.execute(stmt)
        conn.commit()
        print("Task comment threads migration applied successfully.")
    finally:
        conn.close()


if __name__ == "__main__":
    main()
