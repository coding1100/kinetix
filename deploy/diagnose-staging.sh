#!/usr/bin/env bash
# Diagnose staging on EC2 (Docker-only).
set -euo pipefail

STAGING_ROOT="${STAGING_ROOT:-/opt/clickup/kinetix-staging}"
STAGING_BASE_PATH="${STAGING_BASE_PATH:-/staging}"
NGINX_CONTAINER="${NGINX_CONTAINER:-kinetix-nginx-1}"
EDGE_NETWORK="${EDGE_NETWORK:-kinetix_edge}"

echo "=== git (staging app) ==="
if [ -d "$STAGING_ROOT/.git" ]; then
  git -C "$STAGING_ROOT" log -1 --oneline 2>/dev/null || true
else
  echo "WARN: $STAGING_ROOT not a git repo"
fi

echo "=== legacy systemd (should be inactive) ==="
systemctl is-active kinetix-staging-api kinetix-staging-web 2>/dev/null || true

echo "=== staging docker containers ==="
docker compose -f "$STAGING_ROOT/docker-compose.staging.yml" ps 2>/dev/null || \
  docker ps --format "table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}" | grep -E "staging|NAMES" || true

echo "=== edge network ==="
docker network inspect "$EDGE_NETWORK" --format '{{range .Containers}}{{.Name}} {{end}}' 2>/dev/null || echo "WARN: $EDGE_NETWORK missing"

echo "=== staging health (inside containers) ==="
API_ID=$(docker compose -f "$STAGING_ROOT/docker-compose.staging.yml" ps -q api 2>/dev/null || true)
WEB_ID=$(docker compose -f "$STAGING_ROOT/docker-compose.staging.yml" ps -q web 2>/dev/null || true)
if [ -n "$API_ID" ]; then
  docker exec "$API_ID" python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:4000/health')" >/dev/null 2>&1 \
    && echo "staging_api=ok" || echo "staging_api=fail"
else
  echo "staging_api=missing"
fi
if [ -n "$WEB_ID" ]; then
  docker exec "$WEB_ID" node -e "require('http').get('http://127.0.0.1:3000/staging/auth/login', (r) => process.exit(r.statusCode >= 200 && r.statusCode < 500 ? 0 : 1)).on('error', () => process.exit(1));" >/dev/null 2>&1 \
    && echo "staging_web=ok" || echo "staging_web=fail"
else
  echo "staging_web=missing"
fi

echo "=== nginx routing ==="
curl -s -o /dev/null -w "nginx_staging=%{http_code}\n" "http://127.0.0.1${STAGING_BASE_PATH}/auth/login" || echo "nginx_staging=000"
curl -s -o /dev/null -w "prod_login=%{http_code}\n" "http://127.0.0.1/auth/login" || echo "prod_login=000"

if docker ps --format '{{.Names}}' | grep -qx "$NGINX_CONTAINER"; then
  echo "=== nginx can reach staging upstreams ==="
  docker exec "$NGINX_CONTAINER" wget -q -O- --timeout=3 http://kinetix-staging-api:4000/health >/dev/null 2>&1 \
    && echo "nginx->staging-api=ok" || echo "nginx->staging-api=fail"
  docker exec "$NGINX_CONTAINER" wget -q -O- --timeout=3 http://kinetix-staging-web:3000/staging/auth/login >/dev/null 2>&1 \
    && echo "nginx->staging-web=ok" || echo "nginx->staging-web=fail"
fi

echo "=== recent staging logs ==="
docker compose -f "$STAGING_ROOT/docker-compose.staging.yml" logs --tail 10 2>/dev/null || true
