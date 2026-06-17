from sqlalchemy import delete, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from datetime import datetime, timezone

from app.core.errors import AppError
from app.db.models.home import (
    Folder,
    Space,
    Task,
    TaskAttachment,
    TaskComment,
    TaskFollower,
    TaskList,
)
from app.schemas.spaces import (
    CreateFolderBody,
    CreateListBody,
    CreateSpaceBody,
    CreateTaskCommentBody,
    UpdateFolderBody,
    UpdateListBody,
    UpdateSpaceBody,
    UpdateTaskCommentBody,
)
from app.services.home_service import (
    _SPACE_LOAD,
    _TASK_LOAD,
    _active_member_count,
    _build_space_payload,
    _list_count_for_space,
)
from app.services.home_helpers import map_list_entry, map_task
from app.services.list_status_service import ensure_list_statuses
from app.services.notification_service import (
    create_task_comment_mention_notifications,
    create_task_comment_notifications,
    create_task_comment_reply_notifications,
    emit_home_notifications,
)


async def create_space(
    session: AsyncSession, workspace_id: str, body: CreateSpaceBody
) -> dict:
    space = Space(
        workspace_id=workspace_id,
        name=body.name.strip(),
        color=body.color or "#7B68EE",
        description=body.description,
    )
    session.add(space)
    await session.commit()
    refreshed = await session.scalar(
        select(Space).where(Space.id == space.id).options(*_SPACE_LOAD)
    )
    member_count = await _active_member_count(session, workspace_id)
    return _build_space_payload(refreshed, member_count, 0)


async def update_space(
    session: AsyncSession,
    workspace_id: str,
    space_id: str,
    body: UpdateSpaceBody,
) -> dict:
    space = await session.scalar(
        select(Space).where(Space.id == space_id, Space.workspace_id == workspace_id)
    )
    if not space:
        raise AppError(404, "NOT_FOUND", "Space not found")
    if body.name is not None:
        space.name = body.name.strip()
    if body.color is not None:
        space.color = body.color
    if body.description is not None:
        space.description = body.description or None
    await session.commit()
    refreshed = await session.scalar(
        select(Space)
        .where(Space.id == space_id)
        .options(*_SPACE_LOAD)
    )
    member_count = await _active_member_count(session, workspace_id)
    list_count = await _list_count_for_space(session, space_id)
    return _build_space_payload(refreshed, member_count, list_count)


async def delete_space(
    session: AsyncSession, workspace_id: str, space_id: str
) -> dict:
    space = await session.scalar(
        select(Space).where(Space.id == space_id, Space.workspace_id == workspace_id)
    )
    if not space:
        raise AppError(404, "NOT_FOUND", "Space not found")
    if space.is_personal:
        raise AppError(400, "VALIDATION_ERROR", "Cannot delete the Personal space")
    await session.delete(space)
    await session.commit()
    return {"ok": True}


async def create_folder(
    session: AsyncSession,
    workspace_id: str,
    space_id: str,
    body: CreateFolderBody,
) -> dict:
    space = await session.scalar(
        select(Space).where(Space.id == space_id, Space.workspace_id == workspace_id)
    )
    if not space:
        raise AppError(404, "NOT_FOUND", "Space not found")
    max_order = await session.scalar(
        select(func.max(Folder.sort_order)).where(Folder.space_id == space_id)
    )
    folder = Folder(
        space_id=space_id,
        name=body.name.strip(),
        sort_order=int(max_order or 0) + 1,
    )
    session.add(folder)
    await session.commit()
    return {"id": folder.id, "name": folder.name, "lists": []}


async def update_folder(
    session: AsyncSession,
    workspace_id: str,
    folder_id: str,
    body: UpdateFolderBody,
) -> dict:
    folder = await session.scalar(
        select(Folder)
        .join(Space)
        .where(Folder.id == folder_id, Space.workspace_id == workspace_id)
    )
    if not folder:
        raise AppError(404, "NOT_FOUND", "Folder not found")
    if body.name is not None:
        folder.name = body.name.strip()
    await session.commit()
    return {"id": folder.id, "name": folder.name}


async def delete_folder(
    session: AsyncSession, workspace_id: str, folder_id: str
) -> dict:
    folder = await session.scalar(
        select(Folder)
        .join(Space)
        .where(Folder.id == folder_id, Space.workspace_id == workspace_id)
    )
    if not folder:
        raise AppError(404, "NOT_FOUND", "Folder not found")
    await session.delete(folder)
    await session.commit()
    return {"ok": True}


