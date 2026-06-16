#!/usr/bin/env bash
# Staging deploy for EC2 — develop branch, public URL http://HOST/staging (port 80).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_ROOT="${APP_ROOT:-$ROOT}"
DEFAULT_APP_ROOT="/opt/clickup/kinetix-staging"
PROD_ROOT="${PROD_ROOT:-/opt/clickup/kinetix}"
DEPLOY_BRANCH="${DEPLOY_BRANCH:-develop}"
WEB_PORT="${WEB_PORT:-3050}"
API_PORT="${API_PORT:-4050}"
STAGING_BASE_PATH="${STAGING_BASE_PATH:-/staging}"
PUBLIC_HOST="${PUBLIC_HOST:-3.140.5.67}"
STAGING_PUBLIC_URL="${STAGING_PUBLIC_URL:-http://${PUBLIC_HOST}${STAGING_BASE_PATH}}"
STAGING_FRONTEND_ORIGIN="${STAGING_PUBLIC_URL%/}"
if [[ "${STAGING_BASE_PATH%/}" != "/" && "$STAGING_FRONTEND_ORIGIN" == *"${STAGING_BASE_PATH%/}" ]]; then
  STAGING_FRONTEND_ORIGIN="${STAGING_FRONTEND_ORIGIN%${STAGING_BASE_PATH%/}}"
fi
STAGING_FRONTEND_ORIGIN="${STAGING_FRONTEND_ORIGIN%/}"
FRONTEND="$APP_ROOT/frontend"
BACKEND="$APP_ROOT/backend-py"
DEPLOY_USER="${DEPLOY_USER:-ubuntu}"
API_SERVICE="${API_SERVICE:-kinetix-staging-api}"
WEB_SERVICE="${WEB_SERVICE:-kinetix-staging-web}"
NGINX_CONTAINER="${NGINX_CONTAINER:-kinetix-nginx-1}"

log() { echo "==> $*"; }

wait_for_http() {
  local url="$1"
  local label="$2"
  local attempts="${3:-45}"
  local i=1
  while [ "$i" -le "$attempts" ]; do
    if curl -fsS "$url" >/dev/null 2>&1; then
      log "$label ready ($url)"
      return 0
    fi
    sleep 2
    i=$((i + 1))
  done
  echo "ERROR: $label not ready after $((attempts * 2))s — $url"
  return 1
}

run_as_user() {
  local dir="$1"
  shift
  if [ "$(id -un)" = "$DEPLOY_USER" ]; then
    bash -lc "cd '$dir' && $*"
  else
    sudo -u "$DEPLOY_USER" -- bash -lc "cd '$dir' && $*"
  fi
}

docker_host_ip() {
  local ip=""
  if docker ps --format '{{.Names}}' | grep -qx "$NGINX_CONTAINER"; then
    ip=$(docker exec "$NGINX_CONTAINER" sh -c "ip route show default 2>/dev/null | awk '{print \$3}'" 2>/dev/null || true)
  fi
  if [ -z "$ip" ]; then
    ip=$(ip route show default 2>/dev/null | awk '{print $3}' || true)
  fi
  echo "${ip:-172.17.0.1}"
}

reload_docker_nginx() {
  local host_ip="$1"
  local nginx_src="$ROOT/deploy/nginx/docker.conf"
  local nginx_dst="$PROD_ROOT/deploy/nginx/docker.conf"
  if [ ! -f "$nginx_src" ]; then
    echo "WARN: $nginx_src missing"
    return 0
  fi
  if ! docker ps --format '{{.Names}}' | grep -qx "$NGINX_CONTAINER"; then
    echo "WARN: $NGINX_CONTAINER not running — start prod Docker first"
    return 0
  fi
  mkdir -p "$(dirname "$nginx_dst")"
  sed "s|__DOCKER_HOST_IP__|${host_ip}|g" "$nginx_src" >"$nginx_dst"
  log "Docker nginx upstream host IP: $host_ip"
  docker exec "$NGINX_CONTAINER" sh -c "wget -q -O- --timeout=3 http://${host_ip}:3050${STAGING_BASE_PATH}/auth/login >/dev/null" \
    && log "nginx container can reach staging web" \
    || echo "WARN: nginx container cannot reach http://${host_ip}:3050${STAGING_BASE_PATH}/auth/login"
  docker exec "$NGINX_CONTAINER" nginx -t
  docker exec "$NGINX_CONTAINER" nginx -s reload
}

patch_env_var() {
  local file="$1"
  local key="$2"
  local value="$3"
  if grep -q "^${key}=" "$file" 2>/dev/null; then
    sed -i "s|^${key}=.*|${key}=\"${value}\"|" "$file"
  else
    echo "${key}=\"${value}\"" >>"$file"
  fi
}

log "Staging deploy — branch=$DEPLOY_BRANCH app=$APP_ROOT public=$STAGING_PUBLIC_URL"
log "Socket/CORS frontend origin: $STAGING_FRONTEND_ORIGIN"
log "Fix ownership ($DEPLOY_USER)"
sudo chown -R "$DEPLOY_USER:$DEPLOY_USER" "$FRONTEND" "$BACKEND" 2>/dev/null || true
cd "$APP_ROOT"

