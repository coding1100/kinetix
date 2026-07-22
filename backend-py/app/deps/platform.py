from typing import Annotated

from fastapi import Depends

from app.core.errors import AppError
from app.db.models.enums import PlatformRole
from app.deps.auth import CurrentUserDep, DbSession
from app.services.platform_permissions import get_platform_role


async def get_platform_staff(
    user: CurrentUserDep,
    session: DbSession,
) -> PlatformRole:
    role = await get_platform_role(session, user.id)
    if role is None:
        raise AppError(403, "FORBIDDEN", "Platform staff access required")
    return role


PlatformStaffDep = Annotated[PlatformRole, Depends(get_platform_staff)]
