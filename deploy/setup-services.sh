#!/usr/bin/env bash
# Run once on EC2 after cloning the repo to /opt/clickup/kinetix
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_ROOT="${APP_ROOT:-$ROOT}"

echo "==> Install systemd units ($APP_ROOT)"
sudo cp "$ROOT/deploy/systemd/kinetix-api.service" /etc/systemd/system/
sudo cp "$ROOT/deploy/systemd/kinetix-web.service" /etc/systemd/system/
sudo sed -i "s|/opt/clickup/kinetix|$APP_ROOT|g" /etc/systemd/system/kinetix-api.service
sudo sed -i "s|/opt/clickup/kinetix|$APP_ROOT|g" /etc/systemd/system/kinetix-web.service
sudo systemctl daemon-reload
sudo systemctl enable kinetix-api kinetix-web
sudo systemctl start kinetix-api kinetix-web

echo "==> Status"
sudo systemctl --no-pager status kinetix-api kinetix-web
