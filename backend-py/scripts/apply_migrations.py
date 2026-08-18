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
    "migrate_share_grants.sql",
    "migrate_space_is_personal.sql",
    "migrate_space_permissions.sql",
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
    "migrate_task_comment_attachments.sql",
    "migrate_task_comment_threads.sql",
    "migrate_task_dates_time.sql",
    "migrate_task_dependencies.sql",
    "migrate_task_subtasks_attachments.sql",
    "migrate_list_channel.sql",
    "migrate_teams.sql",
    "migrate_team_bookmarks.sql",
    "migrate_thread_last_reply.sql",
    "migrate_invite_cancelled.sql",
    "migrate_invite_email_status.sql",
    "migrate_invite_invited_by_cascade.sql",
    "migrate_admin_portal.sql",
    "migrate_platform_super_admin.sql",
)


def _checksum(raw: str) -> str:
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


async def main() -> None:
    scripts_dir = Path(__file__).parent
    engine = get_engine()

    async with engine.begin() as conn:
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

            # Migration files intentionally contain complete SQL scripts, including
            # multiple statements and DO blocks. Use the driver SQL path so the
            # database receives the script as authored instead of treating it as a
            # single bound SQLAlchemy expression.
            await conn.exec_driver_sql(raw)
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
