from dataclasses import dataclass
from typing import Annotated

from fastapi import Depends, Path
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.core.errors import AppError
from app.db.models.enums import MemberStatus, WorkspaceRole
from app.db.models.workspace import Workspace, WorkspaceMember
from app.deps.auth import CurrentUserDep, DbSession


@dataclass
class WorkspaceContext:
    id: str
    name: str
    slug: str
    role: WorkspaceRole


async def get_workspace_member(
    workspace_id: Annotated[str, Path()],
    user: CurrentUserDep,
    session: DbSession,
) -> WorkspaceContext:
    membership = await session.scalar(
        select(WorkspaceMember)
        .where(
            WorkspaceMember.workspace_id == workspace_id,
            WorkspaceMember.user_id == user.id,
        )
        .options(selectinload(WorkspaceMember.workspace))
    )
    if not membership or membership.status != MemberStatus.ACTIVE:
        raise AppError(403, "FORBIDDEN", "You are not a member of this workspace")

    ws = membership.workspace
    return WorkspaceContext(
        id=ws.id,
        name=ws.name,
        slug=ws.slug,
        role=membership.role,
    )


WorkspaceMemberDep = Annotated[WorkspaceContext, Depends(get_workspace_member)]
