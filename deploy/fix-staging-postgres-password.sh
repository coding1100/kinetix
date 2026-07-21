#!/usr/bin/env bash
# Align staging Postgres password with docker-compose.env (keeps existing data).
set -euo pipefail

APP_ROOT="${APP_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.staging.yml}"
ENV_FILE="${APP_ROOT}/docker-compose.env"

log() { echo "==> $*"; }

cd "$APP_ROOT"

if [ ! -f "$ENV_FILE" ]; then
  echo "ERROR: missing $ENV_FILE"
  exit 1
fi

# shellcheck disable=SC1090
set -a
source "$ENV_FILE"
set +a

POSTGRES_USER="${POSTGRES_USER:-riseup}"
POSTGRES_DB="${POSTGRES_DB:-riseup}"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-}"

if [ -z "$POSTGRES_PASSWORD" ]; then
  echo "ERROR: POSTGRES_PASSWORD is empty in docker-compose.env"
  exit 1
fi

log "Postgres user=$POSTGRES_USER db=$POSTGRES_DB"

if ! docker compose -f "$COMPOSE_FILE" ps postgres 2>/dev/null | grep -q "Up"; then
  log "Start postgres"
  docker compose -f "$COMPOSE_FILE" up -d postgres
  sleep 5
fi

log "Set database password to match docker-compose.env"
docker compose -f "$COMPOSE_FILE" exec -T postgres \
  psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
  -c "ALTER USER ${POSTGRES_USER} WITH PASSWORD '${POSTGRES_PASSWORD}';"

log "Recreate api container with updated DATABASE_URL"
docker compose -f "$COMPOSE_FILE" up -d --force-recreate api
sleep 12

if docker compose -f "$COMPOSE_FILE" logs api --tail 20 | grep -q "database connection ok"; then
  log "API database connection ok"
else
  echo "ERROR: API still cannot connect — logs:"
  docker compose -f "$COMPOSE_FILE" logs api --tail 30
  exit 1
fi

if docker network inspect kinetix_edge >/dev/null 2>&1; then
  docker network connect kinetix_edge "$(docker compose -f "$COMPOSE_FILE" ps -q api)" 2>/dev/null || true
fi

log "Done. Check: docker compose -f $COMPOSE_FILE ps"
