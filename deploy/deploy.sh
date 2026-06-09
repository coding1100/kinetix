#!/usr/bin/env bash
# Production deploy for EC2 — run manually or via GitHub Actions.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_ROOT="${APP_ROOT:-$ROOT}"
FRONTEND="$APP_ROOT/frontend"
BACKEND="$APP_ROOT/backend-py"

log() { echo "==> $*"; }

log "App root: $APP_ROOT"
cd "$APP_ROOT"

log "Pull latest code"
git fetch origin main
git reset --hard origin/main

log "Stop dev Next.js (prevents Turbopack chunk errors)"
sudo systemctl stop kinetix-web 2>/dev/null || true
pkill -f "next dev" 2>/dev/null || true
sleep 1

log "Install systemd units"
sudo cp "$ROOT/deploy/systemd/kinetix-api.service" /etc/systemd/system/
sudo cp "$ROOT/deploy/systemd/kinetix-web.service" /etc/systemd/system/
sudo sed -i "s|/opt/clickup/kinetix|$APP_ROOT|g" /etc/systemd/system/kinetix-api.service
sudo sed -i "s|/opt/clickup/kinetix|$APP_ROOT|g" /etc/systemd/system/kinetix-web.service
sudo systemctl daemon-reload

log "Backend dependencies"
cd "$BACKEND"
if [ ! -d .venv ]; then
  python3 -m venv .venv
fi
# shellcheck disable=SC1091
source .venv/bin/activate
if ! command -v uv >/dev/null 2>&1; then
  pip install uv
fi
uv sync

log "Frontend production build"
cd "$FRONTEND"
rm -rf .next node_modules/.cache
npm ci
NODE_ENV=production npm run build

if [ ! -d ".next/static/chunks" ]; then
  echo "ERROR: frontend build missing .next/static/chunks"
  exit 1
fi

log "Nginx config"
if [ -f "$ROOT/kinetix-site.conf" ]; then
  sudo sed "s|/opt/clickup/kinetix|$APP_ROOT|g" "$ROOT/kinetix-site.conf" \
    | sudo tee /etc/nginx/sites-available/kinetix >/dev/null
  sudo ln -sf /etc/nginx/sites-available/kinetix /etc/nginx/sites-enabled/kinetix
  sudo nginx -t
  sudo systemctl reload nginx
fi

log "Restart services"
sudo systemctl enable kinetix-api kinetix-web
sudo systemctl restart kinetix-api kinetix-web
sleep 4

log "Health checks"
if ! curl -fsS http://127.0.0.1:4000/health >/dev/null; then
  echo "ERROR: API health check failed"
  sudo journalctl -u kinetix-api -n 40 --no-pager
  exit 1
fi

if ! curl -fsS -o /dev/null -w "%{http_code}" http://127.0.0.1:3000 | grep -qE '^[23]'; then
  echo "ERROR: Web server not responding on :3000"
  sudo journalctl -u kinetix-web -n 40 --no-pager
  exit 1
fi

if curl -fsS http://127.0.0.1:3000 | grep -qi turbopack; then
  echo "ERROR: Still serving Turbopack (dev mode). Use next start only."
  sudo journalctl -u kinetix-web -n 40 --no-pager
  exit 1
fi

if ! sudo systemctl is-active --quiet kinetix-api; then
  echo "ERROR: kinetix-api is not active"
  exit 1
fi

if ! sudo systemctl is-active --quiet kinetix-web; then
  echo "ERROR: kinetix-web is not active"
  exit 1
fi

log "Deploy complete — API and web are healthy (production mode)"
