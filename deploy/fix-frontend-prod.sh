#!/usr/bin/env bash
# Run on EC2: fixes Turbopack/dev chunk 500 errors by forcing production mode only.
set -euo pipefail

APP_ROOT="${APP_ROOT:-/opt/clickup/kinetix}"
FRONTEND="$APP_ROOT/frontend"

echo "==> Stop ALL Next.js processes (dev + prod)"
sudo systemctl stop kinetix-web 2>/dev/null || true
sudo pkill -f "next dev" 2>/dev/null || true
sudo pkill -f "next-server" 2>/dev/null || true
sudo pkill -f "node.*next" 2>/dev/null || true
sleep 2

if sudo lsof -i :3000 -t >/dev/null 2>&1; then
  echo "ERROR: port 3000 still in use:"
  sudo lsof -i :3000
  echo "Kill it manually: sudo kill \$(sudo lsof -t -i :3000)"
  exit 1
fi

echo "==> Clean dev/build artifacts"
cd "$FRONTEND"
rm -rf .next
rm -rf node_modules/.cache

echo "==> Install + production build"
npm ci
NODE_ENV=production npm run build

if [ ! -d ".next/static/chunks" ]; then
  echo "ERROR: build did not produce .next/static/chunks"
  exit 1
fi

echo "==> Chunk count: $(ls -1 .next/static/chunks | wc -l)"

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
ExecStartPre=/bin/sh -c 'pkill -f "next dev" || true'
ExecStart=$FRONTEND/node_modules/.bin/next start -p 3000 -H 127.0.0.1
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable kinetix-web
sudo systemctl start kinetix-web
sleep 3

echo "==> Verify (must NOT contain turbopack)"
if curl -fsS http://127.0.0.1:3000 | grep -qi turbopack; then
  echo "ERROR: Still serving Turbopack — dev mode is active!"
  sudo journalctl -u kinetix-web -n 30 --no-pager
  exit 1
fi

echo "==> OK — production Next.js on :3000"
sudo systemctl --no-pager status kinetix-web
echo ""
echo "Hard-refresh browser: Ctrl+Shift+R (or clear site data for 3.140.5.67)"
