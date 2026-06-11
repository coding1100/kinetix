import base64
import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from urllib.parse import urlencode

import httpx
import jwt
from jwt import PyJWKClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.config import get_settings
from app.core.errors import AppError
from app.core.utils import generate_token, unique_workspace_slug
from app.db.models.enums import MemberStatus, WorkspaceRole
from app.db.models.oauth import OAuthAccount, OAuthExchange, OAuthState
from app.db.models.user import User
from app.db.models.workspace import Workspace, WorkspaceMember
from app.core.security import sign_access_token
from app.services.auth_service import _auth_response, issue_refresh_for_user

GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_JWKS_URL = "https://www.googleapis.com/oauth2/v3/certs"
STATE_TTL_MINUTES = 10
EXCHANGE_TTL_MINUTES = 5
# Allow clock skew between this server and Google (fixes ImmatureSignatureError on iat)
JWT_CLOCK_SKEW_SECONDS = 300
_jwks_client = PyJWKClient(GOOGLE_JWKS_URL)


def _pkce_challenge(verifier: str) -> str:
    digest = hashlib.sha256(verifier.encode("ascii")).digest()
    return base64.urlsafe_b64encode(digest).rstrip(b"=").decode("ascii")


def safe_next_path(raw: str | None) -> str:
    if not raw or not raw.startswith("/") or raw.startswith("//"):
        return "/home/inbox"
    return raw


def _safe_next_path(raw: str | None) -> str:
    return safe_next_path(raw)


def _require_google_config() -> None:
    if not get_settings().google_oauth_enabled:
        raise AppError(
            503,
            "OAUTH_NOT_CONFIGURED",
            "Google sign-in is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.",
        )


async def start_google_oauth(session: AsyncSession, next_path: str | None) -> str:
    _require_google_config()
    settings = get_settings()
    state = secrets.token_urlsafe(32)
    verifier = secrets.token_urlsafe(64)
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=STATE_TTL_MINUTES)
    session.add(
        OAuthState(
            state=state,
            code_verifier=verifier,
            next_path=_safe_next_path(next_path),
            expires_at=expires_at,
        )
    )
    await session.commit()

    params = {
        "client_id": settings.google_client_id,
        "redirect_uri": settings.google_redirect_uri,
        "response_type": "code",
        "scope": "openid email profile",
        "state": state,
        "code_challenge": _pkce_challenge(verifier),
        "code_challenge_method": "S256",
        "access_type": "online",
        "prompt": "select_account",
    }
    return f"{GOOGLE_AUTH_URL}?{urlencode(params)}"


def _verify_google_id_token(id_token: str) -> dict:
    settings = get_settings()
    try:
        signing_key = _jwks_client.get_signing_key_from_jwt(id_token)
        return jwt.decode(
            id_token,
            signing_key.key,
            algorithms=["RS256"],
            audience=settings.google_client_id,
            issuer=["https://accounts.google.com", "accounts.google.com"],
            leeway=JWT_CLOCK_SKEW_SECONDS,
        )
    except jwt.PyJWTError as exc:
        raise AppError(
            400,
            "OAUTH_FAILED",
            "Could not verify Google sign-in. Check your system clock and try again.",
        ) from exc


async def _exchange_code_for_tokens(code: str, code_verifier: str) -> dict:
    settings = get_settings()
    async with httpx.AsyncClient(timeout=20.0) as client:
        res = await client.post(
            GOOGLE_TOKEN_URL,
            data={
                "code": code,
                "client_id": settings.google_client_id,
                "client_secret": settings.google_client_secret,
                "redirect_uri": settings.google_redirect_uri,
                "grant_type": "authorization_code",
                "code_verifier": code_verifier,
            },
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )
    if res.status_code != 200:
        try:
            err_body = res.json()
            err_msg = err_body.get("error_description") or err_body.get("error")
        except Exception:
            err_msg = res.text[:200] if res.text else None
        hint = f" ({err_msg})" if err_msg else ""
        raise AppError(
            400,
            "OAUTH_FAILED",
            f"Could not complete Google sign-in{hint}. "
            "Check API_PUBLIC_URL matches the redirect URI in Google Cloud Console.",
        )
    return res.json()


