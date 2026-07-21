#!/usr/bin/env bash
# Hard-reset staging Docker state (fixes "No such container" compose errors).
set -euo pipefail

APP_ROOT="${APP_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.staging.yml}"

log() { echo "==> $*"; }

cd "$APP_ROOT"

log "Stop staging compose project"
docker compose -f "$COMPOSE_FILE" down --remove-orphans 2>/dev/null || true

log "Remove fixed-name staging containers (if any remain)"
docker rm -f \
  kinetix-staging-postgres \
  kinetix-staging-api \
  kinetix-staging-web \
  2>/dev/null || true

log "Remove orphaned staging containers"
docker ps -a --format '{{.ID}} {{.Names}}' \
  | awk '/kinetix-staging/ {print $1}' \
  | xargs -r docker rm -f 2>/dev/null || true

log "Remove stale staging project network"
docker network rm kinetix-staging_internal 2>/dev/null || true

log "Staging Docker state cleared"
docker ps -a --format 'table {{.Names}}\t{{.Status}}' | grep -E 'staging|NAMES' || echo "(no staging containers)"
