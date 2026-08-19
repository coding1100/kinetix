import logging
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import BackgroundTasks
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.config import get_settings
from app.core.errors import AppError
from app.core.security import (
    hash_password,
    hash_reset_token,
    hash_token,
    sign_access_token,
    sign_refresh_token,
    verify_access_token,
    verify_password,
    verify_refresh_token,
    verify_token_hash,
)
from app.core.utils import as_aware_utc, generate_token, unique_workspace_slug
from app.db.models.enums import MemberStatus, WorkspaceRole, WorkspaceStatus
from app.db.models.user import PasswordResetToken, RefreshToken, User
from app.db.models.workspace import Workspace, WorkspaceMember
from app.schemas.auth import ChangePasswordBody, LoginBody, SignupBody, UpdateProfileBody
from app.services import email_service

logger = logging.getLogger(__name__)


def _user_out(user: User) -> dict:
    return {
        "id": str(user.id),
        "email": user.email,
        "fullName": user.full_name,
        "avatarUrl": user.avatar_url,
    }


def _auth_response(user: User, access_token: str) -> dict:
    return {
        "user": _user_out(user),
        "accessToken": access_token,
    }


async def issue_refresh_for_user(session: AsyncSession, user_id: str) -> str:
    raw = sign_refresh_token(str(user_id))
    token_hash = hash_token(raw)
    settings = get_settings()
    expires_at = datetime.now(timezone.utc) + timedelta(days=settings.jwt_refresh_expires_days)
    session.add(
        RefreshToken(user_id=user_id, token_hash=token_hash, expires_at=expires_at)
    )
    await session.flush()
    return raw


async def signup(session: AsyncSession, body: SignupBody) -> dict:
    existing = await session.scalar(select(User).where(User.email == body.email))
    if existing:
        raise AppError(409, "EMAIL_EXISTS", "An account with this email already exists")

    password_hash = hash_password(body.password)
    workspace_name = body.workspace_name or f"{body.full_name.split(' ')[0]}'s Workspace"

    async def slug_exists(slug: str) -> bool:
        row = await session.scalar(select(Workspace).where(Workspace.slug == slug))
        return row is not None

    slug = await unique_workspace_slug(workspace_name, slug_exists)

    user = User(
        email=body.email,
        password_hash=password_hash,
        full_name=body.full_name,
    )
    session.add(user)
    await session.flush()

    workspace = Workspace(name=workspace_name, slug=slug)
    session.add(workspace)
    await session.flush()

    session.add(
        WorkspaceMember(
            workspace_id=workspace.id,
            user_id=user.id,
            role=WorkspaceRole.OWNER,
            status=MemberStatus.ACTIVE,
        )
    )

    access_token = sign_access_token(sub=str(user.id), email=user.email)
    refresh_token = await issue_refresh_for_user(session, user.id)
    await session.commit()

    return {
        **_auth_response(user, access_token),
        "refreshToken": refresh_token,
        "flow": "owner",
    }


async def login(session: AsyncSession, body: LoginBody) -> dict:
    user = await session.scalar(select(User).where(User.email == body.email))
    if not user or not user.password_hash:
        raise AppError(401, "INVALID_CREDENTIALS", "Invalid email or password")
    if not verify_password(body.password, user.password_hash):
        raise AppError(401, "INVALID_CREDENTIALS", "Invalid email or password")
    if user.is_disabled:
        raise AppError(403, "ACCOUNT_DISABLED", "This account is disabled")

    access_token = sign_access_token(sub=str(user.id), email=user.email)
    refresh_token = await issue_refresh_for_user(session, user.id)
    await session.commit()

    return {**_auth_response(user, access_token), "refreshToken": refresh_token}


async def refresh_session(session: AsyncSession, refresh_token: str) -> dict:
    try:
        payload = verify_refresh_token(refresh_token)
    except Exception:
        raise AppError(401, "INVALID_REFRESH", "Invalid refresh token") from None

    user_id = payload["sub"]
    now = datetime.now(timezone.utc)
    rows = (
        await session.scalars(
            select(RefreshToken).where(
                RefreshToken.user_id == user_id,
                RefreshToken.expires_at > now,
            )
        )
    ).all()

    matched: RefreshToken | None = None
    for row in rows:
        if verify_token_hash(refresh_token, row.token_hash):
            matched = row
            break

    if not matched:
        raise AppError(401, "INVALID_REFRESH", "Refresh token not found or expired")

    user = await session.get(User, user_id)
    if not user:
        raise AppError(401, "UNAUTHORIZED", "User not found")
    if user.is_disabled:
        raise AppError(403, "ACCOUNT_DISABLED", "This account is disabled")

    await session.delete(matched)
    access_token = sign_access_token(sub=str(user.id), email=user.email)
    new_refresh = await issue_refresh_for_user(session, user.id)
    await session.commit()

    return {**_auth_response(user, access_token), "refreshToken": new_refresh}


