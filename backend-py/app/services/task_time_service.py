from datetime import datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AppError
from app.db.models.home import Space, Task, TaskList, TaskTimeEntry


async def _assert_task_in_workspace(
    session: AsyncSession, workspace_id: str, task_id: str
) -> Task:
    task = await session.scalar(
        select(Task)
        .join(TaskList)
        .join(Space)
        .where(Task.id == task_id, Space.workspace_id == workspace_id)
    )
    if not task:
        raise AppError(404, "NOT_FOUND", "Task not found")
    return task


async def _total_tracked_seconds(
    session: AsyncSession, task_id: str, *, now: datetime | None = None
) -> int:
    now = now or datetime.now(timezone.utc)
    entries = (
        await session.scalars(
            select(TaskTimeEntry).where(TaskTimeEntry.task_id == task_id)
        )
    ).all()
    total = 0
    for entry in entries:
        end = entry.ended_at or now
        start = entry.started_at
        if start.tzinfo is None:
            start = start.replace(tzinfo=timezone.utc)
        if end.tzinfo is None:
            end = end.replace(tzinfo=timezone.utc)
        delta = int((end - start).total_seconds())
        if delta > 0:
            total += delta
    return total


async def get_task_time_state(
    session: AsyncSession,
    workspace_id: str,
    user_id: str,
    task_id: str,
) -> dict:
    await _assert_task_in_workspace(session, workspace_id, task_id)
    running = await session.scalar(
        select(TaskTimeEntry).where(
            TaskTimeEntry.task_id == task_id,
            TaskTimeEntry.user_id == user_id,
            TaskTimeEntry.ended_at.is_(None),
        )
    )
    total = await _total_tracked_seconds(session, task_id)
    return {
        "timeTrackedSeconds": total,
        "timeTracking": {
            "active": running is not None,
            "entryId": running.id if running else None,
            "startedAt": running.started_at.isoformat() if running else None,
        },
    }


async def _task_payload(
    session: AsyncSession,
    workspace_id: str,
    user_id: str,
    task_id: str,
) -> dict:
    # Reuse canonical task mapping to keep TaskDrawer state stable
    # (comments/activity, subtasks, attachments, and time state).
    from app.services.home_service import get_task

    return await get_task(session, workspace_id, user_id, task_id)


async def start_task_timer(
    session: AsyncSession,
    workspace_id: str,
    user_id: str,
    task_id: str,
) -> dict:
    task = await _assert_task_in_workspace(session, workspace_id, task_id)

    existing = await session.scalar(
        select(TaskTimeEntry).where(
            TaskTimeEntry.user_id == user_id,
            TaskTimeEntry.ended_at.is_(None),
        )
    )
    if existing:
        if existing.task_id != task_id:
            raise AppError(
                400,
                "VALIDATION_ERROR",
                "Stop the active timer on another task first",
            )
        await session.commit()
        return await _task_payload(session, workspace_id, user_id, task_id)

    entry = TaskTimeEntry(
        task_id=task_id,
        workspace_id=workspace_id,
        user_id=user_id,
        started_at=datetime.now(timezone.utc),
    )
    session.add(entry)
    await session.commit()
    from app.services.notification_service import (
        create_task_activity_notifications,
        emit_home_notifications,
        task_notification_recipients,
    )

    recipients = await task_notification_recipients(
        session, task_id=task_id, exclude_user_id=user_id
    )
    notifications = await create_task_activity_notifications(
        session,
        workspace_id=workspace_id,
        actor_user_id=user_id,
        task_name=task.name,
        task_id=task_id,
        recipient_ids=recipients,
        title=f"Timer started: {task.name}",
        preview_template="{actor} started tracking time on {task}",
        activity_kind="task_timer_started",
    )
    if notifications:
        await session.commit()
        await emit_home_notifications(session, workspace_id, notifications)
    return await _task_payload(session, workspace_id, user_id, task_id)


async def stop_task_timer(
    session: AsyncSession,
    workspace_id: str,
    user_id: str,
    task_id: str,
) -> dict:
    task = await _assert_task_in_workspace(session, workspace_id, task_id)
    running = await session.scalar(
        select(TaskTimeEntry).where(
            TaskTimeEntry.task_id == task_id,
            TaskTimeEntry.user_id == user_id,
            TaskTimeEntry.ended_at.is_(None),
        )
    )
    if not running:
        raise AppError(400, "VALIDATION_ERROR", "No active timer for this task")
    running.ended_at = datetime.now(timezone.utc)
    await session.commit()
    from app.services.notification_service import (
        create_task_activity_notifications,
        emit_home_notifications,
        task_notification_recipients,
    )

    recipients = await task_notification_recipients(
        session, task_id=task_id, exclude_user_id=user_id
    )
    notifications = await create_task_activity_notifications(
        session,
        workspace_id=workspace_id,
        actor_user_id=user_id,
        task_name=task.name,
        task_id=task_id,
        recipient_ids=recipients,
        title=f"Timer stopped: {task.name}",
        preview_template="{actor} stopped tracking time on {task}",
        activity_kind="task_timer_stopped",
    )
    if notifications:
        await session.commit()
        await emit_home_notifications(session, workspace_id, notifications)
    return await _task_payload(session, workspace_id, user_id, task_id)
