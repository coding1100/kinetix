#!/usr/bin/env bash
# Production admin-portal deploy for EC2 — separate from deploy.sh so a
# broken admin build/deploy can neither block nor be blocked by the main
# app deploy. Only touches the `admin` container; api/web/postgres are
# deploy.sh's job.
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

# compose_up_retry <service> [extra compose up args...]
#
# Recreating a container that publishes a host port is racy: Docker's
# teardown of the old container's docker-proxy (which owns the host socket)
# is asynchronous, so a new container's bind can arrive first and fail with
# "address already in use" even though nothing foreign holds the port and it
# frees itself moments later. Bounded retry of the same idempotent
# `compose up`; nothing is force-removed and no volume is touched.
# Mirrors the helper in deploy.sh - admin publishes 3002 and is equally
# exposed to this.
compose_up_retry() {
  local service="$1"
  shift
  local attempt
  for attempt in 1 2 3 4 5; do
    if compose up -d "$@" "$service"; then
      return 0
    fi
    if [ "$attempt" -lt 5 ]; then
      log "$service failed to start (attempt $attempt/5) - host port likely still releasing, retrying in $((attempt * 3))s"
      sleep "$((attempt * 3))"
    fi
  done

  echo "ERROR: $service failed to start after 5 attempts"
  echo "Diagnostics - listening sockets and containers publishing ports:"
  (sudo ss -ltnp 2>/dev/null) || (sudo lsof -iTCP -sTCP:LISTEN -P -n 2>/dev/null) || echo "(no ss/lsof available)"
  docker ps -a --format '{{.ID}} {{.Names}} {{.Status}} {{.Ports}}' || true
  compose logs "$service" --tail 50 2>/dev/null || true
  return 1
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

# Rollback safety net: if the freshly built admin image fails to come up
# healthy, restore the last-known-good image rather than leaving the admin
# portal down or crash-looping in production.
snapshot_image() {
  local image="$1"
  if docker image inspect "$image" >/dev/null 2>&1; then
    docker tag "$image" "${image}-rollback"
  fi
}

rollback_service() {
  local service="$1" image="$2"
  if docker image inspect "${image}-rollback" >/dev/null 2>&1; then
    echo "==> Rolling back $service to last-known-good image"
    docker tag "${image}-rollback" "$image"
    compose_up_retry "$service" --no-build --no-deps --force-recreate
  else
    echo "==> No previous image available to roll back $service to"
  fi
}

log "Snapshot current admin image for rollback"
snapshot_image kinetix-admin

log "Build and start admin"
# --no-deps: never let an admin deploy recreate postgres/api as a side
# effect of walking admin's depends_on graph.
if ! compose_up_retry admin --build --no-deps; then
  echo "ERROR: admin container could not be started"
  rollback_service admin kinetix-admin
  echo "ERROR: deploy failed, rolled back admin to previous version."
  exit 1
fi

if ! container_running admin; then
  echo "ERROR: admin container is not running"
  compose logs admin --tail 80 2>/dev/null || true
  rollback_service admin kinetix-admin
  echo "ERROR: deploy failed, rolled back admin to previous version."
  exit 1
fi

# nginx runs on the host (apt), not as a container — reload picks up any
# /admin-portal/ route changes in deploy/nginx/host.conf.
if [ -f "$APP_ROOT/deploy/nginx/host.conf" ]; then
  sudo cp "$APP_ROOT/deploy/nginx/host.conf" /etc/nginx/sites-available/kinetix
  log "Reload host nginx (picks up /admin-portal/ route)"
  sudo nginx -t
  sudo systemctl reload nginx
fi

log "Health check via nginx"
if ! curl -fsS http://127.0.0.1/admin-portal/login >/dev/null 2>&1; then
  echo "ERROR: admin portal not responding via nginx"
  sudo journalctl -u nginx --no-pager --lines 30 2>/dev/null || true
  compose logs admin --tail 40
  rollback_service admin kinetix-admin
  echo "ERROR: deploy failed, rolled back admin to previous version."
  exit 1
fi

log "Deploy complete — admin portal is healthy"
