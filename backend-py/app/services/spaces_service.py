from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.errors import AppError
from app.db.models.home import Folder, Space, Task, TaskComment, TaskList
from app.schemas.spaces import (
    CreateFolderBody,
    CreateListBody,
    CreateSpaceBody,
    CreateTaskCommentBody,
    UpdateFolderBody,
    UpdateListBody,
    UpdateSpaceBody,
)
from app.services.home_service import (
    _SPACE_LOAD,
    _TASK_LOAD,
    _active_member_count,
    _build_space_payload,
    _list_count_for_space,
)
from app.services.home_helpers import map_list_entry, map_task


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
    )
    if not task_list:
        raise AppError(404, "NOT_FOUND", "List not found")
    await session.delete(task_list)
    await session.commit()
    return {"ok": True}


async def add_task_comment(
    session: AsyncSession,
    workspace_id: str,
    user_id: str,
    task_id: str,
    body: CreateTaskCommentBody,
) -> dict:
    task = await session.scalar(
        select(Task)
        .join(TaskList)
        .join(Space)
        .where(Task.id == task_id, Space.workspace_id == workspace_id)
    )
    if not task:
        raise AppError(404, "NOT_FOUND", "Task not found")
    comment = TaskComment(task_id=task_id, user_id=user_id, body=body.body.strip())
    session.add(comment)
    await session.commit()
    refreshed = await session.scalar(
        select(Task).where(Task.id == task_id).options(*_TASK_LOAD)
    )
    return map_task(refreshed, user_id)
