#!/usr/bin/env bash
# Diagnose staging 502 on EC2. Run: ./deploy/diagnose-staging.sh
set -euo pipefail

NGINX_CONTAINER="${NGINX_CONTAINER:-kinetix-nginx-1}"
WEB_PORT="${WEB_PORT:-3050}"
API_PORT="${API_PORT:-4050}"
STAGING_BASE_PATH="${STAGING_BASE_PATH:-/staging}"

echo "=== systemd ==="
systemctl is-active kinetix-staging-api kinetix-staging-web nginx 2>/dev/null || true

echo "=== git (staging app) ==="
STAGING_ROOT="${STAGING_ROOT:-/opt/clickup/kinetix-staging}"
if [ -d "$STAGING_ROOT/.git" ]; then
  git -C "$STAGING_ROOT" log -1 --oneline 2>/dev/null || true
else
  echo "WARN: $STAGING_ROOT not a git repo"
fi

echo "=== ports (systemd vs docker) ==="
ss -tlnp | grep -E ":3050|:4050|:80 " || true
docker ps --format "table {{.Names}}\t{{.Image}}\t{{.Ports}}" 2>/dev/null | grep -E "staging|3050|4050|NAMES" || true

echo "=== direct staging ==="
curl -s -o /dev/null -w "api_health=%{http_code}\n" "http://127.0.0.1:${API_PORT}/health" || echo "api_health=000"
curl -s -o /dev/null -w "web_login=%{http_code}\n" "http://127.0.0.1:${WEB_PORT}${STAGING_BASE_PATH}/auth/login" || echo "web_login=000"

echo "=== docker nginx ==="
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep -E "nginx|NAMES" || true

if docker ps --format '{{.Names}}' | grep -qx "$NGINX_CONTAINER"; then
  HOST_IP=$(docker exec "$NGINX_CONTAINER" sh -c "ip route show default | awk '{print \$3}'" 2>/dev/null || echo "172.17.0.1")
  echo "docker_host_ip=$HOST_IP"
  docker exec "$NGINX_CONTAINER" sh -c "wget -q -S -O /dev/null --timeout=3 http://${HOST_IP}:${WEB_PORT}${STAGING_BASE_PATH}/auth/login 2>&1 | head -5" || true
  curl -s -o /dev/null -w "nginx_staging=%{http_code}\n" "http://127.0.0.1${STAGING_BASE_PATH}/auth/login" || echo "nginx_staging=000"
  echo "=== nginx error log (last 10) ==="
  docker exec "$NGINX_CONTAINER" sh -c "tail -10 /var/log/nginx/error.log 2>/dev/null" || true
else
  echo "WARN: $NGINX_CONTAINER not running"
fi

echo "=== staging web logs ==="
journalctl -u kinetix-staging-web -n 15 --no-pager 2>/dev/null || true
