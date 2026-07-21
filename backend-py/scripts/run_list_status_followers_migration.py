"""Apply ListStatus + TaskFollower schema and backfill default statuses."""

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
    import uuid

    env = _Env()
    url = _sync_url(env.direct_url or env.database_url)
    sql_path = Path(__file__).with_name("migrate_list_status_followers.sql")
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
            cur.execute(
                """
                SELECT 1 FROM pg_type t
                JOIN pg_namespace n ON n.oid = t.typnamespace
                WHERE t.typname = 'StatusGroup' AND n.nspname = current_schema()
                """
            )
            if not cur.fetchone():
                cur.execute(
                    """
                    CREATE TYPE "StatusGroup" AS ENUM (
                      'NOT_STARTED', 'ACTIVE', 'DONE', 'CLOSED'
                    )
                    """
                )

            for stmt in statements:
                cur.execute(stmt)

            cur.execute('SELECT id FROM "TaskList"')
            list_ids = [row[0] for row in cur.fetchall()]
            defaults = [
                ("OPEN", "open", "#5f55ee", "NOT_STARTED", 0),
                ("TODO", "to do", "#87909e", "NOT_STARTED", 1),
                ("IN_PROGRESS", "in progress", "#4194f6", "ACTIVE", 2),
                ("DONE", "done", "#6bc950", "DONE", 3),
            ]
            for list_id in list_ids:
                cur.execute(
                    'SELECT COUNT(*) FROM "ListStatus" WHERE "listId" = %s',
                    (list_id,),
                )
                if cur.fetchone()[0]:
                    continue
                status_ids: dict[str, str] = {}
                for legacy, name, color, group, order in defaults:
                    sid = str(uuid.uuid4())
                    status_ids[legacy] = sid
                    cur.execute(
                        """
                        INSERT INTO "ListStatus"
                          (id, "listId", name, color, "statusGroup", "legacyKey", "sortOrder")
                        VALUES (%s, %s, %s, %s, %s::"StatusGroup", %s, %s)
                        """,
                        (sid, list_id, name, color, group, legacy, order),
                    )
                cur.execute(
                    'SELECT id, status FROM "Task" WHERE "listId" = %s',
                    (list_id,),
                )
                for task_id, status in cur.fetchall():
                    legacy = status or "TODO"
                    sid = status_ids.get(legacy) or status_ids.get("TODO")
                    if sid:
                        color = next(
                            d[2] for d in defaults if d[0] == (legacy if legacy in status_ids else "TODO")
                        )
                        cur.execute(
                            'UPDATE "Task" SET "statusId" = %s, "statusColor" = %s WHERE id = %s',
                            (sid, color, task_id),
                        )
        conn.commit()
        print("Migration applied: ListStatus + TaskFollower + backfill")
    finally:
        conn.close()


if __name__ == "__main__":
    main()
