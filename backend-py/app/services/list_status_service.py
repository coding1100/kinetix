from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.enums import StatusGroup, TaskStatus
from app.db.models.home import DEFAULT_SPACE_STATUS_CONFIG, ListStatus, Space, Task, TaskList


def _status_tuples(
    config: list[dict] | None,
) -> list[tuple[str, str, str, StatusGroup, int]]:
    """Space.status_config (jsonb) -> the tuple shape the rest of this
    module works with. Falls back to the built-in default set if a space
    somehow has no config (shouldn't happen - the column is NOT NULL with
    a default - but keeps this function safe to call defensively)."""
    rows = config or DEFAULT_SPACE_STATUS_CONFIG
    return [
        (
            row["legacyKey"],
            row["name"],
            row["color"],
            StatusGroup(row["statusGroup"]),
            row["sortOrder"],
        )
        for row in rows
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
    space_status_config = await session.scalar(
        select(Space.status_config)
        .join(TaskList, TaskList.space_id == Space.id)
        .where(TaskList.id == list_id)
    )
    default_statuses = _status_tuples(space_status_config)

    existing = (
        await session.scalars(
            select(ListStatus)
            .where(ListStatus.list_id == list_id)
            .order_by(ListStatus.sort_order.asc())
        )
    ).all()
    if existing:
        existing_by_name = {row.name.strip().lower(): row for row in existing if row.name}
        changed = False
        next_order = max((row.sort_order for row in existing), default=-1) + 1
        for legacy_key, name, color, group, _ in default_statuses:
            row = existing_by_name.get(name.strip().lower())
            if row:
                desired_legacy = legacy_key
                desired_group = group.value
                if (
                    row.name != name
                    or row.legacy_key != desired_legacy
                    or row.status_group.value != desired_group
                    or (row.color or "").lower() != color.lower()
                ):
                    row.name = name
                    row.legacy_key = desired_legacy
                    row.status_group = group
                    row.color = color
                    changed = True
                continue
            session.add(
                ListStatus(
                    list_id=list_id,
                    name=name,
                    color=color,
                    status_group=group,
                    legacy_key=legacy_key,
                    sort_order=next_order,
                )
            )
            next_order += 1
            changed = True
        if changed:
            await session.flush()
            rows = (
                await session.scalars(
                    select(ListStatus).where(ListStatus.list_id == list_id)
                )
            ).all()
            desired_order = {
                name.strip().lower(): order
                for _, name, _, _, order in default_statuses
            }
            fallback_order = max(desired_order.values(), default=0) + 1
            for row in rows:
                key = (row.name or "").strip().lower()
                if key in desired_order:
                    row.sort_order = desired_order[key]
                else:
                    row.sort_order = fallback_order
                    fallback_order += 1
        tasks_without_status = (
            await session.scalars(
                select(Task).where(Task.list_id == list_id, Task.status_id.is_(None))
            )
        ).all()
        if tasks_without_status:
            rows = (
                await session.scalars(
                    select(ListStatus).where(ListStatus.list_id == list_id)
                )
            ).all()
            by_legacy: dict[str, ListStatus] = {}
            for row in sorted(rows, key=lambda r: r.sort_order):
                if row.legacy_key and row.legacy_key not in by_legacy:
                    by_legacy[row.legacy_key] = row
            for task in tasks_without_status:
                legacy = task.status.value if task.status else TaskStatus.TODO.value
                match = by_legacy.get(legacy) or by_legacy.get(TaskStatus.TODO.value)
                if match:
                    task.status_id = match.id
                    task.status_color = match.color
        return list(existing)

    created: list[ListStatus] = []
    for legacy_key, name, color, group, order in default_statuses:
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
