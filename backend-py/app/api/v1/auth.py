from fastapi import APIRouter, Cookie, Query, Response
from fastapi.responses import RedirectResponse
from urllib.parse import quote

from app.api.cookies import clear_refresh_cookie, set_refresh_cookie
from app.config import get_settings
from app.core.errors import AppError
from app.deps.auth import CurrentUserDep, DbSession
from app.schemas.auth import (
    ChangePasswordBody,
    ForgotPasswordBody,
    LoginBody,
    OAuthExchangeBody,
    RefreshBody,
    ResetPasswordBody,
    SignupBody,
    UpdateProfileBody,
)
from app.services import auth_service, oauth_service

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/signup", status_code=201)
async def signup(
    body: SignupBody,
    response: Response,
    session: DbSession,
):
    result = await auth_service.signup(session, body)
    refresh_token = result.pop("refreshToken")
    set_refresh_cookie(response, refresh_token)
    return {
        "user": result["user"],
        "accessToken": result["accessToken"],
        "refreshToken": refresh_token,
        "flow": result["flow"],
    }


@router.post("/login")
async def login(
    body: LoginBody,
    response: Response,
    session: DbSession,
):
    result = await auth_service.login(session, body)
    refresh_token = result.pop("refreshToken")
    set_refresh_cookie(response, refresh_token)
    return {
        "user": result["user"],
        "accessToken": result["accessToken"],
        "refreshToken": refresh_token,
    }


@router.post("/refresh")
async def refresh(
    response: Response,
    session: DbSession,
    body: RefreshBody | None = None,
    riseup_refresh: str | None = Cookie(default=None),
):
    refresh_token = riseup_refresh or (body.refresh_token if body else None)
    if not refresh_token:
        raise AppError(401, "UNAUTHORIZED", "Refresh token missing")
    result = await auth_service.refresh_session(session, refresh_token)
    new_refresh = result.pop("refreshToken")
    set_refresh_cookie(response, new_refresh)
    return {
        "user": result["user"],
        "accessToken": result["accessToken"],
        "refreshToken": new_refresh,
    }


@router.post("/logout")
async def logout(
    response: Response,
    session: DbSession,
    riseup_refresh: str | None = Cookie(default=None),
):
    await auth_service.logout(session, riseup_refresh)
    clear_refresh_cookie(response)
    return {"message": "Logged out"}


@router.get("/me")
async def me(session: DbSession, user: CurrentUserDep):
    return await auth_service.get_me(session, user.id)


@router.patch("/me")
async def patch_me(
    body: UpdateProfileBody,
    session: DbSession,
    user: CurrentUserDep,
):
    return await auth_service.update_profile(session, user.id, body)


@router.post("/me/change-password")
async def post_change_password(
    body: ChangePasswordBody,
    session: DbSession,
    user: CurrentUserDep,
):
    return await auth_service.change_password(session, user.id, body)


@router.post("/forgot-password")
async def forgot_password(body: ForgotPasswordBody, session: DbSession):
    result = await auth_service.request_password_reset(session, body.email)
    from app.config import get_settings

    settings = get_settings()
    if settings.is_production:
        result.pop("resetToken", None)
    return result


@router.post("/reset-password")
async def reset_password(body: ResetPasswordBody, session: DbSession):
    return await auth_service.reset_password(session, body.token, body.password)


@router.get("/google/start")
async def google_start(
    session: DbSession,
    next: str | None = Query(default=None),
):
    settings = get_settings()
    frontend = settings.frontend_url.rstrip("/")

    try:
        url = await oauth_service.start_google_oauth(
            session, oauth_service.safe_next_path(next)
        )
        return RedirectResponse(url=url, status_code=302)
    except AppError as exc:
        return RedirectResponse(
            url=(
                f"{frontend}/auth/oauth/callback"
                f"?error={quote(exc.code)}&message={quote(exc.message)}"
            ),
            status_code=302,
        )
    except Exception as exc:
        import traceback

        traceback.print_exc()
        detail = str(exc).strip()[:240] or "Unexpected error during Google sign-in."
        return RedirectResponse(
            url=(
                f"{frontend}/auth/oauth/callback"
                f"?error=OAUTH_FAILED&message={quote(detail)}"
            ),
            status_code=302,
        )


@router.get("/google/callback")
async def google_callback(
    session: DbSession,
    code: str | None = Query(default=None),
    state: str | None = Query(default=None),
    error: str | None = Query(default=None),
):
    settings = get_settings()
    frontend = settings.frontend_url.rstrip("/")

    if error:
        return RedirectResponse(
            url=f"{frontend}/auth/oauth/callback?error={quote(error)}",
            status_code=302,
        )
    if not code or not state:
        return RedirectResponse(
            url=f"{frontend}/auth/oauth/callback?error=missing_code",
            status_code=302,
        )

    try:
        exchange_code, next_path = await oauth_service.complete_google_callback(
            session, code, state
        )
        return RedirectResponse(
            url=(
                f"{frontend}/auth/oauth/callback"
                f"?code={quote(exchange_code)}&next={quote(next_path)}"
            ),
            status_code=302,
        )
    except AppError as exc:
        return RedirectResponse(
            url=(
                f"{frontend}/auth/oauth/callback"
                f"?error={quote(exc.code)}&message={quote(exc.message)}"
            ),
            status_code=302,
        )
    except Exception as exc:
        import traceback

        traceback.print_exc()
        detail = str(exc).strip()[:240] or "Unexpected error during Google sign-in."
        return RedirectResponse(
            url=(
                f"{frontend}/auth/oauth/callback"
                f"?error=OAUTH_FAILED&message={quote(detail)}"
            ),
            status_code=302,
        )


@router.post("/oauth/exchange")
async def oauth_exchange(
    body: OAuthExchangeBody,
    response: Response,
    session: DbSession,
):
    result = await oauth_service.exchange_oauth_code(session, body.code)
    refresh_token = result.pop("refreshToken")
    set_refresh_cookie(response, refresh_token)
    return {
        "user": result["user"],
        "accessToken": result["accessToken"],
        "refreshToken": refresh_token,
    }
