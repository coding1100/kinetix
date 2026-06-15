#!/usr/bin/env bash
# Run once on EC2 after cloning develop to /opt/clickup/kinetix-staging
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_ROOT="${APP_ROOT:-$ROOT}"
DEFAULT_APP_ROOT="/opt/clickup/kinetix-staging"

echo "==> Install staging systemd units ($APP_ROOT)"
sudo cp "$ROOT/deploy/systemd/kinetix-staging-api.service" /etc/systemd/system/
sudo cp "$ROOT/deploy/systemd/kinetix-staging-web.service" /etc/systemd/system/
sudo sed -i "s|$DEFAULT_APP_ROOT|$APP_ROOT|g" /etc/systemd/system/kinetix-staging-api.service
sudo sed -i "s|$DEFAULT_APP_ROOT|$APP_ROOT|g" /etc/systemd/system/kinetix-staging-web.service
sudo systemctl daemon-reload
sudo systemctl enable kinetix-staging-api kinetix-staging-web
sudo systemctl start kinetix-staging-api kinetix-staging-web

echo "==> Status"
sudo systemctl --no-pager status kinetix-staging-api kinetix-staging-web
