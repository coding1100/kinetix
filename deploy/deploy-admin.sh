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

# clear_stale_container <service>
#
# A container that fails to start remains in `Created` state and keeps its
# host port reservation in Docker's internal allocator, even though no
# docker-proxy is listening. The next `up` then fails with "address already
# in use" against a port nothing is bound to. Observed in production with
# kinetix-admin-1 stuck in `Created` across runs. Waiting/retrying cannot
# clear it - only removing the stale container does.
#
# Safe: a `Created`/`Exited` container never ran and holds no state. No -v
# anywhere, so named volumes are never removed. Running containers are left
# alone. Mirrors the helper in deploy.sh.
clear_stale_container() {
  local service="$1"
  local cid state mounts

  # Guard 1 (by name): never a candidate for removal, in any state.
  case "$service" in
    *postgres*|*db*|*database*)
      return 0
      ;;
  esac

  cid="$(compose ps -aq "$service" 2>/dev/null | head -n1 || true)"
  [ -n "$cid" ] || return 0

  # Guard 2 (by state): running containers are left strictly alone.
  state="$(docker inspect -f '{{.State.Status}}' "$cid" 2>/dev/null || true)"
  case "$state" in
    created|exited|dead) ;;
    *) return 0 ;;
  esac

  # Guard 3 (by mount): anything carrying a named volume is left alone.
  mounts="$(docker inspect -f '{{range .Mounts}}{{.Name}} {{end}}' "$cid" 2>/dev/null || true)"
  if [ -n "$(echo "$mounts" | tr -d '[:space:]')" ]; then
    log "Leaving $service container ($cid, $state) alone - it has named volumes attached: $mounts"
    return 0
  fi

  log "Removing stale '$state' $service container ($cid) holding a port reservation"
  # NOTE: deliberately NO -v.
  docker rm "$cid" >/dev/null 2>&1 || true
}

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
