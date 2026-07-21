"""Quick local DB probe."""
import asyncio

from sqlalchemy import text

from app.db.session import get_engine


async def main() -> None:
    async with get_engine().connect() as conn:
        print("SELECT 1 =>", (await conn.execute(text("SELECT 1"))).scalar())
    try:
        async with get_engine().connect() as conn:
            n = (await conn.execute(text('SELECT COUNT(*) FROM "User"'))).scalar()
            print(f"User count => {n}")
    except Exception as exc:
        print(f"User table => {type(exc).__name__}: {exc}")


if __name__ == "__main__":
    asyncio.run(main())
