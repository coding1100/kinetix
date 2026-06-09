#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

echo "==> Pull latest code"
git pull origin main

echo "==> Backend dependencies"
cd "$ROOT/backend-py"
source .venv/bin/activate
uv sync

echo "==> Frontend build"
cd "$ROOT/frontend"
npm ci
npm run build

echo "==> Restart services"
sudo systemctl restart kinetix-api kinetix-web

echo "==> Status"
sudo systemctl --no-pager status kinetix-api kinetix-web

echo "Deploy complete."
