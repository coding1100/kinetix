"""Apply versioned SQL migrations before application startup."""

from __future__ import annotations

import asyncio
import hashlib
import sys
from pathlib import Path

from sqlalchemy import text

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.db.session import get_engine

MIGRATIONS: tuple[str, ...] = (
    "migrate_google_oauth.sql",
    "migrate_channel_created_by.sql",
    "create_message_attachments.sql",
    "migrate_chat_enhancements.sql",
    "migrate_channel_icon.sql",
    "backfill_channel_notification_level_default.sql",
    "migrate_content_ownership.sql",
    "migrate_folder_list_privacy.sql",
    "migrate_space_is_personal.sql",
    "migrate_space_permissions.sql",
    "migrate_share_grants.sql",
    "migrate_space_status_config.sql",
    "migrate_list_status_config.sql",
    "migrate_list_status_followers.sql",
    "migrate_lineup_recents.sql",
    "migrate_member_time_permissions.sql",
    "migrate_workspace_manager.sql",
    "migrate_workspace_soft_delete.sql",
    "migrate_task_activity_log.sql",
    "migrate_task_assignee_follower_arrays.sql",
    "migrate_task_checklists.sql",
    "migrate_task_subtasks_attachments.sql",
    "migrate_task_comment_attachments.sql",
    "migrate_task_comment_threads.sql",
    "migrate_task_dates_time.sql",
    "migrate_task_dependencies.sql",
    "migrate_list_channel.sql",
    "migrate_teams.sql",
    "migrate_team_bookmarks.sql",
    "migrate_thread_last_reply.sql",
    "migrate_invite_cancelled.sql",
    "migrate_invite_email_status.sql",
    "migrate_invite_invited_by_cascade.sql",
    "migrate_admin_portal.sql",
    "migrate_platform_super_admin.sql",
    "migrate_chat_canvas_huddles.sql",
    "migrate_planning_stack.sql",
    "migrate_composite_performance_indexes.sql",
    "migrate_inam_password.sql",
    "migrate_refresh_token_grace_period.sql",
    "migrate_knowledge_base.sql",
)




def _checksum(raw: str) -> str:
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def _split_sql_statements(sql: str) -> list[str]:
    """Split PostgreSQL SQL without breaking strings or dollar-quoted blocks."""
    statements: list[str] = []
    start = 0
    i = 0
    quote: str | None = None
    dollar_tag: str | None = None
    line_comment = False
    block_comment = False

    while i < len(sql):
        char = sql[i]
        next_char = sql[i + 1] if i + 1 < len(sql) else ""

        if line_comment:
            if char in "\r\n":
                line_comment = False
            i += 1
            continue

        if block_comment:
            if char == "*" and next_char == "/":
                block_comment = False
                i += 2
            else:
                i += 1
            continue

        if quote:
            if char == quote:
                if next_char == quote:
                    i += 2
                    continue
                quote = None
            elif char == "\\" and quote == "'":
                i += 2
                continue
            i += 1
            continue

        if dollar_tag:
            if sql.startswith(dollar_tag, i):
                i += len(dollar_tag)
                dollar_tag = None
            else:
                i += 1
            continue

        if char == "-" and next_char == "-":
            line_comment = True
            i += 2
            continue
        if char == "/" and next_char == "*":
            block_comment = True
            i += 2
            continue
        if char in "'\"":
            quote = char
            i += 1
            continue
        if char == "$":
            end = sql.find("$", i + 1)
            if end != -1:
                candidate = sql[i : end + 1]
                if candidate[1:-1] == "" or all(
                    c.isalnum() or c == "_" for c in candidate[1:-1]
                ):
                    dollar_tag = candidate
                    i = end + 1
                    continue
        if char == ";":
            statement = sql[start:i].strip()
            if statement:
                statements.append(statement)
            start = i + 1
        i += 1

    trailing = sql[start:].strip()
    if trailing:
        statements.append(trailing)
    return statements


async def main() -> None:
    scripts_dir = Path(__file__).parent
    engine = get_engine()

    from app.db import models  # noqa: F401
    from app.db.base import Base

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        await conn.execute(
            text(
                """
                CREATE TABLE IF NOT EXISTS "SchemaMigration" (
                    "name" TEXT PRIMARY KEY,
                    "checksum" TEXT NOT NULL,
                    "appliedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
                )
                """
            )
        )

    for name in MIGRATIONS:
        async with engine.begin() as conn:
            path = scripts_dir / name
            if not path.exists():
                raise RuntimeError(f"Missing migration file: {name}")

            raw = path.read_text(encoding="utf-8").strip()
            checksum = _checksum(raw)
            row = (
                await conn.execute(
                    text('SELECT "checksum" FROM "SchemaMigration" WHERE "name" = :name'),
                    {"name": name},
                )
            ).first()
            if row:
                if row[0] != checksum:
                    raise RuntimeError(f"Migration checksum changed after apply: {name}")
                continue

            # asyncpg prepares each exec_driver_sql call and rejects multiple
            # commands in one prepared statement. Split only at top-level
            # semicolons so strings, comments, and DO $$...$$ blocks stay intact.
            for position, statement in enumerate(_split_sql_statements(raw), start=1):
                try:
                    await conn.exec_driver_sql(statement)
                except Exception as exc:
                    raise RuntimeError(
                        f"Migration {name} failed at statement {position}"
                    ) from exc
            await conn.execute(
                text(
                    'INSERT INTO "SchemaMigration" ("name", "checksum") '
                    "VALUES (:name, :checksum)"
                ),
                {"name": name, "checksum": checksum},
            )
            print(f"applied migration: {name}")

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
