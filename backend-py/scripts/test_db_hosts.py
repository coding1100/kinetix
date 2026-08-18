import asyncio
import os
import time

import asyncpg

HOSTS = [h.strip() for h in os.environ.get("DB_TEST_HOSTS", "").split(",") if h.strip()]
USER = os.environ.get("DB_TEST_USER", "")
PASSWORD = os.environ.get("DB_TEST_PASSWORD", "")
DB = os.environ.get("DB_TEST_NAME", "postgres")


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
    if not HOSTS or not USER or not PASSWORD:
        raise SystemExit(
            "Set DB_TEST_HOSTS, DB_TEST_USER, and DB_TEST_PASSWORD before running this script."
        )
    for host in HOSTS:
        await test(host)


asyncio.run(main())
