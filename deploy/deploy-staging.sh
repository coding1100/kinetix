#!/usr/bin/env bash
# Staging deploy — Docker only. Public URL http://HOST/staging via prod nginx.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_ROOT="${APP_ROOT:-$ROOT}"
PROD_ROOT="${PROD_ROOT:-/opt/clickup/kinetix}"
DEPLOY_BRANCH="${DEPLOY_BRANCH:-develop}"
STAGING_BASE_PATH="${STAGING_BASE_PATH:-/staging}"
PUBLIC_HOST="${PUBLIC_HOST:-3.140.5.67}"
STAGING_PUBLIC_URL="${STAGING_PUBLIC_URL:-http://${PUBLIC_HOST}${STAGING_BASE_PATH}}"
STAGING_FRONTEND_ORIGIN="${STAGING_FRONTEND_ORIGIN:-http://${PUBLIC_HOST}}"
EDGE_NETWORK="${EDGE_NETWORK:-kinetix_edge}"
NGINX_CONTAINER="${NGINX_CONTAINER:-kinetix-nginx-1}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.staging.yml}"

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

disable_staging_systemd() {
  log "Disable legacy staging systemd units (if any)"
  sudo systemctl stop kinetix-staging-api kinetix-staging-web 2>/dev/null || true
  sudo systemctl disable kinetix-staging-api kinetix-staging-web 2>/dev/null || true
  for port in 3050 4050; do
    if ss -tlnp 2>/dev/null | grep -q ":${port} "; then
      log "Freeing legacy host port ${port}"
      fuser -k "${port}/tcp" 2>/dev/null || true
      sleep 1
    fi
  done
}

ensure_edge_network() {
  if ! docker network inspect "$EDGE_NETWORK" >/dev/null 2>&1; then
    log "Create Docker edge network: $EDGE_NETWORK"
    docker network create "$EDGE_NETWORK"
  fi
}

reload_prod_nginx() {
  local nginx_src="$ROOT/deploy/nginx/docker.conf"
  local nginx_dst="$PROD_ROOT/deploy/nginx/docker.conf"
  if [ ! -f "$nginx_src" ]; then
    echo "ERROR: missing $nginx_src"
    exit 1
  fi
  if ! docker ps --format '{{.Names}}' | grep -qx "$NGINX_CONTAINER"; then
    echo "ERROR: $NGINX_CONTAINER is not running — start production Docker first"
    exit 1
  fi
  mkdir -p "$(dirname "$nginx_dst")"
  cp "$nginx_src" "$nginx_dst"
  log "Reload production nginx ($NGINX_CONTAINER)"
  docker exec "$NGINX_CONTAINER" nginx -t
  docker exec "$NGINX_CONTAINER" nginx -s reload
}

log "Staging Docker deploy — branch=$DEPLOY_BRANCH app=$APP_ROOT public=$STAGING_PUBLIC_URL"
cd "$APP_ROOT"

log "Pull latest code ($DEPLOY_BRANCH)"
git fetch origin "$DEPLOY_BRANCH"
git reset --hard "origin/$DEPLOY_BRANCH"
log "Deployed commit: $(git rev-parse --short HEAD) — $(git log -1 --format='%s')"

disable_staging_systemd
ensure_edge_network

log "Ensure production stack + nginx edge network ($PROD_ROOT)"
cd "$PROD_ROOT"
docker compose -f docker-compose.yml -f docker-compose.app.yml up -d

log "Build and start staging Docker stack"
cd "$APP_ROOT"
export STAGING_PUBLIC_URL STAGING_FRONTEND_ORIGIN
chmod +x "$APP_ROOT/deploy/reset-staging-docker.sh"
"$APP_ROOT/deploy/reset-staging-docker.sh"

log "Start postgres first"
docker compose -f "$COMPOSE_FILE" up -d --build postgres
for i in $(seq 1 30); do
  if docker compose -f "$COMPOSE_FILE" ps postgres 2>/dev/null | grep -q "(healthy)"; then
    log "postgres healthy"
    break
  fi
  if [ "$i" -eq 30 ]; then
    echo "ERROR: postgres not healthy"
    docker compose -f "$COMPOSE_FILE" logs postgres --tail 50
    exit 1
  fi
  sleep 2
done

log "Start api"
docker compose -f "$COMPOSE_FILE" up -d --build api
for i in $(seq 1 45); do
  api_id=$(docker compose -f "$COMPOSE_FILE" ps -q api 2>/dev/null || true)
  if [ -n "$api_id" ] && docker exec "$api_id" python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:4000/health')" >/dev/null 2>&1; then
    log "api healthy"
    break
  fi
  if [ "$i" -eq 45 ]; then
    echo "ERROR: api not healthy"
    docker compose -f "$COMPOSE_FILE" logs api --tail 80
    exit 1
  fi
  sleep 2
done

log "Start web"
docker compose -f "$COMPOSE_FILE" up -d --build web

log "Wait for staging containers"
sleep 8
docker compose -f "$COMPOSE_FILE" ps

if ! docker compose -f "$COMPOSE_FILE" ps --status running 2>/dev/null | grep -q "api"; then
  echo "ERROR: staging api is not running"
  docker compose -f "$COMPOSE_FILE" logs api --tail 80 2>/dev/null || true
  exit 1
fi

api_id=$(docker compose -f "$COMPOSE_FILE" ps -q api)
if ! docker exec "$api_id" python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:4000/health')" >/dev/null 2>&1; then
  echo "ERROR: staging API health check failed — logs:"
  docker compose -f "$COMPOSE_FILE" logs api --tail 80
  exit 1
fi

reload_prod_nginx

STAGING_LOGIN_PATH="${STAGING_BASE_PATH}/auth/login"
if ! wait_for_http "http://127.0.0.1${STAGING_LOGIN_PATH}" "Staging via nginx"; then
  docker logs "$NGINX_CONTAINER" --tail 30
  docker logs kinetix-staging-web --tail 30
  echo "TIP: run deploy/diagnose-staging.sh"
  exit 1
fi

log "Staging deploy complete — ${STAGING_PUBLIC_URL}/auth/login"
