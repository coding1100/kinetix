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

# Publish every container port on loopback only - host nginx proxies to them.
# Note the trailing colon: it is part of the "IP:PORT:PORT" form, and this is
# substituted into the base compose file's ports entries. See the ports
# comment in docker-compose.yml for why this is a variable rather than a
# second `ports:` entry in the prod override.
export BIND_ADDR="127.0.0.1:"

log() { echo "==> $*"; }

compose() {
  docker compose $COMPOSE_FILES "$@"
}

container_running() {
  local id
  id="$(compose ps -q "$1" 2>/dev/null || true)"
  [ -n "$id" ] && [ "$(docker inspect -f '{{.State.Running}}' "$id" 2>/dev/null)" = "true" ]
}

# clear_stale_container <service>
#
# THE actual cause of the repeated "failed to bind host port ... address
# already in use" deploys. Production diagnostics showed `ss -ltnp` with NO
# listener on 4000 at all, while `docker ps -a` showed kinetix-api-1 (and
# kinetix-admin-1 from an earlier failed run) sitting in state `Created`.
#
# A container that fails to start still exists in `Created` state, and it
# has ALREADY reserved its host port mapping in Docker's internal port
# allocator - even though no docker-proxy was ever spawned and nothing is
# actually listening. The next `up` creates another container, and the
# allocator refuses the reservation because the stale `Created` container
# still holds it. Waiting cannot help (nothing is releasing), and retrying
# makes it strictly worse by stacking up more stale reservations - which is
# exactly what the previous retry-with-backoff attempt did.
#
# Removing a `Created`/`Exited` container is safe: it never ran, so it holds
# no application state. Volumes are separate objects and are never removed
# here (no -v anywhere) - postgres data lives in the named riseup_pg_data
# volume and is untouched. A RUNNING container is deliberately left alone.
clear_stale_container() {
  local service="$1"
  local cid state mounts

  # Guard 1 (by name): postgres is never a candidate for removal, in any
  # state, full stop. It is the only stateful service here and it is not
  # what gets stuck - api/admin are. Refusing by name means no future edit
  # to the state logic below can ever put the database at risk.
  case "$service" in
    *postgres*|*db*|*database*)
      return 0
      ;;
  esac

  cid="$(compose ps -aq "$service" 2>/dev/null | head -n1 || true)"
  [ -n "$cid" ] || return 0

  # Guard 2 (by state): only containers that never ran (or already stopped)
  # are removable. A running container is left strictly alone.
  state="$(docker inspect -f '{{.State.Status}}' "$cid" 2>/dev/null || true)"
  case "$state" in
    created|exited|dead) ;;
    *) return 0 ;;
  esac

  # Guard 3 (by mount): if the container has any named volume attached, do
  # not touch it - that is the signature of a stateful service. `docker rm`
  # without -v would not delete the volume anyway, but this makes it
  # impossible to remove a data-carrying container by accident.
  mounts="$(docker inspect -f '{{range .Mounts}}{{.Name}} {{end}}' "$cid" 2>/dev/null || true)"
  if [ -n "$(echo "$mounts" | tr -d '[:space:]')" ]; then
    log "Leaving $service container ($cid, $state) alone - it has named volumes attached: $mounts"
    return 0
  fi

  log "Removing stale '$state' $service container ($cid) holding a port reservation"
  # NOTE: deliberately NO -v. Named volumes are separate objects and are
  # never removed by this script.
  docker rm "$cid" >/dev/null 2>&1 || true
}

# compose_up_retry <service> [extra compose up args...]
#
# Clears any stale port reservation first (see above), then brings the
# service up. The bounded retry is kept only as a guard against genuinely
# transient daemon hiccups, and re-clears the stale container each pass so
# a failed attempt cannot poison the next one.
compose_up_retry() {
  local service="$1"
  shift
  local attempt
  for attempt in 1 2 3; do
    clear_stale_container "$service"
    if compose up -d "$@" "$service"; then
      return 0
    fi
    if [ "$attempt" -lt 3 ]; then
      log "$service failed to start (attempt $attempt/3), clearing stale container and retrying"
      sleep 3
    fi
  done

  echo "ERROR: $service failed to start after 3 attempts"
  echo "Diagnostics - listening sockets and all containers:"
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
