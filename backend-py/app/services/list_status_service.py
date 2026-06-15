from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.enums import StatusGroup, TaskStatus
from app.db.models.home import ListStatus, Task, TaskList

DEFAULT_LIST_STATUSES: list[tuple[str, str, str, StatusGroup, int]] = [
    ("OPEN", "open", "#5f55ee", StatusGroup.NOT_STARTED, 0),
    ("TODO", "to do", "#87909e", StatusGroup.NOT_STARTED, 1),
    ("IN_PROGRESS", "in progress", "#4194f6", StatusGroup.ACTIVE, 2),
    ("DONE", "done", "#6bc950", StatusGroup.DONE, 3),
]


def map_list_status_row(row: ListStatus) -> dict:
    return {
        "id": row.id,
        "name": row.name,
        "color": row.color,
        "statusGroup": row.status_group.value,
        "legacyKey": row.legacy_key,
        "sortOrder": row.sort_order,
    }


async def ensure_list_statuses(session: AsyncSession, list_id: str) -> list[ListStatus]:
    existing = (
        await session.scalars(
            select(ListStatus)
            .where(ListStatus.list_id == list_id)
            .order_by(ListStatus.sort_order.asc())
        )
    ).all()
    if existing:
        return list(existing)

    created: list[ListStatus] = []
    for legacy_key, name, color, group, order in DEFAULT_LIST_STATUSES:
        row = ListStatus(
            list_id=list_id,
            name=name,
            color=color,
            status_group=group,
            legacy_key=legacy_key,
            sort_order=order,
        )
        session.add(row)
        created.append(row)
    await session.flush()

    by_legacy = {row.legacy_key: row for row in created}
    tasks = (
        await session.scalars(select(Task).where(Task.list_id == list_id))
    ).all()
    for task in tasks:
        if task.status_id:
            continue
        legacy = task.status.value if task.status else TaskStatus.TODO.value
        match = by_legacy.get(legacy) or by_legacy.get(TaskStatus.TODO.value)
        if match:
            task.status_id = match.id
            task.status_color = match.color

    return created


async def list_statuses_for_list(
    session: AsyncSession, list_id: str
) -> list[dict]:
    await ensure_list_statuses(session, list_id)
    rows = (
        await session.scalars(
            select(ListStatus)
            .where(ListStatus.list_id == list_id)
            .order_by(ListStatus.sort_order.asc())
        )
    ).all()
    return [map_list_status_row(r) for r in rows]


async def get_list_status(
    session: AsyncSession, list_id: str, status_id: str
) -> ListStatus | None:
    return await session.scalar(
        select(ListStatus).where(
            ListStatus.id == status_id,
            ListStatus.list_id == list_id,
        )
    )


async def default_status_for_list(
    session: AsyncSession, list_id: str
) -> ListStatus | None:
    await ensure_list_statuses(session, list_id)
    return await session.scalar(
        select(ListStatus).where(
            ListStatus.list_id == list_id,
            ListStatus.legacy_key == TaskStatus.TODO.value,
        )
    )
