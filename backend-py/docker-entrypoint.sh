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

exec python -m uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-4000}"
