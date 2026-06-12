#!/usr/bin/env bash
# Daily Postgres backup — run via cron on EC2.
# Example: 0 3 * * * /opt/clickup/kinetix/deploy/backup-postgres.sh
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_ROOT="${APP_ROOT:-$ROOT}"
BACKEND="$APP_ROOT/backend-py"
COMPOSE="docker compose -f $APP_ROOT/docker-compose.yml -f $APP_ROOT/docker-compose.prod.yml"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/kinetix}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
STAMP="$(date +%Y-%m-%d_%H%M%S)"
DUMP_FILE="$BACKUP_DIR/kinetix-$STAMP.dump"

log() { echo "==> $*"; }

if [ -f "$APP_ROOT/docker-compose.env" ]; then
  # shellcheck disable=SC1091
  set -a
  source "$APP_ROOT/docker-compose.env"
  set +a
fi

POSTGRES_USER="${POSTGRES_USER:-riseup}"
POSTGRES_DB="${POSTGRES_DB:-riseup}"

mkdir -p "$BACKUP_DIR"

log "Ensure Postgres container is running"
cd "$APP_ROOT"
$COMPOSE up -d postgres

log "Dump database to $DUMP_FILE"
$COMPOSE exec -T postgres pg_dump -U "$POSTGRES_USER" -Fc "$POSTGRES_DB" >"$DUMP_FILE"

if [ ! -s "$DUMP_FILE" ]; then
  echo "ERROR: backup file is empty"
  exit 1
fi

log "Prune backups older than $RETENTION_DAYS days"
find "$BACKUP_DIR" -name 'kinetix-*.dump' -type f -mtime +"$RETENTION_DAYS" -delete

if [ -f "$BACKEND/.env" ]; then
  # shellcheck disable=SC1091
  set -a
  source "$BACKEND/.env"
  set +a
fi

S3_BUCKET="${S3_BACKUP_BUCKET:-${S3_ATTACHMENTS_BUCKET:-}}"
S3_PREFIX="${S3_BACKUP_PREFIX:-db-backups}"

if [ -n "$S3_BUCKET" ] && [ -n "${AWS_ACCESS_KEY_ID:-}" ] && [ -n "${AWS_SECRET_ACCESS_KEY:-}" ]; then
  REGION="${AWS_REGION:-us-east-1}"
  S3_URI="s3://$S3_BUCKET/$S3_PREFIX/kinetix-$STAMP.dump"
  log "Upload to $S3_URI"
  AWS_DEFAULT_REGION="$REGION" aws s3 cp "$DUMP_FILE" "$S3_URI"
else
  log "S3 upload skipped (set S3_BACKUP_BUCKET or S3_ATTACHMENTS_BUCKET + AWS creds in backend-py/.env)"
fi

log "Backup complete: $DUMP_FILE"
