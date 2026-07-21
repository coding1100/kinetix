#!/bin/sh
set -e

if [ ! -f /app/server.js ]; then
  echo "ERROR: /app/server.js missing — Next standalone build failed" >&2
  ls -la /app >&2 || true
  exit 1
fi

echo "Starting Next.js on ${HOSTNAME:-0.0.0.0}:${PORT:-3000} (basePath=${NEXT_PUBLIC_BASE_PATH:-})"
exec node /app/server.js
