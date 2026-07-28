#!/usr/bin/env bash
# One-time SSL bootstrap for kinetix.mindrind.com — run manually on the
# EC2 box, once, after DNS (A record -> this server's IP) has propagated
# and host nginx is installed and serving deploy/nginx/host.conf over :80.
# Idempotent: safe to re-run, certbot skips issuance if a valid cert exists.
#
# Requires: apt install nginx certbot python3-certbot-nginx
#
# What it does:
#   1. Confirms host nginx is running and serving the ACME webroot path.
#   2. Requests the cert from Let's Encrypt via the certbot nginx plugin
#      (edits the ssl_certificate paths in place, reloads nginx).
#   3. Confirms the certbot systemd timer is enabled for auto-renewal.
set -euo pipefail

DOMAIN="kinetix.mindrind.com"
EMAIL="${CERTBOT_EMAIL:?Set CERTBOT_EMAIL=you@example.com and re-run}"

log() { echo "==> $*"; }

if ! systemctl is-active --quiet nginx; then
  echo "ERROR: host nginx is not running — install/start it first (see deploy/NGINX_HOST_MIGRATION.md)"
  exit 1
fi

if [ -f "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" ]; then
  log "Certificate for $DOMAIN already exists — skipping issuance."
else
  log "Requesting certificate from Let's Encrypt via certbot nginx plugin"
  sudo certbot --nginx -d "$DOMAIN" --email "$EMAIL" --agree-tos --no-eff-email --redirect
fi

log "Verifying nginx config and reloading"
sudo nginx -t
sudo systemctl reload nginx

log "Confirming certbot renewal timer is enabled"
sudo systemctl enable --now certbot.timer 2>/dev/null || sudo systemctl enable --now snap.certbot.renew.timer 2>/dev/null || \
  echo "WARN: could not confirm a certbot renewal timer — check 'systemctl list-timers | grep certbot' manually"

log "Done — https://$DOMAIN should now serve a trusted certificate."
