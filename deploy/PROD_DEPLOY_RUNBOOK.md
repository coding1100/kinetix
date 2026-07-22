# Production deploy runbook

Repeatable steps for merging into `main` and deploying to prod, plus running
DB migrations afterward (deploy.sh does not run them automatically).

Prod runs fully as Docker containers (`postgres`, `api`, `web`, `nginx`, built
from `docker-compose.yml` + `docker-compose.app.yml`) — not systemd. nginx
routes `location /` → `web:3000` and `location /api/` → `api:4000` (see
`deploy/nginx/docker.conf`).

## 1. Merge into `main`

Via GitHub UI, or:
```
gh pr merge <pr-number> --merge
```
Push to `main` auto-triggers `.github/workflows/deploy-ec2.yml`, which runs
`deploy/deploy.sh` on the EC2 box: pulls `main`, builds and restarts the
`postgres` → `api` → `web` → `nginx` containers in order, health-checking
each before moving to the next.

## 2. Watch the deploy

```
gh run list --workflow=deploy-ec2.yml --limit 3
gh run watch <run-id>
```

## 3. SSH in, backup prod DB first — real user data

```
ssh -i C:\Users\dell\.ssh\id_ed25519 ubuntu@<EC2_IP>
cd /opt/clickup/kinetix
pg_id=$(docker compose -f docker-compose.yml -f docker-compose.app.yml ps -q postgres)
docker exec "$pg_id" sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB"' > ~/prod_backup_$(date +%Y%m%d_%H%M).sql
```

## 4. Confirm deploy landed

```
git log -1 --oneline
docker compose -f docker-compose.yml -f docker-compose.app.yml ps
curl -fsS http://127.0.0.1/auth/login -o /dev/null -w "%{http_code}\n"
```

## 5. Get any new/updated scripts into the api container

The Docker image doesn't bake in `backend-py/scripts/` (see
`backend-py/Dockerfile` — only `app/` is copied). Only needed if this deploy
added/changed files under `backend-py/scripts/`:
```
api_id=$(docker compose -f docker-compose.yml -f docker-compose.app.yml ps -q api)
docker cp backend-py/scripts/. "$api_id":/app/scripts/
```

## 6. Ensure the venv inside the api container has what migrations need

```
docker exec -it "$api_id" uv pip install --python /app/.venv/bin/python psycopg2-binary
```
(`psycopg2` isn't in `pyproject.toml`; most migration scripts need it. Safe
to run every time — instant no-op if already installed.)

## 7. Check schema drift — tells you exactly what to run, don't guess

```
docker exec -it "$api_id" sh -c "export DATABASE_URL=\"postgresql://\${POSTGRES_USER}:\${POSTGRES_PASSWORD}@postgres:5432/\${POSTGRES_DB}\"; cd /app && /app/.venv/bin/python scripts/check_schema_drift.py"
```
Prints `MISSING` for every table/column the ORM models expect but the DB
doesn't have, and next to each finding, which `run_*_migration.py` fixes it.
Ends with a copy-pasteable summary block. If a table's `.sql` file has no
`run_*.py` wrapping it yet, it prints a `MANUAL:` note instead — write the
missing runner script (see existing `run_*_migration.py` files for the
pattern) rather than hand-running SQL.

**Blind spot:** this only diffs table/column names, not Postgres enum
*labels*. A `.sql` file that does `ALTER TYPE "X" ADD VALUE ...` (e.g.
`migrate_super_admin_role.sql`) won't show up here even when unrun — it'll
surface at runtime instead as `asyncpg.exceptions.InvalidTextRepresentationError:
invalid input value for enum "X"`, which the app's generic exception handler
disguises as a `DATABASE_UNAVAILABLE` 503. If you add an enum-altering `.sql`
file, always write its `run_*_migration.py` runner in the same PR — don't
rely on drift check to catch a missing one.

## 8. Run each script it listed

```
docker exec -it "$api_id" sh -c "export DATABASE_URL=\"postgresql://\${POSTGRES_USER}:\${POSTGRES_PASSWORD}@postgres:5432/\${POSTGRES_DB}\"; cd /app && /app/.venv/bin/python scripts/<name_from_step_7>.py"
```
Stop and inspect if any one fails before running the next — they aren't
chained in one transaction.

## 9. Re-run drift check — must come back clean

```
docker exec -it "$api_id" sh -c "export DATABASE_URL=\"postgresql://\${POSTGRES_USER}:\${POSTGRES_PASSWORD}@postgres:5432/\${POSTGRES_DB}\"; cd /app && /app/.venv/bin/python scripts/check_schema_drift.py"
```
Expect: `No drift - DB schema matches all ORM models.` (remember the enum
blind spot above — clean here doesn't guarantee every enum-altering script
ran too.)

## 10. Verify

```
docker compose -f docker-compose.yml -f docker-compose.app.yml ps
curl -fsS http://127.0.0.1/auth/login -o /dev/null -w "%{http_code}\n"
docker compose -f docker-compose.yml -f docker-compose.app.yml logs api --tail 50
```
Then manually: log in, People page, a task (checklists/dependencies/
activity), Space/Folder/List privacy toggles + members list, share modal —
at `http://3.140.5.67`. If anything breaks and isn't a quick fix, restore
from the step-3 backup rather than guessing.

## Notes

- Everything is Docker — never `systemctl start/restart kinetix-api` or
  `kinetix-web`; `deploy.sh` stops and disables those systemd units on every
  run since they're superseded and would otherwise silently coexist with the
  real containers nginx routes to.
- nginx runs as a Docker container (`kinetix-nginx-1`, config at
  `deploy/nginx/docker.conf`) — never `systemctl reload nginx`, use
  `docker exec kinetix-nginx-1 nginx -s reload`. Host `nginx.service` is
  deliberately masked.
- `kinetix_edge` is an `external: true` Docker network (shared with staging,
  not Compose-managed) — `deploy.sh` creates it if missing, but if you ever
  see containers up yet unreachable via nginx, check
  `docker network inspect kinetix_edge` for a name/label mismatch first.
- `NEXT_PUBLIC_*` vars are baked into the `web` image at *build* time, not
  read at runtime — changing them requires `docker compose ... build web`,
  not just a restart. Build args live in `docker-compose.app.yml`'s `web.build.args`.
- If a migration script fails with `ModuleNotFoundError: No module named
  'pydantic_settings'`, you used `sh -lc` (login shell) instead of `sh -c` —
  login shells re-source `/etc/profile` and drop the venv from `PATH`.
  Always use `sh -c`, or call `/app/.venv/bin/python` directly.
- Copying files up: use a **separate** terminal window for `scp`/`docker cp`
  — you can't do it from inside the SSH session into itself.