async def logout(session: AsyncSession, refresh_token: str | None) -> None:
    if not refresh_token:
        return
    now = datetime.now(timezone.utc)
    rows = (
        await session.scalars(
            select(RefreshToken).where(RefreshToken.expires_at > now)
        )
    ).all()
    for row in rows:
        if verify_token_hash(refresh_token, row.token_hash):
            await session.delete(row)
            await session.commit()
            return


async def get_me(
    session: AsyncSession,
    user_id: str,
    include_suspended: bool = False,
    include_suspended_memberships: bool = False,
) -> dict:
    user = await session.scalar(
        select(User)
        .where(User.id == user_id)
        .options(
            selectinload(User.memberships).selectinload(WorkspaceMember.workspace)
        )
    )
    if not user:
        raise AppError(404, "NOT_FOUND", "User not found")

    # include_suspended_memberships lets a caller see a SUSPENDED membership
    # instead of it being silently filtered out - /auth/me passes this so a
    # suspended member's own workspace switcher can still show the
    # workspace (disabled) rather than it vanishing; admin's per-user
    # workspace list needs it too, to reactivate. Separate from
    # include_suspended, which governs the workspace's own status (a
    # different axis).
    allowed_statuses = (
        {MemberStatus.ACTIVE, MemberStatus.SUSPENDED}
        if include_suspended_memberships
        else {MemberStatus.ACTIVE}
    )

    # Relationship order is undefined; sort so workspaces[0] is stable
    # (oldest membership first, matching list_workspaces).
    active = sorted(
        (
            m
            for m in user.memberships
            if m.status in allowed_statuses
            and (
                include_suspended
                or (
                    m.workspace.status != WorkspaceStatus.SUSPENDED
                    and not m.workspace.is_deleted
                )
            )
        ),
        key=lambda m: (m.joined_at is None, m.joined_at),
    )
    workspaces = [
        {
            "id": str(m.workspace.id),
            "name": m.workspace.name,
            "slug": m.workspace.slug,
            "role": m.role.value,
            "status": m.workspace.status.value,
            "isDeleted": m.workspace.is_deleted,
            "membershipStatus": m.status.value,
        }
        for m in active
    ]

    return {
        "id": str(user.id),
        "email": user.email,
        "fullName": user.full_name,
        "avatarUrl": user.avatar_url,
        "createdAt": as_aware_utc(user.created_at).isoformat(),
        "hasPassword": user.password_hash is not None,
        "workspaces": workspaces,
    }


async def update_profile(
    session: AsyncSession, user_id: str, body: UpdateProfileBody
) -> dict:
    user = await session.get(User, user_id)
    if not user:
        raise AppError(404, "NOT_FOUND", "User not found")

    if body.full_name is not None:
        user.full_name = body.full_name.strip()
    if body.avatar_url is not None:
        trimmed = body.avatar_url.strip()
        user.avatar_url = trimmed or None

    if body.full_name is None and body.avatar_url is None:
        raise AppError(400, "VALIDATION_ERROR", "Nothing to update")

    await session.commit()
    await session.refresh(user)
    return await get_me(session, user_id, include_suspended_memberships=True)


_AVATAR_MAX_BYTES = 3 * 1024 * 1024  # 3 MB; client sends a resized JPEG

# Avatar bytes for the currently-live version of each user's photo, keyed by
# storage key. The public avatar_url is version-stamped (?v=<timestamp>), so
# a cache hit is always the right bytes; set_avatar() overwrites the entry
# in place when a new photo is uploaded, so it can never go stale.
_avatar_cache: dict[str, tuple[bytes, str]] = {}


def _avatar_storage_key(user_id: str) -> str:
    return f"avatars/{user_id}.jpg"


async def set_avatar(
    session: AsyncSession, user_id: str, data: bytes, content_type: str
) -> dict:
    from app.services import s3_service

    settings = get_settings()
    if not settings.s3_configured:
        raise AppError(503, "SERVICE_UNAVAILABLE", "File storage is not configured")
    if not content_type.startswith("image/"):
        raise AppError(400, "VALIDATION_ERROR", "Avatar must be an image")
    if len(data) > _AVATAR_MAX_BYTES:
        raise AppError(400, "VALIDATION_ERROR", "Avatar image is too large")

    user = await session.get(User, user_id)
    if not user:
        raise AppError(404, "NOT_FOUND", "User not found")

    # Client normalizes to JPEG before upload, so we always store/serve as JPEG.
    storage_key = _avatar_storage_key(user_id)
    s3_service.put_object(storage_key, data, "image/jpeg")
    _avatar_cache[storage_key] = (data, "image/jpeg")

    # Stable, non-expiring URL served by GET /auth/users/{id}/avatar. The ?v
    # cache-buster forces browsers/next-image to refetch after a re-upload.
    base = settings.api_public_url.rstrip("/")
    version = int(datetime.now(timezone.utc).timestamp())
    user.avatar_url = f"{base}/api/v1/auth/users/{user_id}/avatar?v={version}"

    await session.commit()
    await session.refresh(user)
    return await get_me(session, user_id, include_suspended_memberships=True)


