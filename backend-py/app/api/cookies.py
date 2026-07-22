from fastapi import Response

from app.config import get_settings

REFRESH_COOKIE = "riseup_refresh"
COOKIE_PATH = "/"
COOKIE_MAX_AGE = 7 * 24 * 60 * 60

# Admin portal uses a distinctly-named, path-scoped cookie so it never
# collides with (or overwrites) a regular user session in the same browser —
# both apps are same-origin under nginx path routing (/admin-portal/).
ADMIN_REFRESH_COOKIE = "riseup_admin_refresh"
ADMIN_COOKIE_PATH = "/api/v1/admin"


def set_refresh_cookie(response: Response, token: str) -> None:
    settings = get_settings()
    response.set_cookie(
        key=REFRESH_COOKIE,
        value=token,
        httponly=True,
        secure=settings.is_production,
        samesite="lax",
        max_age=COOKIE_MAX_AGE,
        path=COOKIE_PATH,
    )


def clear_refresh_cookie(response: Response) -> None:
    response.delete_cookie(key=REFRESH_COOKIE, path=COOKIE_PATH)


def set_admin_refresh_cookie(response: Response, token: str) -> None:
    settings = get_settings()
    response.set_cookie(
        key=ADMIN_REFRESH_COOKIE,
        value=token,
        httponly=True,
        secure=settings.is_production,
        samesite="lax",
        max_age=COOKIE_MAX_AGE,
        path=ADMIN_COOKIE_PATH,
    )


def clear_admin_refresh_cookie(response: Response) -> None:
    response.delete_cookie(key=ADMIN_REFRESH_COOKIE, path=ADMIN_COOKIE_PATH)
