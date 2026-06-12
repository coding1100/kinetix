# Kinetix

Monorepo with **frontend** (Next.js UI) and **backend-py** (FastAPI + PostgreSQL API).

## Structure

```
clickup/
  frontend/         # Next.js — Home + Chat UI
  backend-py/       # FastAPI API — auth, workspaces, home, chat, Socket.IO
  docker-compose.yml
```

## Phase status

| Phase | Scope | Status |
|-------|--------|--------|
| 1 | Home + Chat UI with mock data | Done |
| 2A | Auth, workspaces, invites, Postgres (backend) | Done |
| 2A-FE | Auth guards, refresh, workspace switcher, invite accept | Done |
| 2B | Home APIs | Done |
| 2C | Chat REST APIs | Done |
| 2D | Real-time (Socket.IO) | Done (Python) |
| PY-1 | Python API (`backend-py`) — auth parity | Done |
| PY-2 | Python API — workspaces + invites | Done |
| PY-3 | Python API — home APIs | Done |
| PY-4 | Python API — chat REST APIs | Done |
| PY-5 | Python API — real-time chat (Socket.IO) | Done |
| **3** | Spaces hub, List/Board/Calendar, hierarchy CRUD, link task, mark unread | Done |

## Frontend

```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:3001](http://localhost:3001) → `/home/inbox` and `/chat` (live APIs when backend is running).

## Google sign-in (local)

1. [Google Cloud Console](https://console.cloud.google.com/apis/credentials) → **OAuth 2.0 Client ID** (Web).
2. **Authorized redirect URI:** `http://localhost:4001/api/v1/auth/google/callback`
3. Add **Test users** (your Gmail) while the app is in **Testing** mode.
4. In `backend-py/.env`:

```env
GOOGLE_CLIENT_ID="your-client-id.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="your-secret"
API_PUBLIC_URL="http://localhost:4001"
FRONTEND_URL="http://localhost:3001"
```

