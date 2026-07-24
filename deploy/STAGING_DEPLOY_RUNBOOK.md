# Staging deploy runbook

Repeatable steps for merging into `develop` and deploying to staging. Generic —
doesn't hardcode migration script names, since those change per PR.

## 1. Merge PR into `develop`

Via GitHub UI, or:
```
git checkout develop
git pull origin develop
git merge --no-ff <your-branch>
git push origin develop
```
Push to `develop` auto-triggers `.github/workflows/deploy-staging-ec2.yml`.

## 2. Watch the deploy

```
gh run list --workflow=deploy-staging-ec2.yml --limit 3
gh run watch <run-id>
```

Note: this workflow has a known false-failure — it can report "staging api is not
running" and exit 1 even when the api actually started fine (race between an
`api` container recreate during the `web` build step and an 8s fixed sleep before
the readiness check). If it fails, check step 3 before assuming the deploy is
actually broken.

## 3. SSH in, confirm the box is on the right commit

```
ssh -i C:\Users\dell\.ssh\id_ed25519 ubuntu@<EC2_IP>
cd /opt/clickup/kinetix-staging
git log -1 --oneline
docker compose -f docker-compose.staging.yml ps
curl -fsS http://127.0.0.1/staging/auth/login -o /dev/null -w "%{http_code}\n"
```
If containers are up and that curl returns 200, the deploy landed even if the
Action reported failure — just double check host nginx picked it up:
```
sudo nginx -t
sudo systemctl reload nginx
```
(nginx runs on the host now, not as a container — see
`deploy/NGINX_HOST_MIGRATION.md`.)

## 4. Get any new/updated scripts onto the box

Only needed if this PR added/changed files under `backend-py/scripts/` — the
docker image doesn't bake that folder in, and `git reset --hard` on the server
already pulled committed changes, so this step is normally a no-op. Only needed
for files not yet committed at deploy time (shouldn't happen in normal flow).

## 5. Ensure the venv inside the api container has what migrations need

```
api_id=$(docker compose -f docker-compose.staging.yml ps -q api)
docker exec -it "$api_id" uv pip install --python /app/.venv/bin/python psycopg2-binary
```
(`psycopg2` isn't in `pyproject.toml`; most migration scripts need it. Safe to
run every time — instant no-op if already installed.)

## 6. Copy scripts into the running container

```
docker cp backend-py/scripts/. "$api_id":/app/scripts/
```

## 7. Check schema drift — this tells you exactly what to run, don't guess

```
docker exec -it "$api_id" sh -c "export DATABASE_URL=\"postgresql://\${POSTGRES_USER}:\${POSTGRES_PASSWORD}@postgres:5432/\${POSTGRES_DB}\"; cd /app && /app/.venv/bin/python scripts/check_schema_drift.py"
```
Prints `MISSING` for every table/column the ORM models expect but the DB
doesn't have yet — exactly what breaks pages at runtime — and, next to each
finding, which `run_*_migration.py` fixes it. Ends with a copy-pasteable
summary block, e.g.:
```
Schema drift found. Scripts to run:
  python scripts/run_folder_list_privacy_migration.py
  python scripts/run_share_grants_migration.py
```
If a table's `.sql` file has no `run_*.py` wrapping it yet, it prints
`MANUAL: <file>.sql (no run_*.py wraps it - run via psql directly)` instead —
write the missing runner script (see existing `run_*_migration.py` for the
pattern) rather than hand-running SQL, so it's covered next time too.

## 8. Run each script the drift check listed

```
docker exec -it "$api_id" sh -c "export DATABASE_URL=\"postgresql://\${POSTGRES_USER}:\${POSTGRES_PASSWORD}@postgres:5432/\${POSTGRES_DB}\"; cd /app && /app/.venv/bin/python scripts/<name_from_step_7>.py"
```
Stop and inspect if any one fails before running the next — they aren't
chained in one transaction.

## 9. Re-run drift check — must come back clean

```
docker exec -it "$api_id" sh -c "export DATABASE_URL=\"postgresql://\${POSTGRES_USER}:\${POSTGRES_PASSWORD}@postgres:5432/\${POSTGRES_DB}\"; cd /app && /app/.venv/bin/python scripts/check_schema_drift.py"
```
Expect: `No drift - DB schema matches all ORM models.`

## 10. Verify

```
curl -fsS http://127.0.0.1/staging/auth/login -o /dev/null -w "%{http_code}\n"
docker compose -f docker-compose.staging.yml logs api --tail 50
```
Then manually exercise the feature at `http://3.140.5.67/staging`.

## Notes

- If a migration script fails with `ModuleNotFoundError: No module named 'pydantic_settings'`,
  you used `sh -lc` (login shell) instead of `sh -c` — login shells re-source
  `/etc/profile` and drop the venv from `PATH`. Always use `sh -c`, or call
  `/app/.venv/bin/python` directly (as above).
- Copying files up: use a **separate** terminal window for `scp` — you can't
  scp from inside the SSH session into itself.
