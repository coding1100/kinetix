import asyncio

from sqlalchemy import text

from app.db.session import get_engine


async def main() -> None:
    async with get_engine().connect() as conn:
        for table in ("OAuthState", "OAuthExchange", "OAuthAccount"):
            try:
                await conn.execute(text(f'SELECT 1 FROM "{table}" LIMIT 1'))
                print(f"{table}: OK")
            except Exception as exc:
                print(f"{table}: FAIL - {exc}")

        row = await conn.execute(
            text(
                """
                SELECT is_nullable FROM information_schema.columns
                WHERE table_name = 'User' AND column_name = 'passwordHash'
                """
            )
        )
        print(f"User.passwordHash nullable: {row.scalar()}")


if __name__ == "__main__":
    asyncio.run(main())