async def create_list(
    session: AsyncSession,
    workspace_id: str,
    space_id: str,
    body: CreateListBody,
) -> dict:
    space = await session.scalar(
        select(Space).where(Space.id == space_id, Space.workspace_id == workspace_id)
    )
    if not space:
        raise AppError(404, "NOT_FOUND", "Space not found")
    folder_id = body.folder_id
    if folder_id:
        folder = await session.scalar(
            select(Folder).where(
                Folder.id == folder_id, Folder.space_id == space_id
            )
        )
        if not folder:
            raise AppError(404, "NOT_FOUND", "Folder not found")
    max_order = await session.scalar(
        select(func.max(TaskList.sort_order)).where(TaskList.space_id == space_id)
    )
    task_list = TaskList(
        space_id=space_id,
        folder_id=folder_id,
        name=body.name.strip(),
        sort_order=int(max_order or 0) + 1,
    )
    session.add(task_list)
    await session.flush()
    await ensure_list_statuses(session, task_list.id)
    await session.commit()
    return map_list_entry(task_list, 0)


async def update_list(
    session: AsyncSession,
    workspace_id: str,
    list_id: str,
    body: UpdateListBody,
) -> dict:
    task_list = await session.scalar(
        select(TaskList)
        .join(Space)
        .where(TaskList.id == list_id, Space.workspace_id == workspace_id)
    )
    if not task_list:
        raise AppError(404, "NOT_FOUND", "List not found")
    if body.name is not None:
        task_list.name = body.name.strip()
    await session.commit()
    count = await session.scalar(
        select(func.count()).select_from(Task).where(Task.list_id == list_id)
    )
    return map_list_entry(task_list, int(count or 0))


async def delete_list(
    session: AsyncSession, workspace_id: str, list_id: str
) -> dict:
    task_list = await session.scalar(
        select(TaskList)
        .join(Space)
        .where(TaskList.id == list_id, Space.workspace_id == workspace_id)
        .options(selectinload(TaskList.space))
    )
    if not task_list:
        raise AppError(404, "NOT_FOUND", "List not found")
    if task_list.space.is_personal and task_list.name == "Personal List":
        raise AppError(400, "VALIDATION_ERROR", "Cannot delete the Personal list")
    await session.delete(task_list)
    await session.commit()
    return {"ok": True}


async def _resolve_comment_thread_root(
    session: AsyncSession, parent_comment_id: str
) -> TaskComment:
    parent = await session.scalar(
        select(TaskComment).where(TaskComment.id == parent_comment_id)
    )
    if not parent:
        raise AppError(404, "NOT_FOUND", "Parent comment not found")
    root = parent
    while root.parent_comment_id:
        next_root = await session.scalar(
            select(TaskComment).where(TaskComment.id == root.parent_comment_id)
        )
        if not next_root:
            break
        root = next_root
    return root


async def add_task_comment(
    session: AsyncSession,
    workspace_id: str,
    user_id: str,
    task_id: str,
    body: CreateTaskCommentBody,
) -> dict:
    if not body.has_content:
        raise AppError(400, "VALIDATION_ERROR", "Comment body or attachment is required")

    task = await session.scalar(
        select(Task)
        .join(TaskList)
        .join(Space)
        .where(Task.id == task_id, Space.workspace_id == workspace_id)
    )
    if not task:
        raise AppError(404, "NOT_FOUND", "Task not found")

    parent_author_id: str | None = None
    thread_parent_id: str | None = None
    if body.parent_comment_id:
        direct_parent = await session.scalar(
            select(TaskComment).where(
                TaskComment.id == body.parent_comment_id,
                TaskComment.task_id == task_id,
            )
        )
        if not direct_parent:
            raise AppError(404, "NOT_FOUND", "Parent comment not found")
        parent_author_id = direct_parent.user_id
        thread_root = await _resolve_comment_thread_root(
            session, body.parent_comment_id
        )
        thread_parent_id = thread_root.id

    follower_ids = list(
        (
            await session.scalars(
                select(TaskFollower.user_id).where(TaskFollower.task_id == task_id)
            )
        ).all()
    )

    comment = TaskComment(
        task_id=task_id,
        user_id=user_id,
        body=body.body.strip(),
        parent_comment_id=thread_parent_id,
    )
    session.add(comment)
    await session.flush()

    if body.attachment_ids:
        await session.execute(
            update(TaskAttachment)
            .where(
                TaskAttachment.id.in_(body.attachment_ids),
                TaskAttachment.task_id == task_id,
                TaskAttachment.workspace_id == workspace_id,
                TaskAttachment.uploader_id == user_id,
            )
            .values(comment_id=comment.id)
        )

    comment_preview = body.body.strip() or "📎 Attachment"
    comment_notifications: list[tuple[str, object]] = []
    reply_notifications: list[tuple[str, object]] = []

    if thread_parent_id:
        reply_notifications = await create_task_comment_reply_notifications(
            session,
            workspace_id=workspace_id,
            actor_user_id=user_id,
            task_name=task.name,
            task_id=task_id,
            parent_author_id=parent_author_id or "",
            comment_preview=comment_preview,
        )
    else:
        comment_notifications = await create_task_comment_notifications(
            session,
            workspace_id=workspace_id,
            actor_user_id=user_id,
            task_name=task.name,
            task_id=task_id,
            comment_preview=comment_preview,
            follower_ids=follower_ids,
        )

    already_notified = {uid for uid, _ in comment_notifications + reply_notifications}
    mention_notifications = await create_task_comment_mention_notifications(
        session,
        workspace_id=workspace_id,
        actor_user_id=user_id,
        task_name=task.name,
        task_id=task_id,
        comment_body=body.body.strip(),
        already_notified_ids=already_notified,
    )

    await session.commit()
    all_notifications = comment_notifications + reply_notifications + mention_notifications
    if all_notifications:
        await emit_home_notifications(session, workspace_id, all_notifications)

    refreshed = await session.scalar(
        select(Task).where(Task.id == task_id).options(*_TASK_LOAD)
    )
    payload = map_task(refreshed, user_id)

    from app.services.task_attachment_service import map_task_attachment

    task_attachments = (
        await session.scalars(
            select(TaskAttachment)
            .where(
                TaskAttachment.task_id == task_id,
                TaskAttachment.workspace_id == workspace_id,
                TaskAttachment.status == "ready",
                TaskAttachment.comment_id.is_(None),
            )
            .order_by(TaskAttachment.created_at.asc())
        )
    ).all()
    payload["attachments"] = [map_task_attachment(a) for a in task_attachments]

    from app.services.task_time_service import get_task_time_state

    payload.update(await get_task_time_state(session, workspace_id, user_id, task_id))
    return payload


