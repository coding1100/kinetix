import asyncio
import asyncpg


async def main() -> None:
    conn = await asyncpg.connect(
        user="riseup",
        password="riseup",
        database="riseup",
        host="127.0.0.1",
        port=5433,
    )
    print("connected", await conn.fetchval("SELECT 1"))
    await conn.close()


asyncio.run(main())
