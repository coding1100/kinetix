#!/usr/bin/env bash
# Production deploy for EC2 — run manually or via GitHub Actions.
#
# api/web/admin run as Docker containers (postgres/api/web/admin, built from
# docker-compose.yml + docker-compose.app.yml). nginx runs on the host (apt),
# not as a container — see deploy/nginx/host.conf and
# deploy/NGINX_HOST_MIGRATION.md. Host nginx proxies `location /` to
# 127.0.0.1:3000 and `location /api/` to 127.0.0.1:4000.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_ROOT="${APP_ROOT:-$ROOT}"
COMPOSE_FILES="-f $APP_ROOT/docker-compose.yml -f $APP_ROOT/docker-compose.app.yml"

log() { echo "==> $*"; }

compose() {
  docker compose $COMPOSE_FILES "$@"
}

container_running() {
  local id
  id="$(compose ps -q "$1" 2>/dev/null || true)"
  [ -n "$id" ] && [ "$(docker inspect -f '{{.State.Running}}' "$id" 2>/dev/null)" = "true" ]
}

log "App root: $APP_ROOT"
cd "$APP_ROOT"

log "Pull latest code"
git fetch origin main
git reset --hard origin/main

log "Disable legacy systemd services (superseded by Docker - avoids two prod builds silently coexisting)"
sudo systemctl stop kinetix-api kinetix-web 2>/dev/null || true
sudo systemctl disable kinetix-api kinetix-web 2>/dev/null || true

if [ -f "$APP_ROOT/docker-compose.env" ]; then
  cp "$APP_ROOT/docker-compose.env" "$APP_ROOT/.env"
  log "Synced docker-compose.env -> .env for compose variable substitution"
fi

log "Start postgres first"
compose up -d postgres
for i in $(seq 1 30); do
  if compose ps postgres 2>/dev/null | grep -q "(healthy)"; then
    log "postgres healthy"
    break
  fi
  if [ "$i" -eq 30 ]; then
    echo "ERROR: postgres not healthy"
    compose logs postgres --tail 50
    exit 1
  fi
  sleep 2
done

log "Build and start api"
compose up -d --build api
for i in $(seq 1 45); do
  api_id="$(compose ps -q api 2>/dev/null || true)"
  if [ -n "$api_id" ] && docker exec "$api_id" python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:4000/health')" >/dev/null 2>&1; then
    log "api healthy"
    break
  fi
  if [ "$i" -eq 45 ]; then
    echo "ERROR: api not healthy"
    compose logs api --tail 80
    exit 1
  fi
  sleep 2
done

log "Build and start web"
compose up -d --build web

log "Wait for containers"
sleep 8
compose ps

if ! container_running web; then
  echo "ERROR: web container is not running"
  compose logs web --tail 80 2>/dev/null || true
  exit 1
fi
if ! container_running api; then
  echo "ERROR: api container is not running"
  compose logs api --tail 80 2>/dev/null || true
  exit 1
fi

log "Reload host nginx (picks up any container restarts behind it)"
sudo nginx -t
sudo systemctl reload nginx

log "Health check via nginx"
if ! curl -fsS http://127.0.0.1/auth/login >/dev/null 2>&1; then
  echo "ERROR: prod site not responding via nginx"
  sudo journalctl -u nginx --no-pager --lines 30 2>/dev/null || true
  compose logs web --tail 40
  exit 1
fi

log "Deploy complete — API and web are healthy (Docker)"
