#!/bin/sh
set -e

echo "Waiting for postgres at postgres:5432..."
python - <<'PY'
import socket
import sys
import time

deadline = time.time() + 90
while time.time() < deadline:
    try:
        with socket.create_connection(("postgres", 5432), timeout=2):
            print("postgres is reachable")
            sys.exit(0)
    except OSError:
        time.sleep(1)

print("ERROR: postgres not reachable after 90s", file=sys.stderr)
sys.exit(1)
PY

echo "Checking database credentials..."
python - <<'PY'
import asyncio
import os
import sys

url = os.environ.get("DATABASE_URL", "")
if not url:
    print("ERROR: DATABASE_URL is not set", file=sys.stderr)
    sys.exit(1)

async def check() -> None:
    from sqlalchemy import text
    from sqlalchemy.ext.asyncio import create_async_engine

    async_url = url.replace("postgresql://", "postgresql+asyncpg://", 1)
    engine = create_async_engine(async_url)
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        print("database connection ok")
    except Exception as exc:
        print(f"ERROR: database connection failed: {exc}", file=sys.stderr)
        print(
            "TIP: ensure docker-compose.env POSTGRES_PASSWORD matches the "
            "existing postgres volume password",
            file=sys.stderr,
        )
        sys.exit(1)
    finally:
        await engine.dispose()

asyncio.run(check())
PY

exec python -m uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-4000}"
