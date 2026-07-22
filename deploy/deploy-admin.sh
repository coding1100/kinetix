#!/usr/bin/env bash
# Production admin-portal deploy for EC2 — separate from deploy.sh so a
# broken admin build/deploy can neither block nor be blocked by the main
# app deploy. Only touches the `admin` container; api/web/postgres are
# deploy.sh's job.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_ROOT="${APP_ROOT:-$ROOT}"
COMPOSE_FILES="-f $APP_ROOT/docker-compose.yml -f $APP_ROOT/docker-compose.app.yml"
NGINX_CONTAINER="${NGINX_CONTAINER:-kinetix-nginx-1}"

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

if [ -f "$APP_ROOT/docker-compose.env" ]; then
  cp "$APP_ROOT/docker-compose.env" "$APP_ROOT/.env"
  log "Synced docker-compose.env -> .env for compose variable substitution"
fi

log "Build and start admin"
compose up -d --build admin

if ! container_running admin; then
  echo "ERROR: admin container is not running"
  compose logs admin --tail 80 2>/dev/null || true
  exit 1
fi

# nginx bind-mounts deploy/nginx/docker.conf read-only - `compose up -d nginx`
# alone won't pick up a changed file in an already-running container, and the
# /admin-portal/ location block is new on this container's first deploy.
if docker ps --format '{{.Names}}' | grep -qx "$NGINX_CONTAINER"; then
  log "Reload nginx (picks up /admin-portal/ route)"
  docker exec "$NGINX_CONTAINER" nginx -t
  docker exec "$NGINX_CONTAINER" nginx -s reload
fi

log "Health check via nginx"
if ! curl -fsS http://127.0.0.1/admin-portal/login >/dev/null 2>&1; then
  echo "ERROR: admin portal not responding via nginx"
  docker logs "$NGINX_CONTAINER" --tail 30 2>/dev/null || true
  compose logs admin --tail 40
  exit 1
fi

log "Deploy complete — admin portal is healthy"
