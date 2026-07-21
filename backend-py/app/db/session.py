import asyncio
import logging
from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.config import get_settings

logger = logging.getLogger(__name__)

_engine = None
_session_factory: async_sessionmaker[AsyncSession] | None = None
_db_semaphore: asyncio.Semaphore | None = None

_DB_RETRY_ATTEMPTS = 3
_DB_RETRY_DELAYS_SEC = (0.1, 0.3)
_POOL_SIZE = 5
_MAX_OVERFLOW = 5
_DB_CONCURRENCY_LIMIT = _POOL_SIZE + _MAX_OVERFLOW


def get_engine():
    global _engine
    if _engine is None:
        settings = get_settings()
        _engine = create_async_engine(
            settings.async_database_url,
            connect_args={"timeout": 60},
            pool_pre_ping=True,
            pool_size=_POOL_SIZE,
            max_overflow=_MAX_OVERFLOW,
            pool_timeout=60,
            pool_recycle=300,
        )
    return _engine


async def warmup_database() -> bool:
    from sqlalchemy import text

    engine = get_engine()
    try:
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


def _get_db_semaphore() -> asyncio.Semaphore:
    global _db_semaphore
    if _db_semaphore is None:
        _db_semaphore = asyncio.Semaphore(_DB_CONCURRENCY_LIMIT)
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
