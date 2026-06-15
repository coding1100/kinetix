#!/usr/bin/env bash
# Restore production Docker + staging on EC2. Run on the server as ubuntu:
#   chmod +x deploy/ec2-restore.sh && ./deploy/ec2-restore.sh
set -euo pipefail

PROD_ROOT="${PROD_ROOT:-/opt/clickup/kinetix}"
STAGING_ROOT="${STAGING_ROOT:-/opt/clickup/kinetix-staging}"
PUBLIC_HOST="${PUBLIC_HOST:-3.140.5.67}"
STAGING_URL="http://${PUBLIC_HOST}/staging"

log() { echo "==> $*"; }

log "1) Start production Docker stack ($PROD_ROOT)"
cd "$PROD_ROOT"
if [ -f docker-compose.app.yml ]; then
  docker compose -f docker-compose.yml -f docker-compose.app.yml up -d
elif [ -f docker-compose.yml ]; then
  docker compose up -d
fi
docker start kinetix-postgres-1 kinetix-api-1 kinetix-web-1 kinetix-nginx-1 2>/dev/null || true
sleep 3
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

log "2) Deploy staging ($STAGING_ROOT) — also reloads Docker nginx with correct host IP"
cd "$STAGING_ROOT"
export STAGING_PUBLIC_URL="$STAGING_URL"
export PROD_ROOT
chmod +x deploy/deploy-staging.sh deploy/setup-staging-services.sh deploy/diagnose-staging.sh 2>/dev/null || true
./deploy/deploy-staging.sh

log "3) Health checks"curl -fsS "http://127.0.0.1/health" >/dev/null && log "prod /health OK" || log "WARN prod /health failed"
curl -fsS -o /dev/null -w "prod_login=%{http_code}\n" "http://127.0.0.1/auth/login"
curl -fsS -o /dev/null -w "staging_login=%{http_code}\n" "http://127.0.0.1/staging/auth/login"

log "Done."
log "Production: http://${PUBLIC_HOST}/auth/login"
log "Staging:    ${STAGING_URL}/auth/login"
