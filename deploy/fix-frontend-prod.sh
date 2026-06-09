#!/usr/bin/env bash
# Run on EC2: fixes Turbopack/dev chunk 500 errors by forcing production mode only.
set -euo pipefail

APP_ROOT="${APP_ROOT:-/opt/clickup/kinetix}"
FRONTEND="$APP_ROOT/frontend"
DEPLOY_USER="${DEPLOY_USER:-ubuntu}"

# Run as ubuntu — not "sudo bash …" (sudo leaves root-owned .next/node_modules).
run_frontend() {
  if [ "$(id -un)" = "$DEPLOY_USER" ]; then
    bash -lc "cd '$FRONTEND' && $*"
  else
    sudo -u "$DEPLOY_USER" -- bash -lc "cd '$FRONTEND' && $*"
  fi
}

echo "==> Fix app ownership ($DEPLOY_USER)"
sudo chown -R "$DEPLOY_USER:$DEPLOY_USER" "$FRONTEND" 2>/dev/null || true

echo "==> Stop ALL Next.js processes (dev + prod)"
sudo systemctl stop kinetix-web 2>/dev/null || true
# [n]ext avoids pkill matching its own shell cmdline (see kinetix-web.service)
sudo pkill -f '[n]ext dev' 2>/dev/null || true
sleep 2
if sudo lsof -i :3000 -t >/dev/null 2>&1; then
  sudo fuser -k 3000/tcp 2>/dev/null || true
  sleep 2
fi

if sudo lsof -i :3000 -t >/dev/null 2>&1; then
  echo "ERROR: port 3000 still in use:"
  sudo lsof -i :3000
  echo "Kill it manually: sudo kill \$(sudo lsof -t -i :3000)"
  exit 1
fi

echo "==> Clean dev/build artifacts"
run_frontend 'rm -rf .next node_modules/.cache'

echo "==> Install + production build"
run_frontend 'npm ci'
run_frontend 'NODE_ENV=production npm run build'

if [ ! -d "$FRONTEND/.next/static/chunks" ]; then
  echo "ERROR: build did not produce .next/static/chunks"
  exit 1
fi

echo "==> Chunk count: $(ls -1 "$FRONTEND/.next/static/chunks" | wc -l)"

echo "==> Install systemd unit (production only)"
sudo tee /etc/systemd/system/kinetix-web.service >/dev/null <<EOF
[Unit]
Description=Kinetix Web (Next.js production)
After=network.target

[Service]
Type=simple
User=ubuntu
Group=ubuntu
WorkingDirectory=$FRONTEND
Environment=NODE_ENV=production
Environment=PORT=3000
ExecStart=$FRONTEND/node_modules/.bin/next start -p 3000 -H 127.0.0.1
Restart=always
RestartSec=5
TimeoutStartSec=120

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable kinetix-web
sudo systemctl start kinetix-web
sleep 3

echo "==> Verify production mode"
if pgrep -af '[n]ext dev' >/dev/null 2>&1; then
  echo "ERROR: next dev is still running (dev mode):"
  pgrep -af next || true
  exit 1
fi

if ! sudo systemctl is-active --quiet kinetix-web; then
  echo "ERROR: kinetix-web is not active"
  sudo journalctl -u kinetix-web -n 30 --no-pager
  exit 1
fi

LOGIN_CODE=$(curl -fsS -o /dev/null -w "%{http_code}" http://127.0.0.1:3000/auth/login 2>/dev/null || echo "000")
if ! echo "$LOGIN_CODE" | grep -qE '^[23]'; then
  echo "ERROR: login page HTTP $LOGIN_CODE"
  exit 1
fi

SAMPLE_CHUNK=$(curl -fsS http://127.0.0.1:3000/auth/login | grep -oE '/_next/static/chunks/[^"]+\.js' | head -1)
if [ -z "$SAMPLE_CHUNK" ]; then
  echo "ERROR: no JS chunks in login page HTML"
  exit 1
fi
CHUNK_CODE=$(curl -fsS -o /dev/null -w "%{http_code}" "http://127.0.0.1:3000$SAMPLE_CHUNK" 2>/dev/null || echo "000")
if ! echo "$CHUNK_CODE" | grep -qE '^2'; then
  echo "ERROR: chunk $SAMPLE_CHUNK returned HTTP $CHUNK_CODE"
  exit 1
fi

echo "==> OK — production Next.js on :3000 (next start, chunks HTTP 200)"
sudo systemctl --no-pager status kinetix-web
echo ""
echo "Hard-refresh browser: Ctrl+Shift+R (or clear site data for 3.140.5.67)"
