#!/usr/bin/env bash
# Staging deploy for EC2 — run manually or via GitHub Actions (develop branch).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_ROOT="${APP_ROOT:-$ROOT}"
DEFAULT_APP_ROOT="/opt/clickup/kinetix-staging"
DEPLOY_BRANCH="${DEPLOY_BRANCH:-develop}"
WEB_PORT="${WEB_PORT:-3050}"
API_PORT="${API_PORT:-4050}"
FRONTEND="$APP_ROOT/frontend"
BACKEND="$APP_ROOT/backend-py"
DEPLOY_USER="${DEPLOY_USER:-ubuntu}"
API_SERVICE="${API_SERVICE:-kinetix-staging-api}"
WEB_SERVICE="${WEB_SERVICE:-kinetix-staging-web}"

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

log "Staging deploy — branch=$DEPLOY_BRANCH app=$APP_ROOT web=$WEB_PORT api=$API_PORT"
log "Fix ownership ($DEPLOY_USER)"
sudo chown -R "$DEPLOY_USER:$DEPLOY_USER" "$FRONTEND" "$BACKEND" 2>/dev/null || true
cd "$APP_ROOT"

log "Pull latest code ($DEPLOY_BRANCH)"
git fetch origin "$DEPLOY_BRANCH"
git reset --hard "origin/$DEPLOY_BRANCH"

log "Stop staging Next.js if running"
sudo systemctl stop "$WEB_SERVICE" 2>/dev/null || true
if lsof -i :"$WEB_PORT" -t >/dev/null 2>&1; then
  fuser -k "${WEB_PORT}/tcp" 2>/dev/null || true
  sleep 2
fi

log "Install staging systemd units"
sudo cp "$ROOT/deploy/systemd/kinetix-staging-api.service" /etc/systemd/system/
sudo cp "$ROOT/deploy/systemd/kinetix-staging-web.service" /etc/systemd/system/
sudo sed -i "s|$DEFAULT_APP_ROOT|$APP_ROOT|g" /etc/systemd/system/kinetix-staging-api.service
sudo sed -i "s|$DEFAULT_APP_ROOT|$APP_ROOT|g" /etc/systemd/system/kinetix-staging-web.service
sudo sed -i "s|--port 4050|--port $API_PORT|g" /etc/systemd/system/kinetix-staging-api.service
sudo sed -i "s|-p 3050 |-p $WEB_PORT |g" /etc/systemd/system/kinetix-staging-web.service
sudo sed -i "s|Environment=PORT=3050|Environment=PORT=$WEB_PORT|g" /etc/systemd/system/kinetix-staging-web.service
sudo systemctl daemon-reload

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

log "Nginx staging config"
if [ -f "$ROOT/kinetix-staging-site.conf" ]; then
  sudo sed "s|$DEFAULT_APP_ROOT|$APP_ROOT|g" "$ROOT/kinetix-staging-site.conf" \
    | sudo tee /etc/nginx/sites-available/kinetix-staging >/dev/null
  sudo ln -sf /etc/nginx/sites-available/kinetix-staging /etc/nginx/sites-enabled/kinetix-staging
  sudo nginx -t
  sudo systemctl reload nginx
fi

log "Restart staging services"
sudo systemctl enable "$API_SERVICE" "$WEB_SERVICE"
sudo systemctl restart "$API_SERVICE" "$WEB_SERVICE"

log "Health checks"
if ! wait_for_http "http://127.0.0.1:${API_PORT}/health" "Staging API"; then
  sudo journalctl -u "$API_SERVICE" -n 40 --no-pager
  exit 1
fi

if ! wait_for_http "http://127.0.0.1:${WEB_PORT}/auth/login" "Staging Web"; then
  sudo journalctl -u "$WEB_SERVICE" -n 40 --no-pager
  exit 1
fi

SAMPLE_CHUNK=$(curl -fsS "http://127.0.0.1:${WEB_PORT}/auth/login" | grep -oE '/_next/static/chunks/[^"]+\.js' | head -1)
if [ -n "$SAMPLE_CHUNK" ]; then
  CHUNK_CODE=$(curl -fsS -o /dev/null -w "%{http_code}" "http://127.0.0.1:${WEB_PORT}${SAMPLE_CHUNK}" 2>/dev/null || echo "000")
  if ! echo "$CHUNK_CODE" | grep -qE '^2'; then
    echo "ERROR: chunk $SAMPLE_CHUNK returned HTTP $CHUNK_CODE"
    sudo journalctl -u "$WEB_SERVICE" -n 40 --no-pager
    exit 1
  fi
fi

if ! sudo systemctl is-active --quiet "$API_SERVICE"; then
  echo "ERROR: $API_SERVICE is not active"
  exit 1
fi

if ! sudo systemctl is-active --quiet "$WEB_SERVICE"; then
  echo "ERROR: $WEB_SERVICE is not active"
  exit 1
fi

log "Staging deploy complete — API :$API_PORT, web :$WEB_PORT (public nginx :8080)"
