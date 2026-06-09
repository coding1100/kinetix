#!/usr/bin/env bash
# Run once on EC2 after cloning the repo to /opt/clickup/kinetix
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "==> Install systemd units"
sudo cp "$ROOT/deploy/systemd/kinetix-api.service" /etc/systemd/system/
sudo cp "$ROOT/deploy/systemd/kinetix-web.service" /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable kinetix-api kinetix-web
sudo systemctl start kinetix-api kinetix-web

echo "==> Status"
sudo systemctl --no-pager status kinetix-api kinetix-web
