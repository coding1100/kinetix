"""Verify a task comment includes attachments in the API response."""
import asyncio
import os

from dotenv import load_dotenv

load_dotenv(".env")


async def main() -> None:
    from sqlalchemy import select
    from sqlalchemy.ext.asyncio import create_async_engine
    from sqlalchemy.ext.asyncio import AsyncSession
    from sqlalchemy.orm import selectinload

    from app.db.models.home import Task, TaskComment, TaskAttachment, TaskList, Space, TaskAssignee
    from app.services.home_helpers import map_task
    from app.services.home_service import _TASK_LOAD

    engine = create_async_engine(os.environ["DATABASE_URL"])
    async with AsyncSession(engine) as session:
        # Find the comment we just linked
        import psycopg2
        db_url = os.environ["DATABASE_URL"].replace("postgresql+asyncpg://", "postgresql://")
        conn = psycopg2.connect(db_url)
        cur = conn.cursor()
        cur.execute(
            'SELECT "taskId", "userId", id FROM "TaskComment" WHERE id IN '
            '(SELECT "commentId" FROM "TaskAttachment" WHERE "commentId" IS NOT NULL LIMIT 1)'
        )
        row = cur.fetchone()
        conn.close()

        if not row:
            print("No comment-linked attachments found")
            return

        task_id, user_id, comment_id = row
        print(f"Testing task_id={task_id[:8]}... comment_id={comment_id[:8]}...")

        task = await session.scalar(
            select(Task).where(Task.id == task_id).options(*_TASK_LOAD)
        )
        if not task:
            print("Task not found")
            return

        payload = map_task(task, user_id)
        comments = payload.get("comments", [])
        print(f"Total comments in payload: {len(comments)}")
        for c in comments:
            atts = c.get("attachments", [])
            print(f"  comment={c['id'][:8]}... body={repr(c['body'][:40])} attachments={len(atts)}")
            for a in atts:
                print(f"    -> file={a['fileName']} status={a['status']} hasDownloadUrl={bool(a.get('downloadUrl'))}")


asyncio.run(main())
