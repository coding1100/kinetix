import asyncio
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy.pool import NullPool

from app.config import get_settings


async def try_engine(label: str, **kwargs) -> bool:
    settings = get_settings()
    url = settings.async_database_url
    try:
        engine = create_async_engine(url, **kwargs)
        async with engine.connect() as conn:
            v = (await conn.execute(text("SELECT 1"))).scalar()
            print(f"{label}: OK {v}")
        await engine.dispose()
        return True
    except Exception as exc:
        print(f"{label}: FAIL {type(exc).__name__} {exc}")
        return False


async def main():
    minimal = {"connect_args": {"timeout": 60}}
    nullpool = {**minimal, "poolclass": NullPool}
    full = {
        "poolclass": NullPool,
        "connect_args": {
            "statement_cache_size": 0,
            "prepared_statement_cache_size": 0,
            "timeout": 60,
            "command_timeout": 60,
        },
    }
    pooled = {
        "pool_pre_ping": True,
        "pool_size": 5,
        "connect_args": {"timeout": 60},
    }
    for label, kwargs in [
        ("minimal", minimal),
        ("nullpool", nullpool),
        ("full", full),
        ("pooled", pooled),
    ]:
        if await try_engine(label, **kwargs):
            return


if __name__ == "__main__":
    asyncio.run(main())
