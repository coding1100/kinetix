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

replace_in_file() {
  local src="$1"
  local dst="$2"
  local needle="$3"
  local replacement="$4"
  python3 - "$src" "$dst" "$needle" "$replacement" <<'PY'
import pathlib
import sys

src, dst, needle, replacement = sys.argv[1:5]
content = pathlib.Path(src).read_text(encoding="utf-8")
content = content.replace(needle, replacement)
pathlib.Path(dst).write_text(content, encoding="utf-8")
PY
}

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

wait_for_service_active() {
  local service="$1"
  local attempts="${2:-20}"
  local i=1
  while [ "$i" -le "$attempts" ]; do
    if sudo systemctl is-active --quiet "$service"; then
      return 0
    fi
    sleep 2
    i=$((i + 1))
  done
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
    ip=$(
      docker exec "$NGINX_CONTAINER" sh -c \
        "ip -4 route show default 2>/dev/null | awk '{for (i=1;i<=NF;i++) if (\$i==\"via\") {print \$(i+1); exit}}'" \
        2>/dev/null || true
    )
  fi
  if [ -z "$ip" ]; then
    ip=$(ip -4 route show default 2>/dev/null | awk '{for (i=1;i<=NF;i++) if ($i=="via") {print $(i+1); exit}}' || true)
  fi
  ip="$(echo "$ip" | tr -d '\r' | tr '\n' ' ' | awk '{print $1}')"
  if ! echo "$ip" | grep -Eq '^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$'; then
    ip=""
  fi
  echo "${ip:-172.17.0.1}"
}

reload_docker_nginx() {
  local host_ip="$1"
  host_ip="$(echo "$host_ip" | tr -d '\r' | tr '\n' ' ' | awk '{print $1}')"
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
  replace_in_file "$nginx_src" "$nginx_dst" "__DOCKER_HOST_IP__" "$host_ip"
  log "Docker nginx upstream host IP: $host_ip"
  docker exec "$NGINX_CONTAINER" sh -c "wget -q -O- --timeout=3 http://${host_ip}:${WEB_PORT}${STAGING_BASE_PATH}/auth/login >/dev/null" \
    && log "nginx container can reach staging web" \
    || echo "WARN: nginx container cannot reach http://${host_ip}:${WEB_PORT}${STAGING_BASE_PATH}/auth/login"
  docker exec "$NGINX_CONTAINER" nginx -t
  docker exec "$NGINX_CONTAINER" nginx -s reload
}

patch_env_var() {
  local file="$1"
  local key="$2"
  local value="$3"
  python3 - "$file" "$key" "$value" <<'PY'
import pathlib
import re
import sys

file_path = pathlib.Path(sys.argv[1])
key = sys.argv[2]
value = sys.argv[3]
line = f'{key}="{value}"'

if file_path.exists():
    content = file_path.read_text(encoding="utf-8")
    pattern = re.compile(rf"^{re.escape(key)}=.*$", flags=re.MULTILINE)
    if pattern.search(content):
        content = pattern.sub(line, content, count=1)
    else:
        if content and not content.endswith("\n"):
            content += "\n"
        content += line + "\n"
else:
    content = line + "\n"

file_path.write_text(content, encoding="utf-8")
PY
}

log "Staging deploy — branch=$DEPLOY_BRANCH app=$APP_ROOT public=$STAGING_PUBLIC_URL"
log "Socket/CORS frontend origin: $STAGING_FRONTEND_ORIGIN"
log "Fix ownership ($DEPLOY_USER)"
sudo chown -R "$DEPLOY_USER:$DEPLOY_USER" "$FRONTEND" "$BACKEND" 2>/dev/null || true
cd "$APP_ROOT"

log "Pull latest code ($DEPLOY_BRANCH)"
git fetch origin "$DEPLOY_BRANCH"
git reset --hard "origin/$DEPLOY_BRANCH"
log "Deployed commit: $(git rev-parse --short HEAD) — $(git log -1 --format='%s')"

log "Stop Docker staging stack if it is still running (old images bind :3050/:4050)"
if [ -f "$APP_ROOT/docker-compose.staging.yml" ]; then
  (
    cd "$APP_ROOT"
    docker compose -f docker-compose.staging.yml down --remove-orphans 2>/dev/null || true
  )
fi

log "Stop staging systemd services and free ports"
sudo systemctl stop "$API_SERVICE" "$WEB_SERVICE" 2>/dev/null || true
for port in "$WEB_PORT" "$API_PORT"; do
  if ss -tlnp 2>/dev/null | grep -q ":${port} "; then
    log "Freeing port ${port}"
    fuser -k "${port}/tcp" 2>/dev/null || true
    sleep 2
  fi
done

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

if ! wait_for_service_active "$API_SERVICE" 15; then
  echo "ERROR: $API_SERVICE is not active"
  sudo systemctl status "$API_SERVICE" --no-pager || true
  sudo journalctl -u "$API_SERVICE" -n 60 --no-pager || true
  exit 1
fi

if ! wait_for_service_active "$WEB_SERVICE" 15; then
  echo "ERROR: $WEB_SERVICE is not active"
  sudo systemctl status "$WEB_SERVICE" --no-pager || true
  sudo journalctl -u "$WEB_SERVICE" -n 60 --no-pager || true
  exit 1
fi

log "Staging deploy complete — ${STAGING_PUBLIC_URL}/auth/login"
