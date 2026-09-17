from fastapi import APIRouter, Request, Response, status

from app.api.cookies import set_refresh_cookie
from app.core.rate_limit import throttle
from app.deps.auth import CurrentUserDep, DbSession
from app.schemas.workspace import AcceptInviteSignupBody
from app.services import invite_service

router = APIRouter(prefix="/invites", tags=["invites"])


@router.get("/{token}")
async def preview_invite(request: Request, token: str, session: DbSession):
    """Preview invite (public)."""
    await throttle(request, scope="invites:preview", ip_limit=60, window_seconds=60)
    return await invite_service.get_invite_by_token(session, token)


@router.post("/{token}/accept")
async def accept_invite(
    request: Request,
    token: str,
    session: DbSession,
    user: CurrentUserDep,
):
    """Accept invite while logged in."""
    await throttle(request, scope="invites:accept", ip_limit=30, window_seconds=60)
    return await invite_service.accept_invite_for_user(session, token, user.id)


@router.post("/{token}/accept-signup", status_code=status.HTTP_201_CREATED)
async def accept_invite_signup(
    request: Request,
    token: str,
    body: AcceptInviteSignupBody,
    response: Response,
    session: DbSession,
):
    """Accept invite and create a new account."""
    await throttle(
        request, scope="invites:accept_signup", ip_limit=20, window_seconds=60
    )
    result = await invite_service.accept_invite_with_signup(
        session, token, body.full_name, body.password
    )
    set_refresh_cookie(response, result.pop("refreshToken"))
    return {
        "user": result["user"],
        "accessToken": result["accessToken"],
        "workspace": result["workspace"],
        "role": result["role"],
        "flow": "invitee",
    }
