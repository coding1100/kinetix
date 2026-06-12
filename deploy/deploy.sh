#!/usr/bin/env bash
# Production deploy for EC2 — run manually or via GitHub Actions.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_ROOT="${APP_ROOT:-$ROOT}"
FRONTEND="$APP_ROOT/frontend"
BACKEND="$APP_ROOT/backend-py"
DEPLOY_USER="${DEPLOY_USER:-ubuntu}"
# docker = full stack in containers (recommended). systemd = legacy host build + systemd.
DEPLOY_MODE="${DEPLOY_MODE:-docker}"

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

compose_env_file() {
  if [ ! -f "$APP_ROOT/docker-compose.env" ]; then
    echo "ERROR: missing $APP_ROOT/docker-compose.env (copy from docker-compose.env.example)"
    exit 1
  fi
}

compose_postgres() {
  compose_env_file
  sudo systemctl enable kinetix-postgres 2>/dev/null || true
  sudo systemctl start kinetix-postgres 2>/dev/null || true
  # shellcheck disable=SC1091
  set -a
  source "$APP_ROOT/docker-compose.env"
  set +a
  POSTGRES_USER="${POSTGRES_USER:-riseup}"
  POSTGRES_DB="${POSTGRES_DB:-riseup}"
  cd "$APP_ROOT"
  local compose_files="-f docker-compose.yml"
  if [ -f "$APP_ROOT/docker-compose.prod.yml" ]; then
    compose_files="$compose_files -f docker-compose.prod.yml"
  fi
  if ! docker compose --env-file docker-compose.env $compose_files up -d postgres; then
    echo "ERROR: failed to start Postgres container"
    exit 1
  fi
  local pg_attempts=30
  local pg_i=1
  while [ "$pg_i" -le "$pg_attempts" ]; do
    if docker compose --env-file docker-compose.env $compose_files exec -T postgres \
      pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB" >/dev/null 2>&1; then
      log "Postgres ready"
      return 0
    fi
    sleep 2
    pg_i=$((pg_i + 1))
  done
  echo "ERROR: Postgres not ready after $((pg_attempts * 2))s"
  docker compose --env-file docker-compose.env $compose_files logs postgres --tail 40 || true
  exit 1
}

ensure_swap_hint() {
  if ! swapon --show 2>/dev/null | grep -q .; then
    log "WARNING: no swap — Docker/Next.js builds may OOM on small instances."
    log "One-time fix: sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile"
  fi
}

deploy_docker_stack() {
  if [ ! -f "$APP_ROOT/docker-compose.app.yml" ]; then
    echo "ERROR: docker-compose.app.yml missing; set DEPLOY_MODE=systemd or add the file"
    exit 1
  fi

  log "Deploy mode: Docker (postgres + api + web + nginx)"
  ensure_swap_hint

  sudo systemctl stop kinetix-api kinetix-web 2>/dev/null || true
  sudo systemctl disable kinetix-api kinetix-web 2>/dev/null || true
  sudo systemctl stop nginx 2>/dev/null || true

  compose_env_file
  # shellcheck disable=SC1091
  set -a
  source "$APP_ROOT/docker-compose.env"
  set +a
  if [ -z "${POSTGRES_PASSWORD:-}" ]; then
    echo "ERROR: POSTGRES_PASSWORD is empty in docker-compose.env"
    exit 1
  fi
  export API_PUBLIC_URL="${API_PUBLIC_URL:-${PUBLIC_APP_URL:-http://localhost}}"
  export FRONTEND_URL="${FRONTEND_URL:-${PUBLIC_APP_URL:-http://localhost}}"

  compose_postgres

  cd "$APP_ROOT"
  export DOCKER_BUILDKIT=1
  export COMPOSE_DOCKER_CLI_BUILD=1

  log "Build and start containers (sequential builds — lower peak memory)"
  docker compose --env-file docker-compose.env \
    -f docker-compose.yml -f docker-compose.app.yml \
    build api
  docker compose --env-file docker-compose.env \
    -f docker-compose.yml -f docker-compose.app.yml \
    build web
  docker compose --env-file docker-compose.env \
    -f docker-compose.yml -f docker-compose.app.yml \
    up -d --remove-orphans

  log "Health checks"
  if ! wait_for_http "http://127.0.0.1/health" "API (via nginx)" 60; then
    docker compose --env-file docker-compose.env \
      -f docker-compose.yml -f docker-compose.app.yml logs --tail 60 api web nginx
    exit 1
  fi

  HEALTH_JSON=$(curl -fsS http://127.0.0.1/health)
  echo "$HEALTH_JSON"
  if ! echo "$HEALTH_JSON" | grep -qE '"database"[[:space:]]*:[[:space:]]*"connected"'; then
    echo "ERROR: database not connected"
    docker compose --env-file docker-compose.env \
      -f docker-compose.yml -f docker-compose.app.yml \
      exec -T api printenv DATABASE_URL 2>/dev/null | sed 's/:\/\/[^:]*:[^@]*@/:\/\/USER:***@/' || true
    docker compose --env-file docker-compose.env \
      -f docker-compose.yml -f docker-compose.app.yml logs --tail 40 api
    exit 1
  fi

  log "Deploy complete — Docker stack healthy"
}

deploy_systemd_stack() {
  log "Deploy mode: systemd (host npm build + kinetix-api/web)"
  ensure_swap_hint

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

  compose_postgres

  log "Backend dependencies"
  cd "$BACKEND"
  export PATH="$HOME/.local/bin:$PATH"
  if ! command -v uv >/dev/null 2>&1; then
    curl -LsSf https://astral.sh/uv/install.sh | sh
    export PATH="$HOME/.local/bin:$PATH"
  fi
  uv sync
  sudo chown -R "$DEPLOY_USER:$DEPLOY_USER" "$BACKEND"

  log "Frontend production build"
  run_as_user "$FRONTEND" 'rm -rf .next node_modules/.cache'
  run_as_user "$FRONTEND" 'npm ci'
  run_as_user "$FRONTEND" 'NODE_OPTIONS=--max-old-space-size=1536 NODE_ENV=production npm run build'

  if [ ! -d "$FRONTEND/.next/static/chunks" ]; then
    echo "ERROR: frontend build missing .next/static/chunks"
    exit 1
  fi

  log "Nginx config"
  if [ -f "$ROOT/kinetix-site.conf" ]; then
    sudo rm -f /etc/nginx/conf.d/kinetix.conf /etc/nginx/conf.d/kinetix-upstreams.conf
    sudo sed "s|/opt/clickup/kinetix|$APP_ROOT|g" "$ROOT/kinetix-site.conf" \
      | sudo tee /etc/nginx/sites-available/kinetix >/dev/null
    sudo ln -sf /etc/nginx/sites-available/kinetix /etc/nginx/sites-enabled/kinetix
    sudo rm -f /etc/nginx/sites-enabled/default
    sudo nginx -t
    sudo systemctl enable nginx
    sudo systemctl start nginx
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

  log "Deploy complete — API and web are healthy (systemd mode)"
}

log "App root: $APP_ROOT"
log "Fix ownership ($DEPLOY_USER — avoids EACCES after sudo deploys)"
sudo chown -R "$DEPLOY_USER:$DEPLOY_USER" "$FRONTEND" "$BACKEND" 2>/dev/null || true
cd "$APP_ROOT"

log "Pull latest code"
git fetch origin main
git reset --hard origin/main

if [ "$DEPLOY_MODE" = "docker" ]; then
  deploy_docker_stack
else
  deploy_systemd_stack
fi
