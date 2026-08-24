from fastapi import APIRouter, BackgroundTasks, Cookie, File, Query, Request, Response, UploadFile
from fastapi.responses import RedirectResponse
from urllib.parse import quote

from app.api.cookies import clear_refresh_cookie, set_refresh_cookie
from app.api.upload_limits import read_upload_limited
from app.config import get_settings
from app.core.rate_limit import email_account, throttle
from app.core.errors import AppError
from app.deps.auth import CurrentUserDep, DbSession
from app.schemas.auth import (
    ChangePasswordBody,
    ForgotPasswordBody,
    LoginBody,
    OAuthExchangeBody,
    ResetPasswordBody,
    SignupBody,
    UpdateProfileBody,
)
from app.services import auth_service, oauth_service

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/signup", status_code=201)
async def signup(
    body: SignupBody,
    request: Request,
    response: Response,
    session: DbSession,
):
    settings = get_settings()
    await throttle(
        request,
        scope="auth.signup",
        ip_limit=settings.auth_signup_ip_limit,
    )
    result = await auth_service.signup(session, body)
    refresh_token = result.pop("refreshToken")
    set_refresh_cookie(response, refresh_token)
    return {
        "user": result["user"],
        "accessToken": result["accessToken"],
        "flow": result["flow"],
    }


@router.post("/login")
async def login(
    body: LoginBody,
    request: Request,
    response: Response,
    session: DbSession,
):
    settings = get_settings()
    await throttle(
        request,
        scope="auth.login",
        ip_limit=settings.auth_login_ip_limit,
        account_limit=settings.auth_login_account_limit,
        account=email_account(body.email),
    )
    result = await auth_service.login(session, body)
    refresh_token = result.pop("refreshToken")
    set_refresh_cookie(response, refresh_token)
    return {
        "user": result["user"],
        "accessToken": result["accessToken"],
    }


@router.post("/refresh")
async def refresh(
    request: Request,
    response: Response,
    session: DbSession,
    riseup_refresh: str | None = Cookie(default=None),
):
    settings = get_settings()
    await throttle(
        request,
        scope="auth.refresh",
        ip_limit=settings.auth_refresh_ip_limit,
    )
    refresh_token = riseup_refresh
    if not refresh_token:
        raise AppError(401, "UNAUTHORIZED", "Refresh token missing")
    result = await auth_service.refresh_session(session, refresh_token)
    new_refresh = result.pop("refreshToken")
    if new_refresh is not None:
        set_refresh_cookie(response, new_refresh)
    return {
        "user": result["user"],
        "accessToken": result["accessToken"],
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
    # include_suspended_memberships=True: a workspace where this user was
    # suspended should still show up (disabled) in their own workspace
    # switcher instead of silently vanishing - get_workspace_member still
    # 403s if they try to actually enter it.
    return await auth_service.get_me(
        session, user.id, include_suspended_memberships=True
    )


@router.patch("/me")
async def patch_me(
    body: UpdateProfileBody,
    session: DbSession,
    user: CurrentUserDep,
):
    return await auth_service.update_profile(session, user.id, body)


@router.post("/me/avatar")
async def upload_avatar(
    session: DbSession,
    user: CurrentUserDep,
    file: UploadFile = File(...),
):
    data = await read_upload_limited(file, max_bytes=get_settings().avatar_max_bytes)
    return await auth_service.set_avatar(
        session, user.id, data, file.content_type or "application/octet-stream"
    )


# Public (no auth): rendered directly as an <img> src across the app, which
# can't attach a bearer token. Avatars aren't sensitive; bytes are streamed
# from the private bucket through the API.
@router.get("/users/{user_id}/avatar")
async def get_avatar(user_id: str, session: DbSession):
    data, content_type = await auth_service.get_avatar_bytes(session, user_id)
    return Response(
        content=data,
        media_type=content_type,
        # avatar_url is version-stamped (?v=<upload timestamp>) and never
        # reused for different bytes, so this exact URL can be cached
        # indefinitely - a re-upload gets a brand new URL instead.
        headers={"Cache-Control": "public, max-age=31536000, immutable"},
    )


@router.post("/me/change-password")
async def post_change_password(
    body: ChangePasswordBody,
    session: DbSession,
    user: CurrentUserDep,
):
    return await auth_service.change_password(session, user.id, body)


@router.post("/forgot-password")
async def forgot_password(
    body: ForgotPasswordBody,
    request: Request,
    session: DbSession,
    background_tasks: BackgroundTasks,
):
    settings = get_settings()
    await throttle(
        request,
        scope="auth.forgot_password",
        ip_limit=settings.auth_password_reset_ip_limit,
        account_limit=settings.auth_password_reset_account_limit,
        account=email_account(body.email),
    )
    result = await auth_service.request_password_reset(
        session, body.email, background_tasks
    )
    if settings.is_production:
        result.pop("resetToken", None)
    return result


@router.post("/reset-password")
async def reset_password(body: ResetPasswordBody, request: Request, session: DbSession):
    settings = get_settings()
    await throttle(
        request,
        scope="auth.reset_password",
        ip_limit=settings.auth_password_reset_ip_limit,
    )
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
                f"?error={quote(exc.code)}"
            ),
            status_code=302,
        )
    except Exception:
        import logging

        logging.getLogger(__name__).exception("Google OAuth start failed")
        return RedirectResponse(
            url=(
                f"{frontend}/auth/oauth/callback"
                f"?error=OAUTH_FAILED"
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
                f"?error={quote(exc.code)}"
            ),
            status_code=302,
        )
    except Exception:
        import logging

        logging.getLogger(__name__).exception("Google OAuth callback failed")
        return RedirectResponse(
            url=(
                f"{frontend}/auth/oauth/callback"
                f"?error=OAUTH_FAILED"
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
    }
