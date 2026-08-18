# Production Hardening Plan And Report

## 1. Backend authorization - done
- Task attachments now require list/task access before presign, upload, and complete.
- Private task utility paths now load tasks with list permission checks for LineUp, follow, activity, notifications, and read-all flows.
- Socket typing events now require channel/DM membership before broadcasting.
- Disabled users are blocked from login, refresh, OAuth exchange, admin login, and admin refresh.
- OAuth redirects now expose generic error codes only; raw production exception prints were replaced with logging.

## 2. Auth/session storage - done
- Browser and admin refresh sessions now use HttpOnly cookies.
- Refresh endpoints are cookie-only; refresh request-body schemas were removed.
- Frontend and admin auth stores are memory-only for access tokens and no longer persist session tokens.
- Login/signup/OAuth/admin pages no longer write token material into localStorage.

## 3. Frontend reliability and UX - done
- Notification fetch failures preserve stale data and show retry/error state.
- Notification refreshes are deduplicated and stale/out-of-order responses cannot overwrite newer workspace state.
- Realtime notifications are rejected until the active workspace is known and must match it exactly.
- Message image thumbnails open in an in-app lightbox popup instead of a new tab.
- Image preview is no longer wrapped in a link; download remains a separate explicit action.
- Exposed mock SyncUp and schedule-message flows were removed from production UI.

## 4. Cleanup and guardrails - done
- Production npm advisories are fixed in frontend and admin-frontend lockfiles.
- Tauri remote-app CSP is explicit instead of disabled.
- Staging deploy creates the missing Docker edge network and the Next API proxy is dynamic.
- Docker startup now applies a versioned, checksum-protected SQL migration manifest before boot.
- Platform admins are split into STAFF and SUPER_ADMIN; destructive/admin-grant actions require SUPER_ADMIN.
- Upload endpoints now read multipart data in chunks with early cutoff.
- Auth throttles cover IP and account dimensions for login, signup, refresh, and password reset flows.
- `frontend/src-tauri/target/**` is untracked and ignored.
- Hardcoded database credentials were removed from `backend-py/scripts/test_db_hosts.py`.

## 5. Verification
- `python -m compileall -q app scripts tests` passed.
- `npx tsc --noEmit` passed in `frontend`.
- `npx tsc --noEmit` passed in `admin-frontend`.
- `npm test -- --run` passed in `frontend`: 17 files, 63 tests.
- `npm audit --omit=dev --json` reports 0 production vulnerabilities in `frontend`.
- `npm audit --omit=dev --json` reports 0 production vulnerabilities in `admin-frontend`.
- `git diff --check` passed.

## 6. Remaining operational note
- Backend pytest could not run in the current shell because this Python environment is missing installed backend dependencies such as SQLAlchemy. The source compiles cleanly, and the affected auth tests were updated to assert the new cookie-only refresh contract.
- The migration runner is source-verified but still requires a staging database boot to validate the complete ordered SQL manifest against the deployed PostgreSQL version.
- The built-in auth throttle is process-local. A multi-worker or multi-instance production deployment should put the same limits at the edge or back them with shared Redis storage; the local limiter remains a protection layer for single-process deployments and development.

## 7. Dead-code and coming-soon cleanup - done
- Removed unused frontend mock data modules and the obsolete one-off migration runner scripts.
- Removed actionless profile tools, workspace-management toast placeholders, hidden global navigation entries, mock composer success paths, and unsupported Phase 3 channel/thread controls.
- Team detail tabs now render live analytics, priorities, team chart, standup, workload, and timesheet views from authorized task/team data.
- Workspace Org Chart and Analytics routes now render live workspace data.
- Team bookmarks are persisted through a permission-checked backend model/API and included in the versioned migration gate.
- DM Priorities opens the task view and SyncUp sends an authorized real DM request.
- Channel replies, mark-unread, and channel image files use live APIs; image files open in an in-app popup with an explicit download action.
- Deployment runbooks now describe only the versioned migration gate and no longer reference deleted migration runners.

## 8. Final verification status
- Frontend TypeScript and admin-frontend TypeScript pass.
- Backend `compileall` passes.
- Frontend tests pass: 17 files, 63 tests.
- Frontend lint has zero errors after removing the render-time `Date.now()` violation; existing React hook guidance remains as warnings and should be reduced in a separate lint-hardening pass.
- Static scan finds no production-source `coming soon`, mock-send, mock-data import, Phase 3 placeholder, or deleted migration-runner references in the audited paths.