async def get_avatar_bytes(session: AsyncSession, user_id: str) -> tuple[bytes, str]:
    from app.services import s3_service

    storage_key = _avatar_storage_key(user_id)
    cached = _avatar_cache.get(storage_key)
    if cached:
        return cached

    try:
        result = s3_service.get_object(storage_key)
    except Exception:
        raise AppError(404, "NOT_FOUND", "Avatar not found")
    _avatar_cache[storage_key] = result
    return result


async def change_password(
    session: AsyncSession, user_id: str, body: ChangePasswordBody
) -> dict:
    user = await session.get(User, user_id)
    if not user:
        raise AppError(404, "NOT_FOUND", "User not found")
    if not user.password_hash:
        raise AppError(
            400,
            "OAUTH_ACCOUNT",
            "This account uses Google sign-in. Set a password via forgot-password first.",
        )

    if not verify_password(body.current_password, user.password_hash):
        raise AppError(400, "INVALID_CREDENTIALS", "Current password is incorrect")

    user.password_hash = hash_password(body.new_password)
    await session.commit()
    return {"message": "Password updated successfully"}


async def _send_password_reset_email_safe(*, to: str, reset_url: str, expires_hours: int) -> None:
    """Fire-and-forget: runs in the background after the response has
    already gone out, so failures only surface in logs."""
    try:
        await email_service.send_password_reset_email(
            to=to, reset_url=reset_url, expires_hours=expires_hours
        )
    except Exception:
        logger.exception("Failed to send password reset email to %s", to)


async def request_password_reset(
    session: AsyncSession,
    email: str,
    background_tasks: BackgroundTasks | None = None,
) -> dict:
    user = await session.scalar(select(User).where(User.email == email))
    if not user:
        return {"message": "If that email exists, a reset link was sent."}

    now = datetime.now(timezone.utc)
    # Invalidate any previous unused reset tokens for this user
    await session.execute(
        update(PasswordResetToken)
        .where(
            PasswordResetToken.user_id == user.id,
            PasswordResetToken.used_at.is_(None),
        )
        .values(used_at=now)
    )

    raw = generate_token()
    token_hash = hash_reset_token(raw)
    settings = get_settings()
    expires_at = now + timedelta(
        hours=settings.reset_token_expires_hours
    )
    session.add(
        PasswordResetToken(user_id=user.id, token_hash=token_hash, expires_at=expires_at)
    )
    await session.commit()

    email_configured = email_service.is_email_configured()
    if email_configured and background_tasks is not None:
        reset_url = f"{settings.frontend_url.rstrip('/')}/auth/reset-password?token={raw}"
        background_tasks.add_task(
            _send_password_reset_email_safe,
            to=user.email,
            reset_url=reset_url,
            expires_hours=settings.reset_token_expires_hours,
        )

    result = {"message": "If that email exists, a reset link was sent."}
    if not email_configured:
        result["resetToken"] = raw
    return result


async def reset_password(session: AsyncSession, token: str, password: str) -> dict:
    now = datetime.now(timezone.utc)
    sha_hash = hash_reset_token(token)

    # Fast O(1) indexed SQL lookup for SHA-256 tokens
    matched = await session.scalar(
        select(PasswordResetToken).where(
            PasswordResetToken.token_hash == sha_hash,
            PasswordResetToken.used_at.is_(None),
            PasswordResetToken.expires_at > now,
        )
    )

    # Fallback check for legacy bcrypt tokens issued prior to update
    if not matched:
        rows = (
            await session.scalars(
                select(PasswordResetToken).where(
                    PasswordResetToken.used_at.is_(None),
                    PasswordResetToken.expires_at > now,
                )
            )
        ).all()
        for row in rows:
            if verify_token_hash(token, row.token_hash):
                matched = row
                break

    if not matched:
        raise AppError(400, "INVALID_TOKEN", "Reset token is invalid or expired")

    user = await session.get(User, matched.user_id)
    if not user:
        raise AppError(400, "INVALID_TOKEN", "Reset token is invalid or expired")

    user.password_hash = hash_password(password)
    matched.used_at = now
    await session.commit()

    return {"message": "Password updated successfully"}
