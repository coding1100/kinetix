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

log "Stop postgres explicitly first (avoids an in-place recreate racing the port bind)"
# `compose up -d postgres` alone does stop-old -> remove-old -> create-new ->
# start-new -> bind-port as one implicit step; if the old container's
# teardown (or the kernel releasing the socket) hasn't fully finished when
# the new container tries to bind, the bind loses the race with a generic
# "address already in use" Docker error that's indistinguishable from a
# truly foreign process. Stopping/removing up front and then waiting for the
# port to actually clear removes that race instead of guessing after the fact.
compose stop postgres 2>/dev/null || true
compose rm -f postgres 2>/dev/null || true

if command -v ss >/dev/null 2>&1; then
  for i in $(seq 1 15); do
    if ! ss -ltnH "sport = :5432" 2>/dev/null | grep -q .; then
      break
    fi
    if [ "$i" -eq 15 ]; then
      conflicting_container="$(docker ps --filter "publish=5432" --format '{{.ID}} {{.Names}}' || true)"
      if [ -n "$conflicting_container" ]; then
        log "Port 5432 still held by another Docker container after waiting — removing it: $conflicting_container"
        echo "$conflicting_container" | awk '{print $1}' | xargs -r docker rm -f
      else
        echo "ERROR: port 5432 is still in use by a non-Docker process (e.g. a native postgres service) after waiting 30s."
        echo "Refusing to guess — inspect and stop it manually, then re-run deploy:"
        sudo ss -ltnp "sport = :5432" 2>/dev/null || true
        exit 1
      fi
    fi
    sleep 2
  done
else
  # No ss available to confirm the port actually cleared - give the old
  # container's teardown a moment before attempting the bind anyway.
  sleep 3
fi

log "Start postgres"
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

# Rollback safety net: if a freshly built service fails its health check,
# the platform must not go down — restore the last-known-good image for
# that service and restart from it, rather than leaving a broken/crashing
# container as the only thing running in production.
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
    compose up -d --no-build "$service"
  else
    echo "==> No previous image available to roll back $service to"
  fi
}

log "Snapshot current images for rollback"
snapshot_image kinetix-api
snapshot_image kinetix-web

log "Build and start api"
compose up -d --build api
api_healthy=false
for i in $(seq 1 45); do
  api_id="$(compose ps -q api 2>/dev/null || true)"
  if [ -n "$api_id" ] && docker exec "$api_id" python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:4000/health')" >/dev/null 2>&1; then
    log "api healthy"
    api_healthy=true
    break
  fi
  sleep 2
done
if [ "$api_healthy" != true ]; then
  echo "ERROR: api not healthy after deploy"
  compose logs api --tail 80
  rollback_service api kinetix-api
  echo "ERROR: deploy failed, rolled back api to previous version. Not proceeding with web deploy."
  exit 1
fi

log "Build and start web"
compose up -d --build web

log "Wait for containers"
sleep 8
compose ps

web_ok=true
if ! container_running web; then
  echo "ERROR: web container is not running"
  compose logs web --tail 80 2>/dev/null || true
  web_ok=false
fi
if ! container_running api; then
  echo "ERROR: api container is not running"
  compose logs api --tail 80 2>/dev/null || true
  web_ok=false
fi

if [ "$web_ok" != true ]; then
  # Roll back both api and web together so production never ends up running
  # a new/old version mismatch across the two - always a known-good pair.
  rollback_service web kinetix-web
  rollback_service api kinetix-api
  echo "ERROR: deploy failed, rolled back api and web to previous versions."
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
  rollback_service web kinetix-web
  rollback_service api kinetix-api
  echo "ERROR: deploy failed, rolled back api and web to previous versions."
  exit 1
fi

log "Deploy complete — API and web are healthy (Docker)"
