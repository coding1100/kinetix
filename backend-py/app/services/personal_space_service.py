from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.home import Space, TaskList
from app.services.list_status_service import ensure_list_statuses

PERSONAL_SPACE_NAME = "Personal"
PERSONAL_LIST_NAME = "Personal List"


async def ensure_personal_space(session: AsyncSession, workspace_id: str) -> Space:
    space = await session.scalar(
        select(Space).where(
            Space.workspace_id == workspace_id,
            or_(Space.is_personal.is_(True), Space.name == PERSONAL_SPACE_NAME),
        )
    )
    if not space:
        space = Space(
            workspace_id=workspace_id,
            name=PERSONAL_SPACE_NAME,
            color="#a18072",
            is_personal=True,
        )
        session.add(space)
        await session.flush()
    elif not space.is_personal:
        space.is_personal = True

    task_list = await session.scalar(
        select(TaskList).where(
            TaskList.space_id == space.id,
            TaskList.name == PERSONAL_LIST_NAME,
        )
    )
    if not task_list:
        task_list = TaskList(
            space_id=space.id,
            name=PERSONAL_LIST_NAME,
            sort_order=0,
        )
        session.add(task_list)
        await session.flush()
        await ensure_list_statuses(session, task_list.id)
    return space
