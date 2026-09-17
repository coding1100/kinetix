import os
from contextlib import asynccontextmanager
from dataclasses import dataclass
from typing import AsyncGenerator

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.security import verify_access_token
from app.db.models.enums import MemberStatus, WorkspaceRole, WorkspaceStatus
from app.db.models.user import User
from app.db.models.workspace import Workspace, WorkspaceMember
from app.db.session import get_session_factory


@dataclass
class MCPContext:
    user_id: str
    user_email: str
    user_name: str
    workspace_id: str
    workspace_name: str
    role: WorkspaceRole


async def resolve_mcp_context(
    session: AsyncSession,
    api_key_or_token: str | None = None,
    workspace_id_override: str | None = None,
) -> MCPContext:
    """Resolves the user and workspace context for an MCP request.

    Identifies user via:
      1. Explicit token argument or KINETIX_API_KEY / KINETIX_USER_TOKEN env var (JWT)
      2. KINETIX_USER_EMAIL or KINETIX_USER_ID env var
      3. Fallback to the first active user in the database for local dev convenience.
    """
    token = (
        api_key_or_token
        or os.getenv("KINETIX_API_KEY")
        or os.getenv("KINETIX_USER_TOKEN")
    )
    user: User | None = None

    if token:
        try:
            payload = verify_access_token(token)
            user_id = payload.get("sub")
            if user_id:
                user = await session.get(User, user_id)
        except Exception:
            pass

    if not user:
        env_email = os.getenv("KINETIX_USER_EMAIL")
        env_uid = os.getenv("KINETIX_USER_ID")
        if env_email:
            user = await session.scalar(
                select(User).where(User.email == env_email)
            )
        elif env_uid:
            user = await session.get(User, env_uid)

    if not user:
        # Development fallback: grab first active non-disabled user
        user = await session.scalar(
            select(User)
            .where(User.is_disabled.is_(False))
            .order_by(User.created_at.asc())
        )

    if not user:
        raise RuntimeError(
            "MCP authentication failed: No valid user found. "
            "Please set KINETIX_API_KEY, KINETIX_USER_EMAIL, or KINETIX_USER_ID."
        )

    if user.is_disabled:
        raise RuntimeError(f"User account '{user.email}' is disabled.")

    target_ws_id = (
        workspace_id_override
        or os.getenv("KINETIX_WORKSPACE_ID")
    )

    query = (
        select(WorkspaceMember)
        .join(Workspace, Workspace.id == WorkspaceMember.workspace_id)
        .where(
            WorkspaceMember.user_id == user.id,
            WorkspaceMember.status == MemberStatus.ACTIVE,
            Workspace.status == WorkspaceStatus.ACTIVE,
            Workspace.is_deleted.is_(False),
        )
        .options(selectinload(WorkspaceMember.workspace))
    )
    if target_ws_id:
        query = query.where(WorkspaceMember.workspace_id == target_ws_id)

    membership = await session.scalar(query)
    if not membership:
        raise RuntimeError(
            f"User '{user.email}' has no active memberships in workspace "
            f"'{target_ws_id or 'any'}'."
        )

    return MCPContext(
        user_id=user.id,
        user_email=user.email,
        user_name=user.full_name or user.email,
        workspace_id=membership.workspace.id,
        workspace_name=membership.workspace.name,
        role=membership.role,
    )


@asynccontextmanager
async def get_mcp_db_session(
    api_key_or_token: str | None = None,
    workspace_id_override: str | None = None,
) -> AsyncGenerator[tuple[AsyncSession, MCPContext], None]:
    """Async context manager that yields a DB session bound to the authenticated MCP context."""
    session_factory = get_session_factory()
    async with session_factory() as session:
        context = await resolve_mcp_context(
            session,
            api_key_or_token=api_key_or_token,
            workspace_id_override=workspace_id_override,
        )
        try:
            yield session, context
        except Exception:
            await session.rollback()
            raise
