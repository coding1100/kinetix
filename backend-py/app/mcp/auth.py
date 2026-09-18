import hashlib
import os
from contextlib import asynccontextmanager
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import AsyncGenerator

from fastmcp.exceptions import ToolError
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.security import verify_access_token
from app.db.models.enums import MemberStatus, WorkspaceRole, WorkspaceStatus
from app.db.models.user import User, UserApiKey
from app.db.models.workspace import Workspace, WorkspaceMember
from app.db.session import _get_db_semaphore, get_session_factory


@dataclass
class MCPContext:
    user_id: str
    user_email: str
    user_name: str
    workspace_id: str
    workspace_name: str
    role: WorkspaceRole


def _hash_pat(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


async def resolve_mcp_context(
    session: AsyncSession,
    api_key_or_token: str | None = None,
    workspace_id_override: str | None = None,
) -> MCPContext:
    """Resolves the authenticated user and workspace context for an MCP request.

    Identifies user via:
      1. Personal Access Token (PAT: 'knx_pat_...') from argument, Bearer header, or KINETIX_API_KEY
      2. Web Session Bearer JWT from argument, Bearer header, or KINETIX_API_KEY
      3. Local CLI environment variables (KINETIX_USER_EMAIL / KINETIX_USER_ID) ONLY when running
         in local stdio mode (never for remote HTTP/SSE requests).

    Security note: Unauthenticated requests are strictly rejected. There is no auto-login dev fallback.
    """
    token = api_key_or_token
    is_http_request = False

    try:
        from fastmcp.server.dependencies import get_http_request

        req = get_http_request()
        if req is not None:
            is_http_request = True
            auth_header = req.headers.get("authorization") or req.headers.get("Authorization")
            api_key_header = req.headers.get("x-api-key") or req.headers.get("X-Api-Key")

            if auth_header and auth_header.lower().startswith("bearer "):
                token = auth_header[7:].strip()
            elif api_key_header:
                token = api_key_header.strip()
            elif not token:
                # Support query params for SSE EventSource clients (browser EventSource doesn't support custom headers)
                token = (
                    req.query_params.get("token")
                    or req.query_params.get("api_key")
                    or req.query_params.get("apiKey")
                )

            if not workspace_id_override:
                workspace_id_override = (
                    req.headers.get("x-workspace-id")
                    or req.headers.get("X-Workspace-Id")
                    or req.query_params.get("workspace_id")
                    or req.query_params.get("workspaceId")
                )
    except Exception:
        pass

    # Only check process-level environment variables when running in local stdio mode
    if not is_http_request and not token:
        token = os.getenv("KINETIX_API_KEY") or os.getenv("KINETIX_USER_TOKEN")

    user: User | None = None
    pat_workspace_id: str | None = None

    if token:
        token = token.strip()
        if token.startswith("knx_pat_"):
            token_hash = _hash_pat(token)
            now = datetime.now(timezone.utc)
            api_key = await session.scalar(
                select(UserApiKey).where(
                    UserApiKey.key_hash == token_hash,
                    UserApiKey.revoked_at.is_(None),
                )
            )
            if not api_key:
                raise ToolError("[UNAUTHORIZED] Invalid or revoked Kinetix API key.")
            if api_key.expires_at and api_key.expires_at < now:
                raise ToolError("[UNAUTHORIZED] Kinetix API key has expired.")

            # Update last used timestamp
            api_key.last_used_at = now
            await session.flush()

            user = await session.get(User, api_key.user_id)
            if api_key.workspace_id:
                pat_workspace_id = api_key.workspace_id
        else:
            try:
                payload = verify_access_token(token)
                user_id = payload.get("sub")
                if user_id:
                    user = await session.get(User, user_id)
            except Exception:
                pass

    # CLI / stdio fallback (strictly blocked for HTTP requests to prevent host spoofing)
    if not user and not is_http_request:
        env_email = os.getenv("KINETIX_USER_EMAIL")
        env_uid = os.getenv("KINETIX_USER_ID")
        if env_email:
            user = await session.scalar(
                select(User).where(User.email == env_email)
            )
        elif env_uid:
            user = await session.get(User, env_uid)

    if not user:
        raise ToolError(
            "[UNAUTHORIZED] Authentication required. Please provide a valid Kinetix "
            "Personal Access Token ('knx_pat_...') or Bearer JWT token."
        )

    if user.is_disabled:
        raise ToolError(f"[FORBIDDEN] User account '{user.email}' is disabled.")

    target_ws_id = (
        workspace_id_override
        or pat_workspace_id
        or (None if is_http_request else os.getenv("KINETIX_WORKSPACE_ID"))
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
    else:
        # Deterministically select primary workspace if none specified
        query = query.order_by(WorkspaceMember.joined_at.asc())

    membership = await session.scalar(query)
    if not membership:
        raise ToolError(
            f"[NOT_FOUND] User '{user.email}' has no active memberships in workspace "
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
    """Async context manager that yields a DB session bound to the authenticated MCP context,

    guarded by the DB concurrency semaphore to prevent pool exhaustion.
    """
    async with _get_db_semaphore():
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
