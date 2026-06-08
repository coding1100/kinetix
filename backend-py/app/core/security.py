from datetime import datetime, timedelta, timezone

import bcrypt
import jwt

from app.config import get_settings


def _settings():
    return get_settings()


def _bcrypt_input(value: str) -> bytes:
    """Match bcrypt/bcryptjs behavior: blowfish uses at most 72 bytes."""
    return value.encode("utf-8")[:72]


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt(rounds=12)).decode()


def verify_password(password: str, password_hash: str) -> bool:
    return bcrypt.checkpw(password.encode(), password_hash.encode())


def hash_token(token: str) -> str:
    return bcrypt.hashpw(_bcrypt_input(token), bcrypt.gensalt(rounds=10)).decode()


def verify_token_hash(token: str, token_hash: str) -> bool:
    return bcrypt.checkpw(_bcrypt_input(token), token_hash.encode())


def sign_access_token(*, sub: str, email: str) -> str:
    settings = _settings()
    exp = datetime.now(timezone.utc) + timedelta(minutes=settings.jwt_access_expires_minutes)
    return jwt.encode(
        {"sub": sub, "email": email, "exp": exp},
        settings.jwt_access_secret,
        algorithm="HS256",
    )


def verify_access_token(token: str) -> dict[str, str]:
    settings = _settings()
    payload = jwt.decode(token, settings.jwt_access_secret, algorithms=["HS256"])
    return {"sub": payload["sub"], "email": payload["email"]}


def sign_refresh_token(user_id: str) -> str:
    settings = _settings()
    exp = datetime.now(timezone.utc) + timedelta(days=settings.jwt_refresh_expires_days)
    return jwt.encode(
        {"sub": user_id, "exp": exp},
        settings.jwt_refresh_secret,
        algorithm="HS256",
    )


def verify_refresh_token(token: str) -> dict[str, str]:
    settings = _settings()
    payload = jwt.decode(token, settings.jwt_refresh_secret, algorithms=["HS256"])
    return {"sub": payload["sub"]}
