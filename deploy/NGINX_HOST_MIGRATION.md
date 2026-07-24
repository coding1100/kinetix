# nginx: Docker container -> host install

One-time cutover. nginx used to run as `kinetix-nginx-1` (Docker), proxying
by container DNS name over the `kinetix_edge` network. It now runs on the
host (apt), proxying to `api`/`web`/`admin`/staging containers via their
host-published `127.0.0.1:<port>` ports. Config lives at
`deploy/nginx/host.conf` (replaces `deploy/nginx/docker.conf`, which is now
unused — delete it once this migration is confirmed working).

Do this on **both** boxes: prod (`/opt/clickup/kinetix`) and the staging box
if separate, plus wherever `admin` runs (same box as prod here). Prod first,
since staging's nginx routing (`deploy-staging.sh`'s `reload_host_nginx`)
assumes prod's host nginx is already the one serving `/staging/*`.

## 1. Pull the code with the new compose files + configs

```bash
cd /opt/clickup/kinetix
git fetch origin main && git reset --hard origin/main
```

## 2. Install nginx + certbot on the host

```bash
sudo apt update
sudo apt install -y nginx certbot python3-certbot-nginx
```

## 3. Copy the existing cert out of the Docker certbot volume

Avoid a fresh Let's Encrypt issuance (rate limits, avoidable downtime) by
reusing the cert the Docker `certbot` container already obtained.

```bash
pg_id_unused=1  # just a reminder this doesn't touch postgres
docker run --rm -v kinetix_certbot-etc:/etc/letsencrypt -v /tmp/le-export:/export alpine \
  sh -c "mkdir -p /export && cp -a /etc/letsencrypt/. /export/"
sudo mkdir -p /etc/letsencrypt
sudo cp -a /tmp/le-export/. /etc/letsencrypt/
sudo rm -rf /tmp/le-export
```

Adjust the volume name if `docker volume ls | grep certbot-etc` shows a
different prefix than `kinetix_certbot-etc`.

## 4. Stop and remove the old Docker nginx + certbot containers

```bash
docker compose -f docker-compose.yml -f docker-compose.app.yml stop nginx certbot
docker compose -f docker-compose.yml -f docker-compose.app.yml rm -f nginx certbot
```

The new `docker-compose.app.yml` no longer defines these services — this
just cleans up the still-running old ones from before you pulled.

## 5. Bring up api/web/admin with their new host-published ports

```bash
docker compose -f docker-compose.yml -f docker-compose.app.yml up -d --build api web admin
docker compose -f docker-compose.yml -f docker-compose.app.yml ps
```

Confirm each is reachable directly on loopback before wiring nginx to them:

```bash
curl -fsS http://127.0.0.1:4000/health
curl -fsS -o /dev/null -w "%{http_code}\n" http://127.0.0.1:3000/
curl -fsS -o /dev/null -w "%{http_code}\n" http://127.0.0.1:3002/admin-portal/login
```

## 6. Install the host nginx config

```bash
sudo cp deploy/nginx/host.conf /etc/nginx/sites-available/kinetix
sudo ln -sf /etc/nginx/sites-available/kinetix /etc/nginx/sites-enabled/kinetix
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl enable --now nginx
sudo systemctl reload nginx
```

## 7. Verify prod end to end

```bash
curl -fsS http://127.0.0.1/auth/login -o /dev/null -w "%{http_code}\n"
curl -fsS https://kinetix.infosoftco.com/auth/login -o /dev/null -w "%{http_code}\n"
```
Then log in via browser, exercise a few pages, confirm sockets connect.

## 8. Bring staging up on its new ports and confirm host nginx reaches it

If staging runs on the same box:
```bash
cd /opt/clickup/kinetix-staging
docker compose -f docker-compose.staging.yml up -d --build
curl -fsS http://127.0.0.1:4010/health
curl -fsS -o /dev/null -w "%{http_code}\n" http://127.0.0.1:3010/staging/
curl -fsS http://127.0.0.1/staging/auth/login -o /dev/null -w "%{http_code}\n"
```

## 9. Enable certbot auto-renewal on the host

```bash
sudo certbot renew --dry-run
sudo systemctl list-timers | grep certbot
```
Should show `certbot.timer` (or `snap.certbot.renew.timer`) enabled. If
neither exists, `sudo systemctl enable --now certbot.timer`.

## 10. Clean up

```bash
docker network rm kinetix_edge 2>/dev/null || true   # no longer used for routing
rm -f deploy/nginx/docker.conf                         # superseded by host.conf
```
Only do this after confirming step 7 and 8 both work — the edge network
costs nothing to leave around if you want a rollback window.

## Rollback

If something breaks and you need the old Docker nginx back fast:
```bash
sudo systemctl stop nginx
docker compose -f docker-compose.yml -f docker-compose.app.yml up -d nginx certbot
```
(Only works if you haven't yet removed the `nginx`/`certbot` service blocks
from your local checkout — `git stash` the compose file changes first if
you already pulled past this point.)
