#!/usr/bin/env bash
# One-time staging setup — Docker only (no systemd).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_ROOT="${APP_ROOT:-$ROOT}"
PUBLIC_HOST="${PUBLIC_HOST:-3.140.5.67}"

log() { echo "==> $*"; }

log "Staging Docker setup at $APP_ROOT"

if [ ! -f "$APP_ROOT/docker-compose.env" ]; then
  if [ -f "$APP_ROOT/docker-compose.env.example" ]; then
    cp "$APP_ROOT/docker-compose.env.example" "$APP_ROOT/docker-compose.env"
    log "Created docker-compose.env — set POSTGRES_PASSWORD before production use"
  else
    echo "ERROR: missing docker-compose.env"
    exit 1
  fi
fi

if [ ! -f "$APP_ROOT/backend-py/.env" ]; then
  cp "$APP_ROOT/backend-py/.env.example" "$APP_ROOT/backend-py/.env"
  log "Created backend-py/.env — review secrets"
fi

chmod +x "$APP_ROOT/deploy/deploy-staging.sh" "$APP_ROOT/deploy/diagnose-staging.sh" 2>/dev/null || true

export STAGING_PUBLIC_URL="http://${PUBLIC_HOST}/staging"
export STAGING_FRONTEND_ORIGIN="http://${PUBLIC_HOST}"
export PROD_ROOT="${PROD_ROOT:-/opt/clickup/kinetix}"

"$APP_ROOT/deploy/deploy-staging.sh"

log "Setup complete — http://${PUBLIC_HOST}/staging/auth/login"
