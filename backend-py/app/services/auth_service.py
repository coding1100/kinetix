import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.config import get_settings
from app.core.errors import AppError
from app.core.security import (
    hash_password,
    hash_token,
    sign_access_token,
    sign_refresh_token,
    verify_access_token,
    verify_password,
    verify_refresh_token,
    verify_token_hash,
)
from app.core.utils import generate_token, unique_workspace_slug
from app.db.models.enums import MemberStatus, WorkspaceRole
from app.db.models.user import PasswordResetToken, RefreshToken, User
from app.db.models.workspace import Workspace, WorkspaceMember
from app.schemas.auth import ChangePasswordBody, LoginBody, SignupBody, UpdateProfileBody


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


async def get_me(session: AsyncSession, user_id: str) -> dict:
    user = await session.scalar(
        select(User)
        .where(User.id == user_id)
        .options(
            selectinload(User.memberships).selectinload(WorkspaceMember.workspace)
        )
    )
    if not user:
        raise AppError(404, "NOT_FOUND", "User not found")

    workspaces = [
        {
            "id": str(m.workspace.id),
            "name": m.workspace.name,
            "slug": m.workspace.slug,
            "role": m.role.value,
        }
        for m in user.memberships
        if m.status == MemberStatus.ACTIVE
    ]

    return {
        "id": str(user.id),
        "email": user.email,
        "fullName": user.full_name,
        "avatarUrl": user.avatar_url,
        "createdAt": user.created_at.isoformat(),
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
    return await get_me(session, user_id)


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


async def request_password_reset(session: AsyncSession, email: str) -> dict:
    user = await session.scalar(select(User).where(User.email == email))
    if not user:
        return {"message": "If that email exists, a reset link was sent."}

    raw = generate_token()
    token_hash = hash_token(raw)
    settings = get_settings()
    expires_at = datetime.now(timezone.utc) + timedelta(
        hours=settings.reset_token_expires_hours
    )
    session.add(
        PasswordResetToken(user_id=user.id, token_hash=token_hash, expires_at=expires_at)
    )
    await session.commit()

    return {
        "message": "If that email exists, a reset link was sent.",
        "resetToken": raw,
    }


async def reset_password(session: AsyncSession, token: str, password: str) -> dict:
    now = datetime.now(timezone.utc)
    rows = (
        await session.scalars(
            select(PasswordResetToken).where(
                PasswordResetToken.used_at.is_(None),
                PasswordResetToken.expires_at > now,
            )
        )
    ).all()

    matched: PasswordResetToken | None = None
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
