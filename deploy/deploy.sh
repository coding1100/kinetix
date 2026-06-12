#!/usr/bin/env bash
# Production deploy for EC2 — run manually or via GitHub Actions.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_ROOT="${APP_ROOT:-$ROOT}"
FRONTEND="$APP_ROOT/frontend"
BACKEND="$APP_ROOT/backend-py"
DEPLOY_USER="${DEPLOY_USER:-ubuntu}"

log() { echo "==> $*"; }

wait_for_http() {
  local url="$1"
  local label="$2"
  local attempts="${3:-45}"
  local i=1
  while [ "$i" -le "$attempts" ]; do
    if curl -fsS "$url" >/dev/null 2>&1; then
      log "$label ready ($url)"
      return 0
    fi
    sleep 2
    i=$((i + 1))
  done
  echo "ERROR: $label not ready after $((attempts * 2))s — $url"
  return 1
}

run_as_user() {
  local dir="$1"
  shift
  if [ "$(id -un)" = "$DEPLOY_USER" ]; then
    bash -lc "cd '$dir' && $*"
  else
    sudo -u "$DEPLOY_USER" -- bash -lc "cd '$dir' && $*"
  fi
}

log "App root: $APP_ROOT"
log "Fix ownership ($DEPLOY_USER — avoids EACCES after sudo deploys)"
sudo chown -R "$DEPLOY_USER:$DEPLOY_USER" "$FRONTEND" "$BACKEND" 2>/dev/null || true
cd "$APP_ROOT"

log "Pull latest code"
git fetch origin main
git reset --hard origin/main

log "Stop dev Next.js (prevents Turbopack chunk errors)"
sudo systemctl stop kinetix-web 2>/dev/null || true
pkill -f '[n]ext dev' 2>/dev/null || true
if lsof -i :3000 -t >/dev/null 2>&1; then
  fuser -k 3000/tcp 2>/dev/null || true
  sleep 2
fi

log "Install systemd units"
sudo cp "$ROOT/deploy/systemd/kinetix-postgres.service" /etc/systemd/system/
sudo cp "$ROOT/deploy/systemd/kinetix-api.service" /etc/systemd/system/
sudo cp "$ROOT/deploy/systemd/kinetix-web.service" /etc/systemd/system/
sudo sed -i "s|/opt/clickup/kinetix|$APP_ROOT|g" /etc/systemd/system/kinetix-postgres.service
sudo sed -i "s|/opt/clickup/kinetix|$APP_ROOT|g" /etc/systemd/system/kinetix-api.service
sudo sed -i "s|/opt/clickup/kinetix|$APP_ROOT|g" /etc/systemd/system/kinetix-web.service
sudo systemctl daemon-reload

log "PostgreSQL (Docker)"
if [ ! -f "$APP_ROOT/docker-compose.env" ]; then
  echo "ERROR: missing $APP_ROOT/docker-compose.env (copy from docker-compose.env.example)"
  exit 1
fi
sudo systemctl enable kinetix-postgres
sudo systemctl start kinetix-postgres
COMPOSE="docker compose -f docker-compose.yml -f docker-compose.prod.yml"
# shellcheck disable=SC1091
set -a
source "$APP_ROOT/docker-compose.env"
set +a
POSTGRES_USER="${POSTGRES_USER:-riseup}"
POSTGRES_DB="${POSTGRES_DB:-riseup}"
cd "$APP_ROOT"
if ! $COMPOSE up -d postgres; then
  echo "ERROR: failed to start Postgres container"
  exit 1
fi
pg_attempts=30
pg_i=1
while [ "$pg_i" -le "$pg_attempts" ]; do
  if $COMPOSE exec -T postgres pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB" >/dev/null 2>&1; then
    log "Postgres ready"
    break
  fi
  sleep 2
  pg_i=$((pg_i + 1))
done
if [ "$pg_i" -gt "$pg_attempts" ]; then
  echo "ERROR: Postgres not ready after $((pg_attempts * 2))s"
  $COMPOSE logs postgres --tail 40 || true
  exit 1
fi

log "Backend dependencies"
cd "$BACKEND"
export PATH="$HOME/.local/bin:$PATH"
if ! command -v uv >/dev/null 2>&1; then
  curl -LsSf https://astral.sh/uv/install.sh | sh
  export PATH="$HOME/.local/bin:$PATH"
fi
if ! command -v uv >/dev/null 2>&1; then
  echo "ERROR: uv not found after install (expected in \$HOME/.local/bin)"
  exit 1
fi
# uv sync creates/updates .venv — avoid system pip (PEP 668 on Ubuntu 24.04+)
uv sync
sudo chown -R "$DEPLOY_USER:$DEPLOY_USER" "$BACKEND"

log "Frontend production build"
run_as_user "$FRONTEND" 'rm -rf .next node_modules/.cache'
run_as_user "$FRONTEND" 'npm ci'
run_as_user "$FRONTEND" 'NODE_ENV=production npm run build'

if [ ! -d "$FRONTEND/.next/static/chunks" ]; then
  echo "ERROR: frontend build missing .next/static/chunks"
  exit 1
fi

log "Nginx config"
if [ -f "$ROOT/kinetix-site.conf" ]; then
  # Remove stale copies that caused "duplicate upstream kinetix_web"
  sudo rm -f /etc/nginx/conf.d/kinetix.conf /etc/nginx/conf.d/kinetix-upstreams.conf
  sudo sed "s|/opt/clickup/kinetix|$APP_ROOT|g" "$ROOT/kinetix-site.conf" \
    | sudo tee /etc/nginx/sites-available/kinetix >/dev/null
  sudo ln -sf /etc/nginx/sites-available/kinetix /etc/nginx/sites-enabled/kinetix
  sudo rm -f /etc/nginx/sites-enabled/default
  sudo nginx -t
  sudo systemctl reload nginx
fi

log "Restart services"
sudo systemctl enable kinetix-api kinetix-web
sudo systemctl restart kinetix-api kinetix-web

log "Health checks"
if ! wait_for_http "http://127.0.0.1:4000/health" "API"; then
  sudo journalctl -u kinetix-api -n 40 --no-pager
  exit 1
fi

if ! wait_for_http "http://127.0.0.1:3000/auth/login" "Web"; then
  sudo journalctl -u kinetix-web -n 40 --no-pager
  exit 1
fi

if pgrep -af '[n]ext dev' >/dev/null 2>&1; then
  echo "ERROR: next dev is still running. Use next start only."
  pgrep -af next || true
  exit 1
fi

SAMPLE_CHUNK=$(curl -fsS http://127.0.0.1:3000/auth/login | grep -oE '/_next/static/chunks/[^"]+\.js' | head -1)
if [ -n "$SAMPLE_CHUNK" ]; then
  CHUNK_CODE=$(curl -fsS -o /dev/null -w "%{http_code}" "http://127.0.0.1:3000$SAMPLE_CHUNK" 2>/dev/null || echo "000")
  if ! echo "$CHUNK_CODE" | grep -qE '^2'; then
    echo "ERROR: chunk $SAMPLE_CHUNK returned HTTP $CHUNK_CODE"
    sudo journalctl -u kinetix-web -n 40 --no-pager
    exit 1
  fi
fi

if ! sudo systemctl is-active --quiet kinetix-api; then
  echo "ERROR: kinetix-api is not active"
  exit 1
fi

if ! sudo systemctl is-active --quiet kinetix-web; then
  echo "ERROR: kinetix-web is not active"
  exit 1
fi

log "Deploy complete — API and web are healthy (production mode)"
