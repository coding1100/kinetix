#!/usr/bin/env bash
set -eu

PROD_ROOT=/opt/clickup/kinetix
STAGING_ROOT=/opt/clickup/kinetix-staging
PUBLIC_HOST=3.140.5.67

log() { echo "==> $*"; }

log "Login test (direct API)"
printf '%s' '{"email":"owner@demo.com","password":"password123"}' > /tmp/login.json
docker exec kinetix-api-1 curl -s -w "\nHTTP=%{http_code}\n" \
  -X POST http://127.0.0.1:4000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  --data-binary @/tmp/login.json || true

log "Login test (via nginx)"
curl -s -w "\nHTTP=%{http_code}\n" \
  -X POST "http://127.0.0.1/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  --data-binary @/tmp/login.json || true

log "Pull latest production (main)"
cd "$PROD_ROOT"
git fetch origin main
git reset --hard origin/main

log "Pull latest staging (develop)"
cd "$STAGING_ROOT"
git fetch origin develop
git reset --hard origin/develop

log "Rebuild and restart production Docker stack"
cd "$PROD_ROOT"
docker compose --env-file docker-compose.env -f docker-compose.yml -f docker-compose.app.yml build api web
docker compose --env-file docker-compose.env -f docker-compose.yml -f docker-compose.app.yml up -d --remove-orphans

log "Wait for API health"
for i in $(seq 1 30); do
  if curl -fsS "http://127.0.0.1/health" | grep -q '"database":"connected"'; then
    log "Database connected"
    break
  fi
  sleep 3
done

curl -s "http://127.0.0.1/health" | head -c 400
echo

log "Login after restart"
curl -s -w "\nHTTP=%{http_code}\n" \
  -X POST "http://127.0.0.1/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  --data-binary @/tmp/login.json

log "Redeploy staging"
cd "$STAGING_ROOT"
export STAGING_PUBLIC_URL="http://${PUBLIC_HOST}/staging"
export STAGING_FRONTEND_ORIGIN="http://${PUBLIC_HOST}"
export PROD_ROOT
chmod +x deploy/deploy-staging.sh deploy/reset-staging-docker.sh 2>/dev/null || true
./deploy/deploy-staging.sh || true

log "Final status"
docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'
curl -s -o /dev/null -w "prod_login=%{http_code}\n" \
  -X POST "http://127.0.0.1/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  --data-binary @/tmp/login.json

log "Done: http://${PUBLIC_HOST}/auth/login"
