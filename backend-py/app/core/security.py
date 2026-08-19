import re
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt

from app.config import get_settings


def _settings():
    return get_settings()


def validate_password_strength(password: str) -> str:
    """Require lower, upper, digit, and symbol. Raises ValueError with a
    user-facing message on failure; used from pydantic field_validators."""
    if len(password) < 8:
        raise ValueError("Password must be at least 8 characters")
    if not re.search(r"[a-z]", password):
        raise ValueError("Password must include a lowercase letter")
    if not re.search(r"[A-Z]", password):
        raise ValueError("Password must include an uppercase letter")
    if not re.search(r"\d", password):
        raise ValueError("Password must include a number")
    if not re.search(r"[^\w\s]", password):
        raise ValueError("Password must include a symbol")
    return password


def _bcrypt_input(value: str) -> bytes:
    """Match bcrypt/bcryptjs behavior: blowfish uses at most 72 bytes."""
    return value.encode("utf-8")[:72]


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt(rounds=12)).decode()


def verify_password(password: str, password_hash: str) -> bool:
    return bcrypt.checkpw(password.encode(), password_hash.encode())


import hashlib


def hash_token(token: str) -> str:
    return bcrypt.hashpw(_bcrypt_input(token), bcrypt.gensalt(rounds=10)).decode()


def hash_reset_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def verify_token_hash(token: str, token_hash: str) -> bool:
    if token_hash.startswith("$2b$") or token_hash.startswith("$2a$"):
        return bcrypt.checkpw(_bcrypt_input(token), token_hash.encode())
    return hashlib.sha256(token.encode("utf-8")).hexdigest() == token_hash



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
