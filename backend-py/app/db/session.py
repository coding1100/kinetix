import asyncio
import logging
from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from app.config import get_settings

logger = logging.getLogger(__name__)

_engine = None
_session_factory: async_sessionmaker[AsyncSession] | None = None
_db_semaphore: asyncio.Semaphore | None = None

_DB_RETRY_ATTEMPTS = 3
_DB_RETRY_DELAYS_SEC = (0.1, 0.3)

# Transaction pooler (6543) — prepared statements must be disabled.
_TRANSACTION_POOLER_MARKERS = (":6543", "pooler.supabase.com:6543")

# Supabase session pooler caps clients (~15). Stay well under that limit.
_SESSION_POOLER_POOL_SIZE = 4
_SESSION_POOLER_MAX_OVERFLOW = 2


def _uses_transaction_pooler(url: str) -> bool:
    return any(marker in url for marker in _TRANSACTION_POOLER_MARKERS)


def _uses_supabase_session_pooler(url: str) -> bool:
    return "pooler.supabase.com" in url and not _uses_transaction_pooler(url)


def _connect_args(url: str) -> dict:
    args: dict = {"timeout": 60}
    if _uses_transaction_pooler(url):
        args["statement_cache_size"] = 0
        args["prepared_statement_cache_size"] = 0
    return args


def get_engine():
    global _engine
    if _engine is None:
        settings = get_settings()
        url = settings.async_database_url
        kwargs: dict = {"connect_args": _connect_args(url)}

        if _uses_transaction_pooler(url):
            # Let Supavisor own pooling; disable prepared statements.
            kwargs["poolclass"] = NullPool
        elif _uses_supabase_session_pooler(url):
            # Session pooler (5432): keep a warm pool; queue excess HTTP work in-app
            # instead of opening many slow Supabase TCP connections at once.
            kwargs.update(
                pool_pre_ping=True,
                pool_size=_SESSION_POOLER_POOL_SIZE,
                max_overflow=_SESSION_POOLER_MAX_OVERFLOW,
                pool_timeout=90,
                pool_recycle=180,
            )
        else:
            kwargs.update(
                pool_pre_ping=True,
                pool_size=5,
                max_overflow=5,
                pool_timeout=60,
                pool_recycle=300,
            )

        _engine = create_async_engine(url, **kwargs)
    return _engine


async def warmup_database() -> bool:
    from sqlalchemy import text

    settings = get_settings()
    url = settings.async_database_url
    engine = get_engine()
    try:
        # Supabase session pooler can take ~30s per new TCP connect from this
        # network. Pre-open pool slots so UI burst traffic reuses warm conns.
        if _uses_supabase_session_pooler(url):

            async def _ping() -> None:
                async with engine.connect() as conn:
                    await conn.execute(text("SELECT 1"))

            await asyncio.gather(*(_ping() for _ in range(_SESSION_POOLER_POOL_SIZE)))
        else:
            async with engine.connect() as conn:
                await conn.execute(text("SELECT 1"))
        return True
    except Exception:
        return False


def get_session_factory() -> async_sessionmaker[AsyncSession]:
    global _session_factory
    if _session_factory is None:
        _session_factory = async_sessionmaker(
            get_engine(),
            class_=AsyncSession,
            expire_on_commit=False,
        )
    return _session_factory


def _db_concurrency_limit(url: str) -> int:
    if _uses_supabase_session_pooler(url):
        return _SESSION_POOLER_POOL_SIZE + _SESSION_POOLER_MAX_OVERFLOW
    if _uses_transaction_pooler(url):
        return 20
    return 10


def _get_db_semaphore() -> asyncio.Semaphore:
    global _db_semaphore
    if _db_semaphore is None:
        settings = get_settings()
        url = settings.async_database_url
        _db_semaphore = asyncio.Semaphore(_db_concurrency_limit(url))
    return _db_semaphore


def _database_unavailable_response():
    from fastapi import HTTPException

    return HTTPException(
        status_code=503,
        detail={
            "error": {
                "code": "DATABASE_UNAVAILABLE",
                "message": "Database is temporarily unavailable. Please retry.",
            }
        },
    )


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    from sqlalchemy.exc import OperationalError, TimeoutError as SATimeoutError

    last_exc: BaseException | None = None

    for attempt in range(_DB_RETRY_ATTEMPTS):
        try:
            async with _get_db_semaphore():
                factory = get_session_factory()
                async with factory() as session:
                    yield session
            return
        except asyncio.CancelledError:
            raise
        except (TimeoutError, SATimeoutError, OperationalError) as exc:
            last_exc = exc
            if attempt < _DB_RETRY_ATTEMPTS - 1:
                delay = _DB_RETRY_DELAYS_SEC[min(attempt, len(_DB_RETRY_DELAYS_SEC) - 1)]
                logger.warning(
                    "DB session acquire failed (attempt %s/%s): %s",
                    attempt + 1,
                    _DB_RETRY_ATTEMPTS,
                    exc,
                )
                await asyncio.sleep(delay)
                continue
            logger.warning(
                "DB session unavailable after %s attempts: %s",
                _DB_RETRY_ATTEMPTS,
                exc,
            )
            raise _database_unavailable_response() from exc

    if last_exc is not None:
        raise _database_unavailable_response() from last_exc
