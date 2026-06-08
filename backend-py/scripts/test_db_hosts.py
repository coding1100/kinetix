import asyncio
import time

import asyncpg

HOSTS = [
    "aws-1-ap-southeast-2.pooler.supabase.com:5432",
    "aws-1-ap-southeast-2.pooler.supabase.com:6543",
    "db.idjyzrtalfibjphdjqqn.supabase.co:5432",
]
USER = "postgres.idjyzrtalfibjphdjqqn"
PASSWORD = "htrajpoot9673"
DB = "postgres"


async def test(host: str) -> None:
    dsn = f"postgresql://{USER}:{PASSWORD}@{host}/{DB}"
    t0 = time.time()
    try:
        conn = await asyncio.wait_for(
            asyncpg.connect(dsn, timeout=30, statement_cache_size=0),
            timeout=35,
        )
        v = await conn.fetchval("SELECT 1")
        await conn.close()
        print(f"OK  {host} {v} in {time.time()-t0:.1f}s")
    except Exception as exc:
        print(f"FAIL {host} {type(exc).__name__} in {time.time()-t0:.1f}s")


async def main():
    for host in HOSTS:
        await test(host)


asyncio.run(main())