5. Apply DB migration once: run `backend-py/scripts/migrate_google_oauth.sql` via `psql` or any SQL client.
6. Restart `backend-py`, open [http://localhost:3001/auth/login](http://localhost:3001/auth/login) → **Continue with Google**.

**Verify:** `GET http://localhost:4001/health` must include `"googleOAuth": { "routesRegistered": true }`. If that field is missing, an old API process is still on port 4001 — stop all uvicorn windows, then from `backend-py` run `.\scripts\start-api.ps1` (or start uvicorn once manually).

**Tests:**

```bash
cd backend-py && python -m pytest tests/test_google_oauth.py -v
cd frontend && npm run test
```

## Database (Docker PostgreSQL)

Local and production use the same [`docker-compose.yml`](docker-compose.yml) (Postgres 16 Alpine).

### Local setup

```bash
cp docker-compose.env.example docker-compose.env
docker compose up -d postgres

cd backend-py
cp .env.example .env
# Set DATABASE_URL to match POSTGRES_* in docker-compose.env
uv sync
uv run uvicorn app.main:app --reload --port 4001
```

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | `postgresql://USER:PASS@127.0.0.1:5432/DBNAME` — API runtime connection |

Schema changes: run SQL files in `backend-py/scripts/` via `psql` or a migration runner script.

### Migrate from Supabase (one-time, on EC2)

```bash
pg_dump "$SUPABASE_DIRECT_URL" --format=custom --no-owner --no-acl -f supabase.dump
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d postgres
pg_restore --dbname="postgresql://riseup:PASS@127.0.0.1:5432/riseup" --no-owner --no-acl supabase.dump
```

Update `backend-py/.env` `DATABASE_URL` to the local Docker URL, then restart the API.

## Backend (Phase 2A — legacy Express)

The Node/Express `backend/` folder is no longer in this repo. Use **backend-py** (FastAPI) instead.

API (legacy docs): [http://localhost:4000](http://localhost:4000)

### Health & docs

- `GET /health`
- `GET /api/v1` — endpoint index

### Auth (`/api/v1/auth`)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/signup` | Create user + default workspace (owner flow) |
| POST | `/login` | Login, returns access token + refresh cookie |
| POST | `/refresh` | Rotate access token (uses httpOnly cookie) |
| POST | `/logout` | Clear refresh session |
| GET | `/me` | Current user + workspaces (Bearer token) |
| POST | `/forgot-password` | Request reset (dev returns token in response) |
| POST | `/reset-password` | Set new password with token |

### Workspaces (`/api/v1/workspaces`)

Requires `Authorization: Bearer <accessToken>`.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | List user's workspaces |
| POST | `/` | Create workspace |
| GET | `/:workspaceId` | Workspace detail |
| PATCH | `/:workspaceId` | Update name (owner/admin) |
| GET | `/:workspaceId/members` | List members |
| POST | `/:workspaceId/invites` | Send invite |

### Invites (`/api/v1/invites`)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/:token` | Preview invite (public) |
| POST | `/:token/accept` | Accept as logged-in user (Bearer) |
| POST | `/:token/accept-signup` | Accept + create account (invitee flow) |

### Workspace invite email (SMTP)

People → **Invite people** sends a real email when SMTP is set in `backend-py/.env` (see `.env.example`). `GET /health` includes `smtp.configured`.

**Gmail example:** App Password + `SMTP_HOST=smtp.gmail.com`, `SMTP_PORT=587`, `SMTP_USE_TLS=true`, `SMTP_FROM="Kinetix <you@gmail.com>"`.

If SMTP is not configured, invites are still created and the invite link is copied to the clipboard.

### Seed credentials

- `owner@demo.com` / `password123`
- `alex@demo.com` / `password123`
- Workspace: **Acme Demo**

### Database

- **Provider:** PostgreSQL 16 in Docker (`docker compose up -d postgres`)
- **Runtime:** `DATABASE_URL` → `127.0.0.1:5432`
- **Migrations:** SQL scripts in `backend-py/scripts/`
- **Backups (production):** `deploy/backup-postgres.sh` (cron + optional S3 upload)

## Python API (`backend-py`) — Phases PY-1 & PY-2

Parallel FastAPI backend. Runs on **port 4001** so Express can stay on **4000**.

```bash
# Install uv: https://docs.astral.sh/uv/getting-started/
cd backend-py
copy ..\\backend\\.env .env   # then set PORT=4001
uv sync
uv run uvicorn app.main:app --reload --port 4001
```

**Swagger UI:** [http://localhost:4001/docs](http://localhost:4001/docs) — try login, copy `accessToken`, click **Authorize**, then call workspace routes.

**ReDoc:** [http://localhost:4001/redoc](http://localhost:4001/redoc)

Test against Python API:

```env
NEXT_PUBLIC_API_URL=http://localhost:4001/api/v1
```

Implemented: auth, workspaces, invites (same JSON/cookies as Express). Next: home + chat (PY-3/4).

## EC2 production deploy (automated)

Pushes to `main` deploy automatically via GitHub Actions (`.github/workflows/deploy-ec2.yml`).

### One-time EC2 setup

```bash
sudo apt update
sudo apt install -y git nginx docker.io docker-compose-plugin postgresql-client
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
sudo usermod -aG docker ubuntu

sudo mkdir -p /opt/clickup
sudo chown ubuntu:ubuntu /opt/clickup
git clone git@github.com:coding1100/kinetix.git /opt/clickup/kinetix
cd /opt/clickup/kinetix

# Postgres credentials (never commit)
cp docker-compose.env.example docker-compose.env
nano docker-compose.env

# Backend env (never commit .env)
cp backend-py/.env.example backend-py/.env
nano backend-py/.env
# DATABASE_URL must match docker-compose.env (127.0.0.1:5432)

# Frontend env
nano frontend/.env.local
# NEXT_PUBLIC_API_URL=/api/v1
# NEXT_PUBLIC_APP_URL=http://YOUR_EC2_IP
# NEXT_PUBLIC_SOCKET_URL=http://YOUR_EC2_IP

chmod +x deploy/setup-services.sh deploy/deploy.sh deploy/backup-postgres.sh
./deploy/setup-services.sh
./deploy/deploy.sh

# Optional: daily backup at 3am
# (crontab -e) 0 3 * * * /opt/clickup/kinetix/deploy/backup-postgres.sh
```

### GitHub repository secrets

Add in **Settings → Secrets and variables → Actions**:

| Secret | Example |
|--------|---------|
| `EC2_HOST` | `3.140.5.67` |
| `EC2_USER` | `ubuntu` |
| `EC2_SSH_KEY` | Full contents of your `.pem` private key |
| `EC2_APP_PATH` | `/opt/clickup/kinetix` (optional; this is the default) |

Allow the deploy key: add the public key that matches `EC2_SSH_KEY` to `~/.ssh/authorized_keys` on EC2 (or use the EC2 instance key pair).

### After secrets are set

- Every `git push` to `main` runs `deploy/deploy.sh` on EC2 (pull, build, health checks, restart).
- Manual deploy: **Actions → Deploy to EC2 → Run workflow**.

The deploy script stops `next dev`, builds production frontend, reloads nginx, and fails if Turbopack/dev mode is detected.

## Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js, React, TypeScript, Tailwind, shadcn/ui, Zustand |
| Backend (current) | Node.js, Express, TypeScript, Prisma, PostgreSQL, Zod, JWT |
| Backend (migration) | Python 3.12, uv, FastAPI, SQLAlchemy, asyncpg, Pydantic |
| Backend (migration) | Python 3.12, uv, FastAPI, SQLAlchemy, asyncpg, Pydantic |
| Backend (migration) | Python 3.12, uv, FastAPI, SQLAlchemy, asyncpg, Pydantic |
| Backend (migration) | Python 3.12, uv, FastAPI, SQLAlchemy, asyncpg, Pydantic |
| Backend (migration) | Python 3.12, uv, FastAPI, SQLAlchemy, asyncpg, Pydantic |
| Backend (migration) | Python 3.12, uv, FastAPI, SQLAlchemy, asyncpg, Pydantic |
| Backend (migration) | Python 3.12, uv, FastAPI, SQLAlchemy, asyncpg, Pydantic |
