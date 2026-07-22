"""Platform-wide staff role helpers (separate from per-workspace WorkspaceRole)."""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.enums import PlatformRole
from app.db.models.platform import PlatformStaff


async def get_platform_role(session: AsyncSession, user_id: str) -> PlatformRole | None:
    return await session.scalar(
        select(PlatformStaff.role).where(PlatformStaff.user_id == user_id)
    )


def is_platform_staff(role: PlatformRole | None) -> bool:
    return role is not None