log "Pull latest code ($DEPLOY_BRANCH)"
git fetch origin "$DEPLOY_BRANCH"
git reset --hard "origin/$DEPLOY_BRANCH"

log "Stop staging Next.js if running"
sudo systemctl stop "$WEB_SERVICE" 2>/dev/null || true
if lsof -i :"$WEB_PORT" -t >/dev/null 2>&1; then
  fuser -k "${WEB_PORT}/tcp" 2>/dev/null || true
  sleep 2
fi

log "Install staging systemd units"
sudo cp "$ROOT/deploy/systemd/kinetix-staging-api.service" /etc/systemd/system/
sudo cp "$ROOT/deploy/systemd/kinetix-staging-web.service" /etc/systemd/system/
sudo sed -i "s|$DEFAULT_APP_ROOT|$APP_ROOT|g" /etc/systemd/system/kinetix-staging-api.service
sudo sed -i "s|$DEFAULT_APP_ROOT|$APP_ROOT|g" /etc/systemd/system/kinetix-staging-web.service
sudo sed -i "s|--port 4050|--port $API_PORT|g" /etc/systemd/system/kinetix-staging-api.service
sudo sed -i "s|-p 3050 |-p $WEB_PORT |g" /etc/systemd/system/kinetix-staging-web.service
sudo sed -i "s|Environment=PORT=3050|Environment=PORT=$WEB_PORT|g" /etc/systemd/system/kinetix-staging-web.service
sudo systemctl daemon-reload

log "Backend env (staging URLs)"
if [ -f "$BACKEND/.env" ]; then
  patch_env_var "$BACKEND/.env" "PORT" "$API_PORT"
  patch_env_var "$BACKEND/.env" "NODE_ENV" "production"
  patch_env_var "$BACKEND/.env" "FRONTEND_URL" "$STAGING_FRONTEND_ORIGIN"
  patch_env_var "$BACKEND/.env" "API_PUBLIC_URL" "$STAGING_PUBLIC_URL"
fi

log "Frontend env (basePath $STAGING_BASE_PATH)"
cat >"$FRONTEND/.env.local" <<EOF
NEXT_PUBLIC_BASE_PATH=${STAGING_BASE_PATH}
NEXT_PUBLIC_API_URL=${STAGING_BASE_PATH}/api/v1
NEXT_PUBLIC_APP_URL=${STAGING_PUBLIC_URL}
NEXT_PUBLIC_SOCKET_URL=${STAGING_PUBLIC_URL}
EOF

log "Backend dependencies"
cd "$BACKEND"
export PATH="$HOME/.local/bin:$PATH"
if ! command -v uv >/dev/null 2>&1; then
  curl -LsSf https://astral.sh/uv/install.sh | sh
  export PATH="$HOME/.local/bin:$PATH"
fi
if ! command -v uv >/dev/null 2>&1; then
  echo "ERROR: uv not found after install (expected in \$HOME/.local/bin)"
  exit 1
fi
uv sync
sudo chown -R "$DEPLOY_USER:$DEPLOY_USER" "$BACKEND"

log "Frontend production build (basePath=$STAGING_BASE_PATH)"
run_as_user "$FRONTEND" 'rm -rf .next node_modules/.cache'
run_as_user "$FRONTEND" 'npm ci'
run_as_user "$FRONTEND" "NEXT_PUBLIC_BASE_PATH=${STAGING_BASE_PATH} NODE_ENV=production npm run build"

if [ ! -d "$FRONTEND/.next/static/chunks" ]; then
  echo "ERROR: frontend build missing .next/static/chunks"
  exit 1
fi

log "Restart staging services (before nginx reload)"
sudo systemctl enable "$API_SERVICE" "$WEB_SERVICE"
sudo systemctl restart "$API_SERVICE" "$WEB_SERVICE"
sleep 5

log "Health checks (direct ports)"
if ! wait_for_http "http://127.0.0.1:${API_PORT}/health" "Staging API"; then
  sudo journalctl -u "$API_SERVICE" -n 40 --no-pager
  exit 1
fi

STAGING_LOGIN_PATH="${STAGING_BASE_PATH}/auth/login"
if ! wait_for_http "http://127.0.0.1:${WEB_PORT}${STAGING_LOGIN_PATH}" "Staging Web"; then
  sudo journalctl -u "$WEB_SERVICE" -n 40 --no-pager
  exit 1
fi

HOST_IP="$(docker_host_ip)"
log "Docker nginx — route /staging on port 80 ($NGINX_CONTAINER)"
reload_docker_nginx "$HOST_IP"

if docker ps --format '{{.Names}}' | grep -qx "$NGINX_CONTAINER"; then
  if ! wait_for_http "http://127.0.0.1${STAGING_LOGIN_PATH}" "Staging via Docker nginx"; then
    docker logs "$NGINX_CONTAINER" --tail 30
    echo "TIP: run deploy/diagnose-staging.sh on EC2"
    exit 1
  fi
fi

if ! sudo systemctl is-active --quiet "$API_SERVICE"; then
  echo "ERROR: $API_SERVICE is not active"
  exit 1
fi

if ! sudo systemctl is-active --quiet "$WEB_SERVICE"; then
  echo "ERROR: $WEB_SERVICE is not active"
  exit 1
fi

log "Staging deploy complete — ${STAGING_PUBLIC_URL}/auth/login"