async def _find_or_create_user(
    session: AsyncSession, claims: dict
) -> User:
    sub = claims.get("sub")
    email = (claims.get("email") or "").strip().lower()
    email_verified = claims.get("email_verified") in (True, "true", "True", 1)
    full_name = (claims.get("name") or email.split("@")[0] or "User").strip()
    picture = claims.get("picture")

    if not sub:
        raise AppError(400, "OAUTH_FAILED", "Google profile missing subject")

    oauth_row = await session.scalar(
        select(OAuthAccount)
        .where(
            OAuthAccount.provider == "google",
            OAuthAccount.provider_user_id == sub,
        )
        .options(selectinload(OAuthAccount.user))
    )
    if oauth_row:
        user = oauth_row.user
        if picture and not user.avatar_url:
            user.avatar_url = picture
        if full_name and user.full_name == "User":
            user.full_name = full_name
        return user

    user: User | None = None
    if email and email_verified:
        user = await session.scalar(select(User).where(User.email == email))

    if user:
        if user.password_hash:
            raise AppError(
                409,
                "EMAIL_USE_PASSWORD",
                "This email uses password login. Sign in with email and password.",
            )
        existing_oauth = await session.scalar(
            select(OAuthAccount).where(
                OAuthAccount.user_id == user.id,
                OAuthAccount.provider == "google",
            )
        )
        if not existing_oauth:
            session.add(
                OAuthAccount(
                    provider="google",
                    provider_user_id=sub,
                    user_id=user.id,
                )
            )
        if picture:
            user.avatar_url = picture
        return user

    if not email or not email_verified:
        raise AppError(
            400,
            "OAUTH_EMAIL_REQUIRED",
            "Google did not provide a verified email for this account.",
        )

    workspace_name = f"{full_name.split(' ')[0]}'s Workspace"

    async def slug_exists(slug: str) -> bool:
        row = await session.scalar(select(Workspace).where(Workspace.slug == slug))
        return row is not None

    slug = await unique_workspace_slug(workspace_name, slug_exists)

    user = User(email=email, password_hash=None, full_name=full_name, avatar_url=picture)
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
    session.add(
        OAuthAccount(
            provider="google",
            provider_user_id=sub,
            user_id=user.id,
        )
    )
    return user


async def complete_google_callback(
    session: AsyncSession, code: str, state: str
) -> tuple[str, str]:
    """Returns (exchange_code, next_path) for frontend redirect."""
    _require_google_config()
    now = datetime.now(timezone.utc)
    oauth_state = await session.scalar(
        select(OAuthState).where(OAuthState.state == state)
    )
    if not oauth_state or oauth_state.expires_at < now:
        raise AppError(400, "OAUTH_STATE_INVALID", "Sign-in session expired. Try again.")

    token_data = await _exchange_code_for_tokens(code, oauth_state.code_verifier)
    id_token = token_data.get("id_token")
    if not id_token:
        raise AppError(400, "OAUTH_FAILED", "Google did not return an ID token")

    claims = _verify_google_id_token(id_token)
    user = await _find_or_create_user(session, claims)

    next_path = oauth_state.next_path
    exchange_code = generate_token()[:48]
    session.add(
        OAuthExchange(
            code=exchange_code,
            user_id=user.id,
            expires_at=now + timedelta(minutes=EXCHANGE_TTL_MINUTES),
        )
    )
    await session.delete(oauth_state)
    try:
        await session.commit()
    except Exception as exc:
        await session.rollback()
        raise AppError(
            500,
            "OAUTH_FAILED",
            f"Could not save sign-in session ({type(exc).__name__}).",
        ) from exc

    return exchange_code, next_path


async def exchange_oauth_code(session: AsyncSession, code: str) -> dict:
    now = datetime.now(timezone.utc)
    row = await session.scalar(select(OAuthExchange).where(OAuthExchange.code == code))
    if not row or row.used_at or row.expires_at < now:
        raise AppError(400, "OAUTH_CODE_INVALID", "Sign-in link expired. Try again.")

    user = await session.get(User, row.user_id)
    if not user:
        raise AppError(400, "OAUTH_CODE_INVALID", "User not found")

    row.used_at = now
    access_token = sign_access_token(sub=str(user.id), email=user.email)
    refresh_token = await issue_refresh_for_user(session, user.id)
    await session.commit()

    return {**_auth_response(user, access_token), "refreshToken": refresh_token}
