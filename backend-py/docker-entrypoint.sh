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

echo "Preparing database URL from container env..."
eval "$(python - <<'PY'
import os
import shlex
import sys
from urllib.parse import quote_plus

user = os.environ.get("POSTGRES_USER", "riseup")
password = os.environ.get("POSTGRES_PASSWORD", "")
db = os.environ.get("POSTGRES_DB", "riseup")

url = os.environ.get("DATABASE_URL", "")
if not url:
    if not password:
        print("echo 'ERROR: POSTGRES_PASSWORD is not set in container env' >&2", file=sys.stderr)
        print("exit 1")
        sys.exit(0)
    url = (
        f"postgresql://{quote_plus(user)}:{quote_plus(password)}"
        f"@postgres:5432/{quote_plus(db)}"
    )

print(f"export DATABASE_URL={shlex.quote(url)}")
print(f"export DIRECT_DATABASE_URL={shlex.quote(url)}")
safe = url.split('@')[-1] if '@' in url else url
print(f"echo DATABASE_URL target: ...@{safe}")
PY
)"

echo "Checking database credentials..."
python - <<'PY'
import asyncio
import os
import sys

url = os.environ["DATABASE_URL"]

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
        sys.exit(1)
    finally:
        await engine.dispose()

asyncio.run(check())
PY

exec python -m uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-4000}"
