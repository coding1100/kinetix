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

# compose_up_retry <service> [extra compose up args...]
#
# Recreating a container that publishes a host port is inherently racy on
# this host: compose does stop-old -> REMOVE-old -> create-new -> start-new
# -> bind-port, and Docker's teardown of the old container's docker-proxy
# (which owns the host socket) is asynchronous. If the new container's bind
# lands before that teardown completes, Docker returns a generic
# "address already in use" and the deploy dies - even though nothing
# foreign holds the port and it frees itself moments later (confirmed in
# production: a failed attempt succeeded on the very next retry).
#
# This is a property of publishing host ports, not of any one service, so
# every port-publishing `up` goes through here rather than being special
# cased. Retries are bounded and only ever re-run the same idempotent
# `compose up`; nothing is force-removed and no volume is touched.
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

log "Disable legacy systemd services (superseded by Docker - avoids two prod builds silently coexisting)"
sudo systemctl stop kinetix-api kinetix-web 2>/dev/null || true
sudo systemctl disable kinetix-api kinetix-web 2>/dev/null || true

if [ -f "$APP_ROOT/docker-compose.env" ]; then
  cp "$APP_ROOT/docker-compose.env" "$APP_ROOT/.env"
  log "Synced docker-compose.env -> .env for compose variable substitution"
fi

# postgres is stateful and long-lived: it is NEVER stopped, removed, or
# recreated by a deploy. Only `up -d` it (a no-op when it's already running
# with matching config), so the published 5432 socket is never torn down and
# re-bound. Every "address already in use" failure this script has hit came
# from churning this container - either by removing it up front, or by
# letting a dependent service's `up` recreate it as a side effect (see
# --no-deps below). Data lives in the named riseup_pg_data volume; nothing
# here touches it.
log "Ensure postgres is up (never recreated - it holds the published 5432 socket)"
compose_up_retry postgres --no-recreate || exit 1

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

# --no-recreate above means a genuine postgres config change in the compose
# files is intentionally NOT auto-applied (recreating the container that owns
# the published 5432 socket is what kept breaking deploys). Surface the drift
# loudly instead of silently ignoring it - applying it is a deliberate,
# supervised action, not something a deploy should do on its own.
drift_check="$(compose up -d --no-recreate --dry-run postgres 2>&1 || true)"
if echo "$drift_check" | grep -qi 'recreate'; then
  log "NOTE: postgres config in the compose files differs from the running container."
  log "      It was NOT applied automatically. To apply during a maintenance window:"
  log "        docker compose $COMPOSE_FILES up -d --force-recreate postgres"
  log "      (safe for data - riseup_pg_data is a named volume and is not removed)"
fi

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
    # Same port-release race applies here - a rollback that loses it would
    # leave production down, which is the exact thing rollback exists to
    # prevent, so it gets the same bounded retry.
    compose_up_retry "$service" --no-build --no-deps --force-recreate
  else
    echo "==> No previous image available to roll back $service to"
  fi
}

log "Snapshot current images for rollback"
snapshot_image kinetix-api
snapshot_image kinetix-web

log "Build and start api"
# --no-deps is load-bearing: without it, `up api` walks api's depends_on
# graph and will happily recreate the healthy postgres container (observed
# in production - it tore down postgres mid-deploy and then failed to
# re-bind 127.0.0.1:5432). postgres is already confirmed healthy above.
if ! compose_up_retry api --build --no-deps; then
  echo "ERROR: api container could not be started"
  rollback_service api kinetix-api
  echo "ERROR: deploy failed, rolled back api to previous version."
  exit 1
fi
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
if ! compose_up_retry web --build --no-deps; then
  echo "ERROR: web container could not be started"
  rollback_service web kinetix-web
  rollback_service api kinetix-api
  echo "ERROR: deploy failed, rolled back api and web to previous versions."
  exit 1
fi

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
