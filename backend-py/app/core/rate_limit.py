from __future__ import annotations

import asyncio
import time
from collections import defaultdict, deque

from fastapi import Request

from app.config import get_settings
from app.core.errors import AppError

_buckets: dict[str, deque[float]] = defaultdict(deque)
_lock = asyncio.Lock()


def client_ip(request: Request) -> str:
    forwarded_for = request.headers.get("x-forwarded-for", "")
    if forwarded_for:
        return forwarded_for.split(",", 1)[0].strip()
    real_ip = request.headers.get("x-real-ip", "").strip()
    if real_ip:
        return real_ip
    return request.client.host if request.client else "unknown"


async def throttle(
    request: Request,
    *,
    scope: str,
    ip_limit: int,
    account_limit: int | None = None,
    account: str | None = None,
    window_seconds: int | None = None,
) -> None:
    settings = get_settings()
    import sys
    if not settings.auth_rate_limit_enabled or settings.node_env == "test" or "pytest" in sys.modules:
        return

    window = window_seconds or settings.auth_rate_limit_window_seconds
    now = time.monotonic()
    checks = [(f"{scope}:ip:{client_ip(request)}", ip_limit)]
    if account_limit is not None and account:
        checks.append((f"{scope}:account:{account.lower().strip()}", account_limit))

    async with _lock:
        for key, limit in checks:
            bucket = _buckets[key]
            while bucket and now - bucket[0] >= window:
                bucket.popleft()
            if len(bucket) >= limit:
                raise AppError(
                    429,
                    "RATE_LIMITED",
                    "Too many attempts. Please wait before trying again.",
                )

        for key, _limit in checks:
            _buckets[key].append(now)


def email_account(email: str | None) -> str | None:
    return email.lower().strip() if email else None
