from fastapi import Response

from app.config import get_settings

REFRESH_COOKIE = "riseup_refresh"
COOKIE_PATH = "/"
COOKIE_MAX_AGE = 7 * 24 * 60 * 60


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
