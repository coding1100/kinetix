"""Add createdById to Space/Folder/TaskList, then backfill legacy access so
nothing anyone could already see disappears now that there's no ambient
default access (only the creator + explicit Shares grant access).

Run once: python scripts/run_content_ownership_migration.py
"""

from __future__ import annotations

import asyncio
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.db.models.chat import ChatChannel, ChatChannelMember
from app.db.models.enums import MemberStatus, PermissionLevel, WorkspaceRole
from app.db.models.home import (
    Folder,
    FolderMember,
    ListMember,
    Space,
    SpaceMember,
    TaskList,
)
from app.db.models.workspace import WorkspaceMember


class _Env(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    direct_url: str = ""
    database_url: str


def _async_url(raw: str) -> str:
    if raw.startswith("postgresql://"):
        return raw.replace("postgresql://", "postgresql+asyncpg://", 1)
    if raw.startswith("postgres://"):
        return raw.replace("postgres://", "postgresql+asyncpg://", 1)
    return raw


# What resolve_*_permission used to return before ambient default access was
# removed - used only to compute what to backfill, never imported/used live.
_OLD_DEFAULT_LEVEL: dict[WorkspaceRole, PermissionLevel | None] = {
    WorkspaceRole.OWNER: PermissionLevel.EDIT,
    WorkspaceRole.SUPER_ADMIN: PermissionLevel.EDIT,
    WorkspaceRole.ADMIN: PermissionLevel.EDIT,
    WorkspaceRole.MEMBER: PermissionLevel.EDIT,
    WorkspaceRole.LIMITED_MEMBER: PermissionLevel.VIEW,
    WorkspaceRole.GUEST: None,
}
_OLD_PRIVILEGED = {WorkspaceRole.OWNER, WorkspaceRole.SUPER_ADMIN}


def _old_public_level(role: WorkspaceRole) -> PermissionLevel | None:
    if role in _OLD_PRIVILEGED:
        return PermissionLevel.EDIT
    return _OLD_DEFAULT_LEVEL.get(role)


def _old_level(is_private: bool, role: WorkspaceRole) -> PermissionLevel | None:
    if role in _OLD_PRIVILEGED:
        return PermissionLevel.EDIT
    if is_private:
        return None
    return _OLD_DEFAULT_LEVEL.get(role)


async def _run_ddl(url: str) -> None:
    sql_path = Path(__file__).with_name("migrate_content_ownership.sql")
    raw = sql_path.read_text(encoding="utf-8")
    statements: list[str] = []
    for block in raw.split(";"):
        lines = [
            line
            for line in block.strip().splitlines()
            if line.strip() and not line.strip().startswith("--")
        ]
        if lines:
            statements.append("\n".join(lines))

    engine = create_async_engine(url, connect_args={"statement_cache_size": 0})
    async with engine.begin() as conn:
        for stmt in statements:
            await conn.execute(text(stmt))
    await engine.dispose()


async def _backfill(url: str) -> None:
    engine = create_async_engine(url, connect_args={"statement_cache_size": 0})
    session_factory = async_sessionmaker(engine, expire_on_commit=False)

    counts = {"space": 0, "folder": 0, "list": 0, "channel": 0}

    async with session_factory() as session:
        workspace_ids = (
            (await session.execute(select(WorkspaceMember.workspace_id).distinct()))
            .scalars()
            .all()
        )

        for workspace_id in workspace_ids:
            members = (
                (
                    await session.execute(
                        select(WorkspaceMember).where(
                            WorkspaceMember.workspace_id == workspace_id,
                            WorkspaceMember.status == MemberStatus.ACTIVE,
                        )
                    )
                )
                .scalars()
                .all()
            )
            if not members:
                continue

            spaces = (
                (await session.execute(select(Space).where(Space.workspace_id == workspace_id)))
                .scalars()
                .all()
            )
            space_ids = [s.id for s in spaces]

            folders = (
                (await session.execute(select(Folder).where(Folder.space_id.in_(space_ids))))
                .scalars()
                .all()
                if space_ids
                else []
            )
            folders_by_id = {f.id: f for f in folders}

            lists = (
                (await session.execute(select(TaskList).where(TaskList.space_id.in_(space_ids))))
                .scalars()
                .all()
                if space_ids
                else []
            )

            existing_space_members = set()
            if space_ids:
                rows = (
                    await session.execute(select(SpaceMember).where(SpaceMember.space_id.in_(space_ids)))
                ).scalars().all()
                existing_space_members = {(r.space_id, r.user_id) for r in rows}

            existing_folder_members = set()
            if folders:
                folder_ids = [f.id for f in folders]
                rows = (
                    await session.execute(select(FolderMember).where(FolderMember.folder_id.in_(folder_ids)))
                ).scalars().all()
                existing_folder_members = {(r.folder_id, r.user_id) for r in rows}

            existing_list_members = set()
            if lists:
                list_ids = [l.id for l in lists]
                rows = (
                    await session.execute(select(ListMember).where(ListMember.list_id.in_(list_ids)))
                ).scalars().all()
                existing_list_members = {(r.list_id, r.user_id) for r in rows}

            for member in members:
                role = member.role

                for space in spaces:
                    level = _old_level(space.is_private, role)
                    if level is None or (space.id, member.user_id) in existing_space_members:
                        continue
                    session.add(
                        SpaceMember(
                            space_id=space.id,
                            user_id=member.user_id,
                            permission_level=level,
                            status=MemberStatus.ACTIVE,
                        )
                    )
                    existing_space_members.add((space.id, member.user_id))
                    counts["space"] += 1

                for folder in folders:
                    if role in _OLD_PRIVILEGED:
                        f_level = PermissionLevel.EDIT
                    elif folder.is_private:
                        f_level = None
                    else:
                        parent = next((s for s in spaces if s.id == folder.space_id), None)
                        f_level = _old_public_level(role) if parent and not parent.is_private else None
                    if f_level is None or (folder.id, member.user_id) in existing_folder_members:
                        continue
                    session.add(
                        FolderMember(
                            folder_id=folder.id,
                            user_id=member.user_id,
                            permission_level=f_level,
                            status=MemberStatus.ACTIVE,
                        )
                    )
                    existing_folder_members.add((folder.id, member.user_id))
                    counts["folder"] += 1

                for task_list in lists:
                    if role in _OLD_PRIVILEGED:
                        l_level = PermissionLevel.EDIT
                    elif task_list.is_private:
                        l_level = None
                    elif task_list.folder_id:
                        parent_folder = folders_by_id.get(task_list.folder_id)
                        if parent_folder is None or parent_folder.is_private:
                            l_level = None
                        else:
                            parent_space = next(
                                (s for s in spaces if s.id == parent_folder.space_id), None
                            )
                            l_level = (
                                _old_public_level(role)
                                if parent_space and not parent_space.is_private
                                else None
                            )
                    else:
                        parent_space = next((s for s in spaces if s.id == task_list.space_id), None)
                        l_level = (
                            _old_public_level(role)
                            if parent_space and not parent_space.is_private
                            else None
                        )
                    if l_level is None or (task_list.id, member.user_id) in existing_list_members:
                        continue
                    session.add(
                        ListMember(
                            list_id=task_list.id,
                            user_id=member.user_id,
                            permission_level=l_level,
                            status=MemberStatus.ACTIVE,
                        )
                    )
                    existing_list_members.add((task_list.id, member.user_id))
                    counts["list"] += 1

        # Old channel bypass gave OWNER/SUPER_ADMIN implicit access to every
        # channel with no real row. Public-channel auto-join already left
        # real rows behind, so this only needs to cover that bypass gap.
        channels = (await session.execute(select(ChatChannel))).scalars().all()
        channels_by_workspace: dict[str, list[ChatChannel]] = {}
        for ch in channels:
            channels_by_workspace.setdefault(ch.workspace_id, []).append(ch)

        for workspace_id, chs in channels_by_workspace.items():
            privileged = (
                (
                    await session.execute(
                        select(WorkspaceMember).where(
                            WorkspaceMember.workspace_id == workspace_id,
                            WorkspaceMember.status == MemberStatus.ACTIVE,
                            WorkspaceMember.role.in_(list(_OLD_PRIVILEGED)),
                        )
                    )
                )
                .scalars()
                .all()
            )
            if not privileged:
                continue
            channel_ids = [c.id for c in chs]
            rows = (
                await session.execute(
                    select(ChatChannelMember).where(ChatChannelMember.channel_id.in_(channel_ids))
                )
            ).scalars().all()
            existing_channel_members = {(r.channel_id, r.user_id) for r in rows}

            for ch in chs:
                for member in privileged:
                    if (ch.id, member.user_id) in existing_channel_members:
                        continue
                    session.add(ChatChannelMember(channel_id=ch.id, user_id=member.user_id))
                    existing_channel_members.add((ch.id, member.user_id))
                    counts["channel"] += 1

        await session.commit()

    await engine.dispose()
    print(
        f"Backfilled {counts['space']} SpaceMember, {counts['folder']} FolderMember, "
        f"{counts['list']} ListMember, {counts['channel']} ChatChannelMember rows."
    )


async def main() -> None:
    env = _Env()
    url = _async_url(env.direct_url or env.database_url)
    await _run_ddl(url)
    print("createdById columns ready.")
    await _backfill(url)


if __name__ == "__main__":
    asyncio.run(main())
