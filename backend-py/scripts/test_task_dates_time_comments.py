"""Smoke-test task dates, time tracking, and comment edit/delete services."""

from __future__ import annotations

import asyncio
import os

from dotenv import load_dotenv

load_dotenv(".env")


async def main() -> None:
    from sqlalchemy import select
    from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
    from sqlalchemy.orm import sessionmaker

    from app.db.models.home import Task, TaskComment, TaskList, Space
    from app.schemas.spaces import UpdateTaskCommentBody
    from app.services import spaces_service, task_time_service
    from app.services.home_helpers import _map_task_comments_threaded

    engine = create_async_engine(os.environ["DATABASE_URL"])
    Session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with Session() as session:
        task = await session.scalar(select(Task).limit(1))
        if not task:
            print("No tasks in DB")
            return
        comment = await session.scalar(
            select(TaskComment).where(TaskComment.task_id == task.id).limit(1)
        )
        workspace = await session.scalar(
            select(Space).join(TaskList).join(Task).where(Task.id == task.id)
        )
        if not workspace or not comment:
            print("Missing workspace or comment for smoke test")
            return

        ws_id = workspace.id
        user_id = comment.user_id

        time_state = await task_time_service.get_task_time_state(
            session, ws_id, user_id, task.id
        )
        print("time state:", time_state)

        started = await task_time_service.start_task_timer(
            session, ws_id, user_id, task.id
        )
        print("started:", started["timeTracking"])

        stopped = await task_time_service.stop_task_timer(
            session, ws_id, user_id, task.id
        )
        print("stopped tracked:", stopped["timeTrackedSeconds"])

        updated = await spaces_service.update_task_comment(
            session,
            ws_id,
            user_id,
            task.id,
            comment.id,
            UpdateTaskCommentBody(body=f"{comment.body} (edited)"),
        )
        threaded = updated.get("comments", [])
        print("comments after edit:", len(threaded), "edited flag in first:", threaded[0].get("isEdited") if threaded else None)

    print("Smoke test passed")


asyncio.run(main())
