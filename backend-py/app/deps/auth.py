from typing import Annotated

from fastapi import Depends, Header
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AppError
from app.core.security import verify_access_token
from app.db.models.user import User
from app.db.session import get_db

bearer_scheme = HTTPBearer(auto_error=False)


class CurrentUser:
    def __init__(self, id: str, email: str) -> None:
        self.id = id
        self.email = email


DbSession = Annotated[AsyncSession, Depends(get_db)]


async def get_current_user(
    session: DbSession,
    credentials: Annotated[
        HTTPAuthorizationCredentials | None, Depends(bearer_scheme)
    ] = None,
    authorization: Annotated[str | None, Header()] = None,
) -> CurrentUser:
    token: str | None = None
    if credentials:
        token = credentials.credentials
    elif authorization and authorization.startswith("Bearer "):
        token = authorization[7:]
    if not token:
        raise AppError(
            401, "UNAUTHORIZED", "Missing or invalid authorization header"
        )
    try:
        payload = verify_access_token(token)
    except Exception:
        raise AppError(401, "UNAUTHORIZED", "Invalid or expired token") from None

    is_disabled = await session.scalar(
        select(User.is_disabled).where(User.id == payload["sub"])
    )
    if is_disabled:
        raise AppError(401, "ACCOUNT_DISABLED", "This account has been disabled")

    return CurrentUser(id=payload["sub"], email=payload["email"])


CurrentUserDep = Annotated[CurrentUser, Depends(get_current_user)]