async def update_task_comment(
    session: AsyncSession,
    workspace_id: str,
    user_id: str,
    task_id: str,
    comment_id: str,
    body: UpdateTaskCommentBody,
) -> dict:
    comment = await session.scalar(
        select(TaskComment)
        .join(Task)
        .join(TaskList)
        .join(Space)
        .where(
            TaskComment.id == comment_id,
            TaskComment.task_id == task_id,
            Space.workspace_id == workspace_id,
        )
    )
    if not comment:
        raise AppError(404, "NOT_FOUND", "Comment not found")
    if comment.user_id != user_id:
        raise AppError(403, "FORBIDDEN", "You can only edit your own comments")

    comment.body = body.body.strip()
    comment.updated_at = datetime.now(timezone.utc)
    await session.commit()

    refreshed = await session.scalar(
        select(Task).where(Task.id == task_id).options(*_TASK_LOAD)
    )
    payload = map_task(refreshed, user_id)
    from app.services.task_attachment_service import map_task_attachment
    from app.services.task_time_service import get_task_time_state

    task_attachments = (
        await session.scalars(
            select(TaskAttachment)
            .where(
                TaskAttachment.task_id == task_id,
                TaskAttachment.workspace_id == workspace_id,
                TaskAttachment.status == "ready",
                TaskAttachment.comment_id.is_(None),
            )
            .order_by(TaskAttachment.created_at.asc())
        )
    ).all()
    payload["attachments"] = [map_task_attachment(a) for a in task_attachments]
    payload.update(await get_task_time_state(session, workspace_id, user_id, task_id))
    return payload


async def delete_task_comment(
    session: AsyncSession,
    workspace_id: str,
    user_id: str,
    task_id: str,
    comment_id: str,
) -> dict:
    comment = await session.scalar(
        select(TaskComment)
        .join(Task)
        .join(TaskList)
        .join(Space)
        .where(
            TaskComment.id == comment_id,
            TaskComment.task_id == task_id,
            Space.workspace_id == workspace_id,
        )
    )
    if not comment:
        raise AppError(404, "NOT_FOUND", "Comment not found")
    if comment.user_id != user_id:
        raise AppError(403, "FORBIDDEN", "You can only delete your own comments")

    await session.delete(comment)
    await session.commit()

    refreshed = await session.scalar(
        select(Task).where(Task.id == task_id).options(*_TASK_LOAD)
    )
    payload = map_task(refreshed, user_id)
    from app.services.task_attachment_service import map_task_attachment
    from app.services.task_time_service import get_task_time_state

    task_attachments = (
        await session.scalars(
            select(TaskAttachment)
            .where(
                TaskAttachment.task_id == task_id,
                TaskAttachment.workspace_id == workspace_id,
                TaskAttachment.status == "ready",
                TaskAttachment.comment_id.is_(None),
            )
            .order_by(TaskAttachment.created_at.asc())
        )
    ).all()
    payload["attachments"] = [map_task_attachment(a) for a in task_attachments]
    payload.update(await get_task_time_state(session, workspace_id, user_id, task_id))
    return payload
