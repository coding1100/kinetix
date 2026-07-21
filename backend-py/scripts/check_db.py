import asyncio

from sqlalchemy import text

from app.db.session import get_engine


async def main() -> None:
    try:
        async with asyncio.timeout(8):
            async with get_engine().connect() as conn:
                value = (await conn.execute(text("SELECT 1"))).scalar()
        print(f"database ok: {value}")
    except Exception as exc:
        print(f"database fail: {type(exc).__name__}: {exc}")


if __name__ == "__main__":
    asyncio.run(main())
