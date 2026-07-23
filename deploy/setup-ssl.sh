#!/usr/bin/env bash
# One-time SSL bootstrap for kinetix.infosoftco.com — run manually on the
# EC2 box, once, after DNS (A record -> this server's IP) has propagated.
# Idempotent: safe to re-run, skips issuance if a real cert already exists.
#
# What it does:
#   1. Generates a throwaway self-signed cert at the path nginx expects, so
#      nginx can start at all (the shipped docker.conf already references
#      the final cert path — nginx won't boot without *something* there).
#   2. Starts nginx (serves the ACME http-01 challenge over :80).
#   3. Requests the real cert from Let's Encrypt via certbot, webroot mode.
#   4. Reloads nginx so it picks up the real cert.
#   5. Starts the certbot renewal loop (see docker-compose.app.yml).
set -euo pipefail

DOMAIN="kinetix.infosoftco.com"
EMAIL="${CERTBOT_EMAIL:?Set CERTBOT_EMAIL=you@example.com and re-run}"

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_ROOT="${APP_ROOT:-$ROOT}"
COMPOSE_FILES="-f $APP_ROOT/docker-compose.yml -f $APP_ROOT/docker-compose.app.yml"

log() { echo "==> $*"; }
compose() { docker compose $COMPOSE_FILES "$@"; }

cd "$APP_ROOT"

if compose run --rm --entrypoint sh certbot -c "[ -f /etc/letsencrypt/live/$DOMAIN/fullchain.pem ]" >/dev/null 2>&1; then
  log "Certificate for $DOMAIN already exists — skipping issuance, just starting/reloading."
  compose up -d nginx certbot
  docker exec kinetix-nginx-1 nginx -t
  docker exec kinetix-nginx-1 nginx -s reload
  log "Done."
  exit 0
fi

log "No certificate yet — generating a throwaway self-signed cert so nginx can boot"
compose run --rm --entrypoint sh certbot -c "
  set -e
  apk add --no-cache openssl >/dev/null 2>&1 || true
  mkdir -p /etc/letsencrypt/live/$DOMAIN
  openssl req -x509 -nodes -newkey rsa:2048 -days 1 \
    -keyout /etc/letsencrypt/live/$DOMAIN/privkey.pem \
    -out /etc/letsencrypt/live/$DOMAIN/fullchain.pem \
    -subj '/CN=$DOMAIN'
"

log "Starting nginx with the throwaway cert"
compose up -d nginx

log "Requesting the real certificate from Let's Encrypt (webroot http-01 challenge)"
compose run --rm certbot certonly --webroot -w /var/www/certbot \
  -d "$DOMAIN" --email "$EMAIL" --agree-tos --no-eff-email --force-renewal

log "Reloading nginx with the real certificate"
docker exec kinetix-nginx-1 nginx -t
docker exec kinetix-nginx-1 nginx -s reload

log "Starting certbot auto-renew loop"
compose up -d certbot

log "Done — https://$DOMAIN should now serve a trusted certificate."
