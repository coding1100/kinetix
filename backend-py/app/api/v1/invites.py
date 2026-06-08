from fastapi import APIRouter, Response, status

from app.api.cookies import set_refresh_cookie
from app.deps.auth import CurrentUserDep, DbSession
from app.schemas.workspace import AcceptInviteSignupBody
from app.services import invite_service

router = APIRouter(prefix="/invites", tags=["invites"])


@router.get("/{token}")
async def preview_invite(token: str, session: DbSession):
    """Preview invite (public)."""
    return await invite_service.get_invite_by_token(session, token)


@router.post("/{token}/accept")
async def accept_invite(
    token: str,
    session: DbSession,
    user: CurrentUserDep,
):
    """Accept invite while logged in."""
    return await invite_service.accept_invite_for_user(session, token, user.id)


@router.post("/{token}/accept-signup", status_code=status.HTTP_201_CREATED)
async def accept_invite_signup(
    token: str,
    body: AcceptInviteSignupBody,
    response: Response,
    session: DbSession,
):
    """Accept invite and create a new account."""
    result = await invite_service.accept_invite_with_signup(
        session, token, body.full_name, body.password
    )
    set_refresh_cookie(response, result.pop("refreshToken"))
    return {
        "user": result["user"],
        "accessToken": result["accessToken"],
        "workspace": result["workspace"],
        "role": result["role"],
        "flow": result["flow"],
    }
