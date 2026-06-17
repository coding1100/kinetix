#!/usr/bin/env bash
# Restore production Docker + staging Docker on EC2.
set -euo pipefail

PROD_ROOT="${PROD_ROOT:-/opt/clickup/kinetix}"
STAGING_ROOT="${STAGING_ROOT:-/opt/clickup/kinetix-staging}"
PUBLIC_HOST="${PUBLIC_HOST:-3.140.5.67}"
STAGING_URL="http://${PUBLIC_HOST}/staging"

log() { echo "==> $*"; }

log "1) Production Docker stack ($PROD_ROOT)"
cd "$PROD_ROOT"
docker network create kinetix_edge 2>/dev/null || true
docker compose -f docker-compose.yml -f docker-compose.app.yml up -d
sleep 3
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

log "2) Staging Docker deploy ($STAGING_ROOT)"
cd "$STAGING_ROOT"
export STAGING_PUBLIC_URL="$STAGING_URL"
export STAGING_FRONTEND_ORIGIN="http://${PUBLIC_HOST}"
export PROD_ROOT
chmod +x deploy/deploy-staging.sh deploy/diagnose-staging.sh 2>/dev/null || true
./deploy/deploy-staging.sh

log "3) Health checks"
curl -fsS "http://127.0.0.1/health" >/dev/null && log "prod /health OK" || log "WARN prod /health failed"
curl -fsS -o /dev/null -w "prod_login=%{http_code}\n" "http://127.0.0.1/auth/login"
curl -fsS -o /dev/null -w "staging_login=%{http_code}\n" "http://127.0.0.1/staging/auth/login"

log "Done."
log "Production: http://${PUBLIC_HOST}/auth/login"
log "Staging:    ${STAGING_URL}/auth/login"
