import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import APIRouter, status
from pydantic import BaseModel, Field
from sqlalchemy import func, select

from app.core.errors import AppError
from app.deps.auth import CurrentUserDep, DbSession
from app.db.models.user import UserApiKey

router = APIRouter(prefix="/auth/api-keys", tags=["auth"])


class CreateApiKeyBody(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    workspaceId: str | None = None
    expiresDays: int | None = Field(default=None, ge=1, le=365)


def hash_pat_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


@router.get("")
async def list_api_keys(
    current_user: CurrentUserDep,
    session: DbSession,
) -> dict[str, Any]:
    """Lists all active (unrevoked) API keys for the current user."""
    stmt = (
        select(UserApiKey)
        .where(
            UserApiKey.user_id == current_user.id,
            UserApiKey.revoked_at.is_(None),
        )
        .order_by(UserApiKey.created_at.desc())
    )
    keys = (await session.scalars(stmt)).all()
    return {
        "keys": [
            {
                "id": k.id,
                "name": k.name,
                "keyPrefix": k.key_prefix,
                "workspaceId": k.workspace_id,
                "createdAt": k.created_at.isoformat() if k.created_at else None,
                "expiresAt": k.expires_at.isoformat() if k.expires_at else None,
                "lastUsedAt": k.last_used_at.isoformat() if k.last_used_at else None,
            }
            for k in keys
        ]
    }


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_api_key(
    body: CreateApiKeyBody,
    current_user: CurrentUserDep,
    session: DbSession,
) -> dict[str, Any]:
    """Generates a new personal access token (PAT) for MCP or automation."""
    random_hex = secrets.token_hex(20)
    raw_token = f"knx_pat_{random_hex}"
    key_prefix = f"knx_pat_{random_hex[:8]}..."
    key_hash = hash_pat_token(raw_token)

    expires_at = None
    if body.expiresDays:
        expires_at = datetime.now(timezone.utc) + timedelta(days=body.expiresDays)

    api_key = UserApiKey(
        user_id=current_user.id,
        workspace_id=body.workspaceId,
        name=body.name.strip(),
        key_prefix=key_prefix,
        key_hash=key_hash,
        expires_at=expires_at,
    )
    session.add(api_key)
    await session.commit()
    await session.refresh(api_key)

    return {
        "id": api_key.id,
        "name": api_key.name,
        "token": raw_token,
        "keyPrefix": api_key.key_prefix,
        "workspaceId": api_key.workspace_id,
        "createdAt": api_key.created_at.isoformat() if api_key.created_at else None,
        "expiresAt": api_key.expires_at.isoformat() if api_key.expires_at else None,
    }


@router.delete("/{key_id}", status_code=status.HTTP_200_OK)
async def revoke_api_key(
    key_id: str,
    current_user: CurrentUserDep,
    session: DbSession,
) -> dict[str, Any]:
    """Revokes an API key so it can no longer be used."""
    api_key = await session.scalar(
        select(UserApiKey).where(
            UserApiKey.id == key_id,
            UserApiKey.user_id == current_user.id,
            UserApiKey.revoked_at.is_(None),
        )
    )
    if not api_key:
        raise AppError(404, "NOT_FOUND", "API key not found")

    api_key.revoked_at = datetime.now(timezone.utc)
    await session.commit()
    return {"message": "API key revoked successfully.", "id": key_id}
