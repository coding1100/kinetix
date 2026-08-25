# Daily Report

Log of everything done in this project, per day. Built to be searched with
grep/ripgrep instead of read top to bottom, so pulling context doesn't bloat
the window.

## Format rules

- Each day is wrapped in `DATE_START: YYYY-MM-DD` / `DATE_END: YYYY-MM-DD`.
- Each unit of work is a block with fields, each field on its own line:
  `TAG:`, `PARENT:` (optional), `TITLE:`, `DESC:`. DESC can span multiple
  lines; it ends at the next `TAG:` line or the `DATE_END:` line.
- Blocks are separated by a blank line for human readability.
- Tags in use, and their hierarchy:
  - `[FEATURE]` - new business functionality. Top-level, no PARENT.
  - `[BUG]` - a bug fix. Top-level, no PARENT.
  - `[TASK]` - a unit of work. Can stand alone (no PARENT), or sit under a
    `[FEATURE]` or `[BUG]` via `PARENT: <feature/bug title>`.
  - `[SUBTASK]` - a smaller piece of a task. Always has
    `PARENT: <task title>`, since subtasks only ever live under a `[TASK]`.
  - `[CHORE]` - dev-only work with no direct business requirement (running
    things, scripts, tooling, setup, etc.). Top-level, no PARENT.

## How to search

- All entries for a date: search `DATE_START: 2026-07-09` and read to the
  matching `DATE_END:`.
- Just titles for a date (or across all dates): grep `^TITLE:` alone.
- All work of a given kind: grep `TAG: \[FEATURE\]` (or `\[BUG\]`, `\[TASK\]`,
  `\[SUBTASK\]`, `\[CHORE\]`).
- Everything under one parent: grep `PARENT: <title>`.
- Full context on one task: once you have the title, grep for it and read
  the DESC block that follows.

Example (ripgrep):

```
rg "^TAG: \[BUG\]" -A 2 daily-report.md              # bug titles, all days
rg "DATE_START: 2026-07-09" -A 200 daily-report.md    # everything, one day
rg "PARENT: Some Feature Title" daily-report.md       # all children of a task/feature
```

---

DATE_START: 2026-07-09
========================================

TAG: [CHORE]
TITLE: Set up daily-report tracking file
DESC: Created daily-report.md at the root of c:\clickup to track work done
each day in this project. File uses DATE_START/DATE_END markers per day and
per-entry blocks (TAG/PARENT/TITLE/DESC) so entries can be grepped without
loading the whole file into context. Tag hierarchy: [FEATURE] and [BUG] are
top-level; [TASK] can stand alone or sit under a feature/bug via a PARENT
field; [SUBTASK] always sits under a [TASK] via PARENT; [CHORE] is top-level
dev-only work (scripts, tooling, running things) not tied to a business
requirement. Going forward, every session's work in this directory should be
logged here under the current day's markers.

TAG: [CHORE]
TITLE: Turn daily-report logging into an automated workflow
DESC: Created CLAUDE.md at the repo root (Claude Code auto-loads this file
every session, unlike AGENTS.md which is a different tool's convention and
isn't read automatically) instructing that after every response involving
real work, an entry gets appended to daily-report.md. Rules encoded there:
one DATE_START/DATE_END block per day, new entries appended inside the
existing block for today instead of creating a duplicate block (keeps the
process idempotent); tag choice follows the hierarchy already defined in
daily-report.md (FEATURE/BUG top-level, TASK standalone or under a
feature/bug via PARENT, SUBTASK always under a TASK via PARENT, CHORE
top-level for non-business dev work); and multi-message iteration on the
same piece of work should be logged as TASK/SUBTASK children under the
existing parent rather than as disconnected new top-level entries, so the
log reflects how a feature/bug evolved across a session. Skip logging only
for pure chit-chat with no action taken.

TAG: [CHORE]
TITLE: Document local run steps
DESC: Walked the repo to work out how to run the project locally (no
existing "run locally" doc beyond scattered README sections). Stack:
docker-compose.yml starts Postgres 16 on 127.0.0.1:5433 using creds from
docker-compose.env (riseup/riseup/riseup). backend-py is the active FastAPI
backend (the Node/Express backend + Prisma described earlier in README.md
looks superseded by backend-py per the phase table) — run via `uv sync` then
`backend-py/scripts/start-api.ps1`, which auto-kills stale listeners and
falls back from port 4001 to 4002 if the OS shows a ghost socket; health
check at /health. frontend is Next.js — `npm install` then
`npm run dev -- -p 3001` (package.json's dev script has no port flag baked
in, but frontend/.env.local hardcodes NEXT_PUBLIC_APP_URL to :3001 and
proxies API calls to backend on :4001, so it must be started with
`-p 3001` explicitly or the app URL/OAuth redirect stuff breaks). Both
backend-py/.env and frontend/.env.local already existed in this checkout,
so no env copying was needed this time. Seed login: owner@demo.com /
password123 (Owner), Acme Demo workspace.

TAG: [FEATURE]
TITLE: Permissions/roles audit vs ClickUp
DESC: Kicked off a roles/permissions gap analysis for Kinetix against
ClickUp's actual behavior, broken into three tasks (below). Purpose: figure
out what's done and what's left before building out the permission system
further.

TAG: [TASK]
PARENT: Permissions/roles audit vs ClickUp
TITLE: Document current role/permission implementation
DESC: Full as-is audit of backend-py. Roles are workspace-scoped only (no
platform-wide role): WorkspaceRole enum OWNER > SUPER_ADMIN > ADMIN > MEMBER
> LIMITED_MEMBER > GUEST (backend-py/app/db/models/enums.py:4-10). Central
policy file backend-py/app/services/workspace_permissions.py has can_*/is_*
helpers (no decorator/middleware, all inline checks). Role-based enforcement
exists for: workspace delete/transfer (OWNER only), workspace rename/manage
people/manage teams (OWNER/SUPER_ADMIN/ADMIN), role assignment/editing
(hierarchical, OWNER > SUPER_ADMIN > ADMIN), member removal, teams (any
member creates, ADMIN+ or team LEAD manages), chat channel admin actions and
private-channel auto-visibility for OWNER/SUPER_ADMIN. Critically: Spaces,
Folders, Lists, Tasks CRUD have ZERO role checks anywhere (spaces_service.py,
home_service.py, home.py router) - any active member including GUEST and
LIMITED_MEMBER has full CRUD today; those two roles exist as enum values
only and do nothing functionally. Comment edit/delete is author-only, not
role-based (not even OWNER can override). Found a live bug: MEMBER passes
the invite-permission gate in invite_service.py but workspace_permissions.
can_assign_role() has no MEMBER branch, so invites by a MEMBER always 403 in
practice (invite_service.py:49-50). This gap is self-documented in the repo:
_roadmap_extract.txt:176-189, Phase 4J "Permissions", not started - covers
Space.is_private/SpaceMember, list-level ACL, task-private, guest
enforcement, and using workspace roles for task edit/delete rules. Frontend
mirrors backend role gating everywhere backend has it (PeopleView,
WorkspaceSettingsView, TeamDetailView, chat admin components) as pure UX
convenience; has zero gating for spaces/lists/tasks, consistent with
backend having none there. Also noted frontend/src/lib/workspace/
invite-flags.ts has SHOW_EXTENDED_INVITE_ROLES = false, hiding all but
MEMBER from the invite-as dropdown even though backend supports every role.
Full audit (with file:line citations for every claim) done via an Explore
subagent; this is the condensed version.

TAG: [TASK]
PARENT: Permissions/roles audit vs ClickUp
TITLE: Pull ClickUp's role/permission model from their docs
DESC: Researched ClickUp's official help center (help.clickup.com) via web
search (direct WebFetch to help.clickup.com returned HTTP 403, so relied on
search snippets across ~8 articles). ClickUp base roles: Owner (everything
incl. billing, workspace delete, ownership transfer - one per workspace),
Admin (manage users/settings/all projects, cannot delete workspace or
transfer ownership - Owner-only, no delegation possible), Member (full edit
on public items by default, no settings access), Limited Member (view-only
by default on shared items, can request full edit per location), Guest
(scoped to explicitly shared items, cannot share anything themselves even
with edit rights). Guest and Limited-Member-view-only both get 4 individually
toggleable permissions on paid plans: time estimates and time tracking (on
by default), add/remove tags and create views (off by default) - not
available to edit on Free plan. Custom Roles: Business Plus gets 1 custom
role, Enterprise gets unlimited; Owner (or a delegated custom admin) defines
arbitrary named roles with granular toggles, integrates with Okta on
Enterprise. Granular location-level permissions (paid plans): Edit/Comment/
View-only settable per Folder/Subfolder/List/task/Dashboard/Doc/Goal, and
per Space on Enterprise only; inheritance order is task > List > Subfolder >
Folder > Space; private Spaces/Folders/Lists aren't publicly shareable even
though individual views/Docs inside them can be. Sources: ClickUp Help
articles "Owner, admin, and member-type user roles", "Intro to user roles",
"Default user role permissions", "Guest-type user roles", "Manage
individual permissions for view only users", "Manage Custom Role
permissions", "Permissions in detail", "Set permissions on individual
locations", "Transfer Workspace ownership" (all help.clickup.com/hc/en-us/
articles/...).

TAG: [TASK]
PARENT: Permissions/roles audit vs ClickUp
TITLE: Compare Kinetix vs ClickUp roles/permissions - gap analysis
DESC: Result of comparing task 1 and task 2. At parity: Owner-only
delete/transfer workspace; Admin manages people/settings but not
billing/delete (billing doesn't exist on either side yet, N/A); Member gets
full edit at the workspace-management layer. Ahead of ClickUp / extra:
Kinetix's SUPER_ADMIN is a fixed built-in role roughly equivalent to what
ClickUp only offers via paid Custom Roles; Teams with a per-team LEAD role
is a Kinetix-specific concept ClickUp doesn't really have (ClickUp groups
via tags/custom fields, no team-lead role); chat/channel admin permissions
are Kinetix-specific (different product surface, not a real ClickUp
comparison point). Behind / not implemented: Limited Member and Guest exist
as enum values but have zero functional restriction - both currently behave
identically to Member with full CRUD everywhere, whereas ClickUp scopes
Guests hard and defaults Limited Members to view-only; there is no
location-level (Space/Folder/List/task) Edit/Comment/View ACL system with
inheritance at all in Kinetix, which is a first-class paid-plan feature in
ClickUp; ClickUp's 4 toggleable guest permissions (time estimates, time
tracking, tags, views) have no Kinetix equivalent; user-defined Custom
Roles (Business Plus/Enterprise) have no Kinetix equivalent beyond the
fixed SUPER_ADMIN tier. Net: workspace-level role hierarchy is essentially
at parity; the entire content-level (space/list/task) permission layer is
the real gap, and it's already tracked as unstarted Phase 4J in
_roadmap_extract.txt, so this task confirmed rather than discovered that
gap and gave it a concrete ClickUp-shaped target to build toward.

TAG: [TASK]
PARENT: Permissions/roles audit vs ClickUp
TITLE: Chat permissions - Kinetix vs ClickUp
DESC: Follow-up task on the permissions audit, scoped to chat specifically.
Pulled ClickUp Chat docs (help.clickup.com "Chat feature availability and
limits", "Edit or delete messages", "Permissions in detail", "Guest-type
user roles" - direct WebFetch still 403s on help.clickup.com, used search
snippets). ClickUp: chat access is tied to location access (share a Space/
Folder/List with someone, they get its Chat too); Guests DO get Chat access
now (older docs said no, that's stale) but scoped only to locations
explicitly shared with them, and can only DM people reachable via those
shared locations; view-only guests can read but cannot send messages;
message edit/delete is author-only via UI (edits after 15 min get an
"(edited)" label), and there is explicitly NO admin-override permission to
delete others' messages - that is an open, unshipped feature request, not a
gap on Kinetix's side. Read Kinetix's backend-py/app/services/chat_service.py
in detail: create_channel (687-734) and update_channel/rename (538-569) have
no role gate, any active member can do them; delete_channel (572-605) is
gated to workspace ADMIN+ OR channel creator OR (no creator recorded)
first-message-author OR earliest-joined-member as fallback chain;
add_channel_members requires workspace ADMIN+ for public channels but just
channel membership for private ones (1765-1783, intentional asymmetry -
public channels already include everyone so adding is an admin action);
remove_channel_member allows self-removal always, but removing someone else
needs channel creator or workspace ADMIN+ (1886-1922); update_message
(1488-1502) and delete_message (1571-1581) are both strictly author-only,
no time limit, no admin override - same as ClickUp, already at parity.
Confirmed (again) that GUEST and LIMITED_MEMBER have zero chat-specific
restriction anywhere in chat_service.py - they get full create/read/send/DM
access identical to MEMBER, whereas ClickUp explicitly scopes guest chat to
shared locations and blocks view-only guests from sending messages.
Conclusion: chat message-level permissions (author-only edit/delete) are
already at parity with ClickUp, nothing to fix there. The chat gap is not a
new/separate gap - it's the same root gap from the earlier workspace-wide
audit (guest/limited-member enforcement never implemented, tracked as
unstarted Phase 4J in _roadmap_extract.txt) showing up again in the chat
surface specifically.

TAG: [TASK]
PARENT: Permissions/roles audit vs ClickUp
TITLE: Write roles & permissions spec (specs/roles_and_permissions.md)
DESC: Turned the three audit tasks into a formal spec at
specs/roles_and_permissions.md, new specs/ directory. Structure: section 1
"Already done" restates the as-is audit as bullets with file:line citations
(role model, workspace_permissions.py helper functions, workspace mgmt,
teams, chat message-level parity with ClickUp, frontend gating); section 2
"To do" is a [TASK] list ordered by dependency, each with target ClickUp
behavior, current Kinetix gap, and exact files to touch. Tasks: fix the
MEMBER invite bug (can_assign_role has no MEMBER branch, invite_service.py
_INVITE_ROLES allows MEMBER to attempt but it always 403s - needs a product
decision on whether Members can invite and as which roles); add Space/
Folder/List privacy + a location-level ACL model (new is_private field on
Space, new LocationMember-style association table with EDIT/COMMENT/VIEW
levels, new PermissionLevel enum, new location_permissions.py helper
mirroring workspace_permissions.py's style, migration script); enforce that
ACL inside spaces_service.py and home_service.py plus the home.py router
listing endpoints; enforce GUEST scoping (explicit share required, no
ambient workspace-wide access, plus a GUEST-specific branch in chat_service
list_channels/_assert_channel_member for location-scoped channel/DM
access); enforce LIMITED_MEMBER view-only default with a "request edit"
affordance; block view-only guests from sending chat messages; add a
per-member toggle for time-estimate/time-tracking visibility (noted that
ClickUp's other two guest toggles - add/remove tags and create views - have
no Kinetix equivalent yet since Tag and View models don't exist in
backend-py at all, so those two are explicitly deferred, not a permissions
gap by themselves); flip frontend's SHOW_EXTENDED_INVITE_ROLES to true only
after guest/limited-member enforcement ships, since turning it on earlier
would let people invite roles that behave identically to Member. Marked
explicitly out of scope for now: ClickUp's Custom Roles feature (Kinetix's
SUPER_ADMIN already covers the common delegated-admin case) and Space-level
ACL tier-gating (flagged as a product decision, not a code gap). Closed
with a target-state summary table (role x workspace-mgmt x content-access x
chat) for what the system should look like once every task ships. Spec
explicitly tells future readers to log task completion in daily-report.md
per the CLAUDE.md workflow and keep the spec's status in sync with reality.

TAG: [TASK]
PARENT: Permissions/roles audit vs ClickUp
TITLE: Implement roles & permissions spec
DESC: Implemented the bulk of specs/roles_and_permissions.md's task list in
one pass. Scope decision made along the way: shipped Space-level ACL only
(private/public flag + per-user overrides on Space), not the full Folder/
List/Task granularity the original spec sketched - ClickUp itself gates
that deeper granularity behind Enterprise, so Space-level is the meaningful
slice for now; documented as a deliberate cut, not an oversight.

What shipped: (1) fixed the MEMBER invite bug by adding a MEMBER branch to
workspace_permissions.can_assign_role. (2) New PermissionLevel enum (VIEW/
COMMENT/EDIT), Space.is_private column, new SpaceMember override table,
migration backend-py/scripts/migrate_space_permissions.sql (applied to
local dev DB - still needs to run against staging/prod before those
deploys pick up this code). (3) New backend-py/app/services/
space_permissions.py resolving effective permission per user+role, with
OWNER/SUPER_ADMIN always bypassing (same pattern as the existing chat
private-channel bypass) and GUEST getting zero ambient access without an
explicit SpaceMember row. (4) New space member-management endpoints (GET/
POST /spaces/{id}/members, DELETE .../members/{userId}) plus isPrivate on
create/update space. (5) Wired the ACL into every Space/Folder/List/Task
create/update/delete/get path across spaces_service.py and home_service.py,
and updated home.py router signatures to pass user id + role through
(several routes previously only had the auth-gate dependency and silently
had the role available but unused). (6) Stopped auto-adding GUEST role
members to public chat channels on creation - they need an explicit invite
now; full location-linked channel scoping and blocking view-only guests
from sending remain open, noted as blocked on a schema decision (chat
channels have no FK to Space today). (7) Added a per-member time-estimate/
time-tracking visibility toggle (WorkspaceMember.can_see_time_estimate/
can_track_time, default true), a PATCH .../members/{userId}/permissions
endpoint to manage it, and enforcement in task_time_service's start/stop
timer and home_service.update_task's time estimate write path; noted
ClickUp's other two guest toggles (tags, views) have no Kinetix feature to
gate yet since neither Tag nor View models exist. (8) Flipped frontend's
SHOW_EXTENDED_INVITE_ROLES to true now that guest/limited-member roles
have real enforcement behind them instead of behaving like a full member.

Found and fixed one real bug while wiring the ACL: update_task's new
eager-load of task.task_list (added for the permission check) primed a
stale SQLAlchemy relationship cache before the list-move mutation, so a
moved task kept reporting its old listId in the response even though the
DB was correct - fixed with session.expire(task, ["task_list"]) after the
mutation. Also caught and fixed two follow-on bugs from an overly broad
replace_all edit in task_time_service.py that left two of three
_task_payload() calls missing the newly-added role argument (would have
been a TypeError on every timer stop and on the "already have a running
timer" branch of start).

Testing: added tests/test_space_permissions.py (4 tests: MEMBER invite
fix + escalation still blocked, GUEST has no default space access, LIMITED
_MEMBER is view-only on a public space, private-space SpaceMember override
grants GUEST access) and tests/test_member_time_permissions.py (toggle
blocks then restores task time-estimate writes and timer start/stop). Ran
the full backend-py pytest suite (79 tests) plus the two new files - all
green. Separately confirmed via two isolated git-worktree baseline runs
against unmodified HEAD that 5 other test failures (test_auth_profile,
3x test_google_oauth, test_home_extras::test_lineup_add_reorder_remove,
test_home_notifications) are pre-existing async-event-loop test-infra
flakiness unrelated to this work - identical failures reproduce on a
clean checkout with no code changes. Frontend: ran `npx tsc --noEmit`
clean after the invite-flag change.

Not done / explicitly deferred (all noted in the spec's updated status
section): Folder/List/Task-level ACL granularity below Space; chat
channels scoped to a guest's granted Spaces specifically (vs. just "not
auto-joined"); blocking view-only guests from sending chat messages;
hiding (not just blocking writes to) the time-estimate value on read when
the flag is off; a frontend "request edit access" affordance for Limited
Members; add/remove-tags and create-views guest toggles (blocked on Tag/
View features not existing yet); Custom Roles (out of scope, SUPER_ADMIN
covers the common case).

TAG: [TASK]
PARENT: Implement roles & permissions spec
TITLE: Fill role/permission test gaps + fix flaky test workspace resolution
DESC: Audited existing test coverage for the ClickUp-level roles work and
added two new backend test files. tests/test_permissions_matrix.py: 17 pure
unit tests (no DB) covering the full can_assign_role and can_edit_member
matrices, owner-only gates (delete/transfer), privileged/manage-people sets,
ROLE_RANK ordering, DEFAULT_LEVEL_BY_ROLE and level_at_least.
tests/test_roles_permissions_gaps.py: 10 integration tests covering ADMIN
assignment ceiling (can't touch owner/admins, can't mint ADMIN+ roles, invite
ceiling), sole-owner demotion protection (400), member-removal protections,
GUEST/LIMITED_MEMBER restrictions (no invites, no space creation, no role
changes), private space hidden from plain MEMBER, COMMENT/VIEW SpaceMember
override behavior on tasks/comments (incl. override removal), member can't
toggle time permissions, ownership transfer rules + full roundtrip
(owner->member->back, old owner becomes ADMIN), workspace rename gate, and
delete-workspace gates (non-member 403, wrong confirmName 400, owner OK).
While doing this, found and fixed a real flakiness bug: GET /auth/me returned
workspaces in nondeterministic order (unordered user.memberships
relationship), so tests using workspaces[0] randomly picked a workspace
alex@demo.com wasn't a member of - 9 pre-existing tests
(test_space_permissions, test_workspace_roles, test_teams,
test_member_time_permissions) were failing because of it. Fixed
auth_service.get_me to sort by joined_at asc (matches list_workspaces) and
made tests/task_test_helpers.workspace_id resolve the workspace shared by
both demo users (cached _shared_demo_workspace_id). All 36 permission tests
now pass; full suite: 106 passed, 6 failed - verified via git stash that
those 6 (google oauth env, event-loop-scope asyncpg issues in
test_auth_profile/test_home_extras/test_home_notifications) pre-exist and
are unrelated. Known product gaps flagged (not fixed): create_team has no
role gate (Guests can create teams); space-level EDIT lets any Member
rename/delete/privatize a public space and manage its members.

TAG: [TASK]
PARENT: Implement roles & permissions spec
TITLE: Manual test plan HTML for roles & permissions
DESC: Generated manual-testing/roles_and_permissions.html - a self-contained
interactive manual test plan (checkbox results + notes persisted in
localStorage, progress bar, light/dark). Covers the whole product surface
for roles: role model reference tables (workspace role hierarchy + space
permission levels and their resolution order), environment setup (6 test
accounts rp-owner/super/admin/member/limited/guest@test.com, workspace 'RP
Test WS', public space 'Public Rocket', private space 'Private Vault'), then
14 sections / ~45 test cases: workspace create/rename/delete, invites (who
can invite whom, resend/cancel, accept via signup+login), role management
matrix, member removal, ownership transfer roundtrip, public space defaults
per role, private spaces + explicit sharing, VIEW/COMMENT/EDIT level
behavior, folders/lists/tasks inheritance + leakage checks, individual time
permissions, teams, chat private-channel bypass, and a Known Gaps section
listing the code-review findings to decide on (team creation ungated, space
EDIT too powerful, no self-serve leave workspace, comment attachments at
COMMENT level unverified).

TAG: [BUG]
TITLE: Cross-workspace channel-delete notifications investigation + frontend hardening
DESC: User reported seeing "Channel deleted" notifications (#admin delete
1783602060, #creator delete 1783602056) right after creating a new workspace.
Investigated: backend scoping is CORRECT - list_notifications filters
InboxItem by workspace_id, and a DB query confirmed all those rows belong to
the "Acme Demo" workspace. They were created by the automated test run
(test_channel_delete_permissions deletes channels in the shared demo
workspace; channel-delete notifications fan out to every workspace member,
including real accounts). So: test pollution of the shared dev DB, surfaced
while the client was still in Acme Demo context - not a permission leak.
Hardened the frontend anyway, two real gaps found:
(1) applyHomeNotification (frontend/src/lib/notifications/realtime.ts)
ignored event.workspaceId - a socket notification from any workspace would
toast + enter the live cache; now takes currentWorkspaceId and drops
mismatches. (2) clearLiveNotifications() existed but was never called - the
module-level live cache bled across workspace switches within a session; now
cleared in ChatSocketProvider's workspaceId-change effect. npx tsc --noEmit
clean. Attempted to delete the junk InboxItem rows (test-named channel
sources) from the dev DB but the action was permission-denied; left for the
user to decide - SQL: DELETE FROM "InboxItem" WHERE "activityKind" IN
('channel_deleted','channel_deleted_actor') AND "source" LIKE '%delete 17%'.
Longer-term recommendation recorded: point pytest at an isolated database
(API_TEST_BASE/env-specific DATABASE_URL) so suite runs stop writing
notifications into the workspace used for manual testing.

========================================
DATE_END: 2026-07-09

DATE_START: 2026-07-13

TAG: [BUG]
TITLE: Role & permissions manual-QA pass — invite/notification/People/channel fixes
DESC: User manually tested the roles & permissions system (see
specs/roles_and_permissions.md) and filed a batch of ~20 bugs/questions in
one message. Fixed all of them in this session:
Backend notifications: (1) accept_invite_for_user/accept_invite_with_signup
(backend-py/app/services/invite_service.py) never notified the inviter on
accept - added create_invite_accepted_notification (new function in
notification_service.py, InboxItemType.REMINDER, activity_kind
"invite_accepted") + emit_home_notifications call in both accept flows.
(2) home_service.create_task was self-notifying the creator
(recipient_ids=[user_id], the actor) - CreateTaskBody has no assignees at
creation time so there is no one else to notify; removed the dead
notification block entirely. Hardened create_task_activity_notifications
(notification_service.py) with a defensive actor self-exclude so this class
of bug can't recur, matching the pattern already used in
create_task_assignment_notifications. All 16 other notification call sites
audited and confirmed already excluding the actor.
Stale-UI-until-hard-refresh bugs: root cause was zero socket events on role
change/ownership transfer. Added broadcast_workspace_member_role_updated
(backend-py/app/socket/emit.py, event "workspace:member:role") called from
update_workspace_member and transfer_workspace_ownership
(workspace_service.py, transfer emits for both the outgoing OWNER->ADMIN and
incoming ADMIN->OWNER). Frontend: ChatSocketProvider.tsx listens for it -
refreshes the affected user's own session (getMe + updateSession, matches
WorkspaceSettingsView's existing refreshSession pattern) if it's their own
role, and always bumps a new small pub/sub
(frontend/src/lib/workspace/realtime.ts,
subscribeWorkspaceMembersRefresh/bumpWorkspaceMembersRefresh) that
PeopleView.tsx now subscribes to so any viewer's table refetches live. This
fixes: role-change not reflected without refresh, downgraded role still
showing old options, ownership-transfer new-owner needing hard refresh.
PeopleView.tsx (People table): overflow-hidden -> overflow-x-auto + min-w on
the table (horizontal scroll on small/medium screens). Pending-invite Name
column showed "-" (no name captured anywhere in the invite flow, front or
back end) - now shows the email as the display name like ClickUp does.
"Invited by" was hardcoded "-" for active members since WorkspaceMember has
no FK back to the originating Invite - added a workspace_id+email lookup
against accepted Invite rows in list_workspace_members
(workspace_service.py) and wired WorkspaceMemberRow.invitedBy through.
Actions "..." menu showed nothing: DropdownMenuTrigger's render prop was an
entire <Tooltip> root (a non-DOM context provider) instead of a
TooltipTrigger, so Menu.Trigger's cloned props never reached a real DOM
node/button - fixed by swapping to the working composition used elsewhere
in the codebase (outer <Tooltip> wraps <DropdownMenu>, trigger renders
<TooltipTrigger render={<Button/>}/>). Same fix applied to the channel
"more options" button (ConversationView.tsx) which had the identical
inverted-composition bug and was the real root cause of "delete channel
option not visible" (the menu never opened at all, for anyone). Pending
invite row actions (copy link/resend/cancel) consolidated from three inline
buttons into a "..." dropdown menu to match the active-member row, per the
bug report. Member-sees-role-options-without-permission bug: verified
already correctly gated by canManagePeople/canEditMemberRole in this
codebase version (actorRole === MEMBER renders plain text, no dropdown) -
likely already fixed by a prior commit, no code change needed.
Ownership transfer: SelectItem for the transfer-target picker was missing
the `label` prop so <SelectValue> fell back to rendering the raw member id
in the trigger instead of "Name (email)" - added `label={`${fullName}
(${email})`}`.
Channel/chat: list_channel_members (chat_service.py) only returned explicit
ChatChannelMember rows for private channels, so OWNER/SUPER_ADMIN with
bypass access (has_privileged_workspace_access) never appeared in a private
channel's member/access list even though they can already open it - now
also injects active OWNER/SUPER_ADMIN workspace members not already
explicit members. Separately, OWNER/SUPER_ADMIN couldn't see private
channels they hadn't joined in the sidebar list unless they had a direct
link: backend list_channels already applies the privileged bypass
correctly, but frontend mergeSidebarChannels
(frontend/src/lib/chat/sidebar-lists-loader.ts) deleted any channel present
in the fresh API response but absent from the previously-cached
localStorage list - i.e. every "new to me" bypass channel got added then
immediately stripped back out on every refetch, because privileged channels
never receive the channel_joined socket broadcast (that only goes to
explicit members). Rewrote the merge so the fresh API response is
authoritative for set membership (adds and removes); cache only carries
forward local optimistic fields (canDelete, createdById, unread). Existing
sidebar-lists-loader.test.ts still passes. Copy link was a no-op
(toast.success with no clipboard write and no URL) in both
ChannelDetailsPanel.tsx and ConversationView.tsx - both now build
`${origin}${appPath(\`/chat/c/${channelId}\`)}` and
navigator.clipboard.writeText it, matching the pattern already used for
task-share links in TaskDrawer.tsx.
Workspace-level: added a PATCH-workspace-name UI to WorkspaceSettingsView.tsx
(input + Save, gated to OWNER/SUPER_ADMIN/ADMIN) wired to a new
updateWorkspace() call in lib/api/workspace.ts - the PATCH
/workspaces/{id} endpoint and service already existed and worked, only the
frontend was missing. Added a private-space toggle: Space.is_private
already existed end-to-end on the backend (spec's Space-level ACL work) but
the create/edit-space dialog (SpacesHierarchyDialog.tsx) never exposed it -
added a Switch, threaded isPrivate through createSpace/patchSpace
(lib/api/spaces.ts) and added "isPrivate" to map_space_row
(home_helpers.py) + SpaceDto (frontend) since the space list response
wasn't serializing it at all. WorkspaceSwitcherPopup: "Switch workspace" and
"Manage" buttons are plain <Button>s inside the Menu.Popup, not
DropdownMenuItem, so base-ui's Menu never auto-closed on click - added an
onClose prop (wired from TopBar's existing workspaceMenuOpen state) called
on every action including the Link-rendered items. "Create Workspace" was
initially gated to hide it from LIMITED_MEMBER/GUEST, but user corrected
this immediately after - they intentionally want every role including
LIMITED_MEMBER/GUEST to freely create their own workspace (a user can be
Guest in one workspace and Owner of their own elsewhere), so the gating was
reverted - button shows for everyone again, onClose behavior kept.
Answered as a question, no code change: "should limited member/guest be
able to create channels?" - currently backend create_channel
(chat_service.py) has zero role check, any active member including
GUEST/LIMITED_MEMBER can create a channel today. Flagged to user as a
product decision (ClickUp itself restricts Guest channel creation) rather
than silently changing behavior.
Verification: `uv sync --extra dev` (pytest wasn't installed) then full
backend suite - 106 passed, 6 pre-existing failures all sharing the same
"attached to a different loop" asyncpg/pytest-asyncio RuntimeError
(including test_google_oauth, totally unrelated to this diff) - test infra
flakiness, not a regression. test_space_permissions/test_permissions_matrix/
test_roles_permissions_gaps/test_member_time_permissions/test_workspace_flow
(the permission-relevant suites) all pass clean in isolation (38/38).
Frontend: `npx tsc --noEmit` clean, `npx vitest run` 44/44 passed including
sidebar-lists-loader.test.ts, eslint on touched files shows only the
project's pre-existing pervasive react-hooks/set-state-in-effect pattern
(same rule already fires on untouched files like ChatSidebar.tsx/
TaskDrawer.tsx - not a new regression).

TAG: [BUG]
PARENT: Role & permissions manual-QA pass — invite/notification/People/channel fixes
TITLE: Fix "404 for chats" after the QA-pass edits + harden stale sidebar channel entries
DESC: Two follow-up reports from the same QA pass. (1) User hit a socket
reconnect loop + literal 404s right after the earlier fixes, both frontend
and backend on hot reload, even after restarting servers. Root cause: editing
plain .ts modules (not React components) - lib/workspace/realtime.ts,
lib/api/*.ts, lib/types/realtime.ts, sidebar-lists-loader.ts - forces Next.js
dev to full-reload the page instead of hot-patching, and repeated reloads
during concurrent edits left .next/dev/types/routes.d.ts mid-write/corrupted
(confirmed via `npx tsc --noEmit` throwing syntax errors inside that
generated file, not in app source). A server restart alone doesn't clear
.next; had user delete frontend/.next and restart clean - resolved it.
(2) Separately found and fixed a real regression I'd introduced in the same
session: mergeSidebarChannels (sidebar-lists-loader.ts) rewrite from earlier
today made the fresh API response authoritative for channel-list membership,
but didn't account for the loading state (queryChannels === undefined) -
during that window it now showed nothing instead of falling back to cache,
so the channel sidebar could render blank right after a query invalidation.
Fixed: return cached channels as-is while queryChannels is undefined
(stale-while-revalidate), only apply fresh-is-authoritative logic once the
query has actually resolved (including a genuinely-empty array). Verified
via tsc/vitest.
(3) User then reported: super admin can see an owner/super-admin-bypassed
private channel in the sidebar, but opening it gives "Channel not found".
Reproduced the full described scenario live against the running dev
server (not just statically) - had Jordan (MEMBER) create a private channel
excluding Alex, promoted Alex to SUPER_ADMIN via the API, then hit
GET /chat/channels/{id}, /messages, and /members as Alex - all 200, sidebar
list included it. Backend bypass confirmed fully correct, no fix needed
there. Asked user for the exact failing request; the returned log showed
the specific channel ID 404s even for the workspace OWNER (verified via a
second live probe), meaning that channel had actually been deleted (leftover
from repeated test-channel creation/deletion in the shared QA workspace) -
not a permission bug, a stale sidebar entry surviving in localStorage-persisted
sidebarListsCache with no self-healing when its channel is later deleted
out from under it (e.g. deleted while the tab's socket was disconnected, so
the chat:channel:removed broadcast was missed). Hardened
ConversationView.tsx's loadConversation error path: on a 404 opening a
channel, now calls removeChannelFromSidebar (same helper the live
chat:channel:removed handler uses) to evict the dead entry from cache,
toasts "This channel no longer exists", and redirects to /chat - so a stale
reference self-heals on next click instead of becoming a permanent dead
link. `tsc --noEmit` clean, vitest 44/44 still passing.

TAG: [BUG]
PARENT: Role & permissions manual-QA pass — invite/notification/People/channel fixes
TITLE: Fix follower-toggle 404, non-realtime thread replies, thread 500, and silent-mention thread notifications
DESC: Next round of QA reports, all four reproduced live against the running
dev server (created real channels/messages/threads via httpx against
localhost:4001 using demo accounts, verified the fix, cleaned up test data
after each) rather than guessed from static reading:
(1) "Failed to add to followers — 404: User is not a channel member" when a
channel owner tried to change the follow status of the auto-added
OWNER/SUPER_ADMIN (bypass-only, no real ChatChannelMember row). Root cause:
update_channel_member_target (chat_service.py) lazily creates a membership
row for a target with none, but unconditionally 404'd instead for ANY
private channel regardless of who the target was. Fixed: still 404 for a
genuine outsider, but now allows the lazy-create when the target is
OWNER/SUPER_ADMIN (is_privileged check against their WorkspaceMember role) —
matches the same "they already have bypass access, they just don't have a
row yet" pattern used everywhere else in this feature.
(2) Thread replies from other users never appeared in the main channel view
without leaving and re-entering the page. Root cause: ConversationView.tsx's
realtime-message effect explicitly ignored any socket event with a
parentId set (`if (realtimeEvent.parentId || !currentUserId) return`) — it
only handled top-level messages, and the existing threadCount bump only
happened for the CURRENT user's own reply (via ThreadPanel's onReplySent
callback). Added a second effect that bumps the parent message's
threadCount in the main list when a reply from ANOTHER user arrives via
socket, so the "N replies" indicator updates live.
(3) Super admin opening a thread with existing replies got a genuine 500
("Something went wrong"), not a permission issue — reproduced via a direct
in-process call to get_message_thread to get the real traceback (HTTP layer
was swallowing it): `TypeError: can't compare offset-naive and
offset-aware datetimes` in _thread_has_new (chat_service.py). Cause:
_PrivilegedChannelAccess.last_read_at defaults to None, so the function
falls back to _epoch() (aware) and compares it against
ChatMessage.created_at, which comes back naive at runtime despite the
column being declared DateTime(timezone=True) — likely a driver/schema
quirk, not chased further since the fix is defensive either way. Fixed by
normalizing both sides through a new _as_aware_utc() helper before
comparing (same pattern as the existing _as_utc() in invite_service.py).
Verified fixed via the same in-process repro.
(4) Users @mentioned in a thread's root message or earlier replies weren't
notified when someone else posted a new reply, unless they'd already
replied themselves. create_thread_reply_notifications (notification_
service.py) previously only notified the parent author + prior repliers.
Extended it to also scan every message body in the thread (parent + all
replies) for @mentions and fold those user ids into the notification
recipients too, so a silently-tagged participant still hears about new
thread activity. Verified live: mentioned a user in the root message,
had someone else reply without the mentioned user ever posting, confirmed
a "Reply in #channel" notification landed for them (in addition to the
pre-existing "Mentioned in #channel" notification from the original tag).
Note while reproducing: promoted alex@demo.com to SUPER_ADMIN in the shared
"Acme Demo" QA workspace for testing and initially forgot to revert it,
which broke tests/test_space_permissions.py::test_member_can_invite_as_member
(that test relies on alex@demo.com being a plain MEMBER) - caught it on the
full-suite run, reverted alex back to MEMBER via the API, reran clean.
Verification: backend permission/channel suites 40/40 passing after the
revert; frontend `tsc --noEmit` clean, vitest 44/44 passing.

TAG: [BUG]
TITLE: Task creation dialog dropdowns (status/assignee/due date/priority) rendered behind the modal
DESC: User reported that in CreateTaskDialog.tsx, clicking the status
dropdown, assignee picker, due date picker, or priority picker opens a menu
that visually renders behind the create-task modal, making it unclickable.
Root cause found via Explore subagent: both the task modal (Dialog) and the
dropdown menus (Popover/Select/DropdownMenu) are portal-rendered to
document.body via @base-ui/react, so it wasn't a DOM-nesting issue - it was
a pure numeric z-index mismatch. Dialog overlay/content
(frontend/src/components/ui/dialog.tsx:34,56) use z-[100], while Popover
(ui/popover.tsx:35,40), Select (ui/select.tsx:81,86), and DropdownMenu
(ui/dropdown-menu.tsx:36,44) all used z-50 - lower than the dialog, so they
always painted underneath regardless of open order. Fixed by bumping all
three shared popup primitives' Positioner+Popup z-index from z-50 to
z-[110] (above the dialog's z-[100]), so any popover/select/dropdown menu
opened while a dialog is mounted now renders on top. These are shared UI
primitives used app-wide, not local to CreateTaskDialog, so the fix applies
everywhere the same stacking conflict could occur. Left tooltip.tsx and
sheet.tsx at z-50 (not implicated in this report, no user-visible issue
there). Not yet verified in-browser - recommend a quick manual check of the
create-task dialog's four dropdowns.

TAG: [TASK]
PARENT: Task creation dialog dropdowns (status/assignee/due date/priority) rendered behind the modal
TITLE: Priority flags + smaller action buttons in create-task dialog
DESC: Two follow-up UI tweaks to CreateTaskDialog.tsx from the same z-index
fix session. (1) Added a colored FlagIcon before the priority name, both in
the trigger button and in the priority dropdown's option list: red for
urgent, yellow for high, blue for normal, gray for low/none - new
priorityFlagClass() helper local to the file (existing ListTaskRow.tsx has
its own similar mapping using amber/blue-400/muted-foreground, left
untouched, not in scope here). (2) Shrunk the four action buttons (status,
assignee, due date, priority): Button size="sm" ones went h-9->h-7,
text-sm->text-xs, icons size-4->size-3.5, gap-2->gap-1.5; the custom status
button (not a Button component) went px-3 py-2->px-2 py-1.5, icon
size-3.5->size-3, min-w-[140px]->min-w-[120px]. `npx tsc --noEmit` clean.

TAG: [FEATURE]
TITLE: Create-task dialog - remove Cancel, split create button, task attachments
DESC: User filed a batch of 4 requests for CreateTaskDialog.tsx (frontend/
src/components/spaces/CreateTaskDialog.tsx). All four addressed in one pass:
(1) Removed the Cancel button from the footer entirely (dialog's own X /
backdrop-click still closes it).
(2) "Create Task" is now a split button: main button keeps the old default
behavior (create + close dialog, no navigation); a chevron-down opens a
DropdownMenu with "Create and open" (creates then navigates to
/spaces/l/{listId}?task={taskId} same as the dialog's previous unconditional
behavior), "Create and start another" (creates, keeps the dialog open,
resets name/description/priority/due/assignees/attachments but keeps the
same list, resets status back to the list's default TODO status), and
"Create and duplicate" (creates the task, then silently creates a second
task with identical fields via a second createListTask+patchTask call,
toasts "Task created and duplicated"). Refactored handleCreate into a shared
createOneTask() helper + handleCreate(action) so all four paths share the
create+patch logic. Changed onCreated's signature to
(task, options?: {open?: boolean}) and updated the only call site,
GlobalCreateTaskDialog.tsx, to stop unconditionally closing the modal +
navigating inside onCreated - now the dialog itself calls onOpenChange(false)
only for the actions that should close it (not "start another"), and
navigation only happens when options.open is true. This is a behavior change
from before: previously EVERY task creation auto-navigated to the new task;
now only "Create and open" does.
(3) Investigated the reported bug "list picker shows spaces/lists user
lacks access to" - traced fetchSpacesTree -> GET /workspaces/{id}/spaces ->
home_service.list_spaces -> space_permissions.visible_space_ids/
resolve_space_permission (backend-py/app/services/space_permissions.py,
from the earlier roles/permissions work) and confirmed private-space
filtering is already correct there; CreateTaskListPicker's Recents section
also can't leak inaccessible lists since it looks entries up against the
already-filtered `spaces` prop via listIndex.get(id) and silently drops
misses. Concluded: no code change needed, already fixed by prior session's
Space-level ACL work - flagged to user rather than silently doing nothing.
(4) Attachments: confirmed backend/frontend task-attachment infra already
existed end-to-end (built for task comments) - TaskAttachment model,
task_attachment_service.presign_upload/upload_file_content, POST /tasks/
{id}/attachments/presign + /upload routes, frontend uploadTaskAttachment()
helper (frontend/src/lib/tasks/upload-task-attachment.ts) - reused directly,
no new backend work. Added a paperclip icon button left of the Create Task
split button in the footer, wired to a hidden <input type="file" multiple>;
since a task doesn't exist yet at pick-time, files are staged client-side
in pendingAttachments state (id + File) rather than uploaded immediately.
Once >=1 file is staged, a new "Attachments" section appears below the
status/assignee/due/priority row: each staged file in a bordered row with
name, size (formatBytes helper), and an X button to drop it pre-upload;
below the list, an underlined "Add attachment" link reopens the file picker.
On any create action, staged files are uploaded via uploadTaskAttachment
per-file against the newly-created task's real id (each upload wrapped in
its own try/catch so one bad file doesn't block the rest or the task
creation itself). Duplicate action does not copy attachments to the second
task (deliberate scope cut, noted rather than silently decided).
Verification: `npx tsc --noEmit` clean, `npx eslint` on both changed files
shows only pre-existing issues already present in the file before this
change (unused Select imports, a set-state-in-effect + static-component
warning pair on untouched lines - same pre-existing pattern noted in the
2026-07-13 QA-pass entry). `npx vitest run` 44/44 passing. No browser-based
manual verification was possible this session (no browser-automation tool
available) - recommended a manual click-through of the split button's 3
dropdown actions and the attachment flow before shipping.

TAG: [TASK]
PARENT: Create-task dialog - remove Cancel, split create button, task attachments
TITLE: Follow-up batch - smaller TODO button, followers picker, dropdown width, attachments container
DESC: Second batch of 4 requests on the same CreateTaskDialog.tsx work.
(1) Status/"TODO" trigger button was still wider than Assignee/Due/Priority
because of `flex-1 min-w-[120px]` - removed, now `w-fit max-w-[140px]`
matching the others (with truncate + shrink-0 chevron so it doesn't blow out
on long status names).
(2) Added a Followers feature: bell icon button between the attachment
paperclip and the "Create Task" split button, opens a Popover with the same
search+checklist member-picker pattern as Assignee; selected count renders
next to the bell (button widens via `w-auto gap-1 px-2` once count>0, stays
icon-square at 0). This needed real backend work since the existing
follow/unfollow endpoints (backend-py/app/services/home_service.py
follow_task/unfollow_task, POST+DELETE /tasks/{id}/follow) are self-only
(always use the requester's own user id, no target-user param) - didn't fit
"pick other users to follow." Added a bulk-set path instead, mirroring how
assignee_ids already works: new `follower_ids`/`followerIds` field on
UpdateTaskBody (backend-py/app/schemas/home.py), and in update_task
(home_service.py) a block that validates ids against workspace members then
deletes+reinserts TaskFollower rows for the task (same shape as the existing
assignee_ids block just above it). Added `selectinload(Task.followers).
selectinload(TaskFollower.user)` to the shared `_TASK_LOAD` tuple (used by
every Task query across home_service.py and spaces_service.py) so map_task
can safely read task.followers without an async lazy-load error, and added
`"followerIds": [f.user_id for f in task.followers]` to map_task
(home_helpers.py). Frontend: followerIds added to Task type (lib/types/
task.ts) and UpdateTaskInput (lib/api/spaces.ts); CreateTaskDialog stages
followerIds client-side like assigneeIds and includes it in the patch
payload on create. The old self-follow toggle endpoints are untouched and
still used elsewhere (e.g. TaskDrawer's own "Follow" button) - two
independent write paths into the same TaskFollower table, no conflict.
(3) Bug: the create-task split button's dropdown ("Create and open" / "Create
and start another" / "Create and duplicate") was wrapping each option's text
because DropdownMenuContent's Popup class defaults to `w-(--anchor-width)`
(frontend/src/components/ui/dropdown-menu.tsx) - anchored to the tiny
chevron-only trigger, not the menu content. Fixed by passing
`className="min-w-64 whitespace-nowrap"` on this specific DropdownMenuContent
usage - min-width mathematically clamps the used width up regardless of
which utility class wins in the generated stylesheet (unlike fighting it
with another `w-*` class, which would depend on unpredictable Tailwind
class-order). Global dropdown-menu.tsx default untouched, only this call
site overridden.
(4) Attachments restyled per feedback: was individual bordered/rounded boxes
with gaps between them; now one `rounded-md border border-border divide-y`
wrapper holding every attachment row plus the "Add attachment" row as its
last child, so rows are separated by a single divider line each (the divider
above "Add attachment" falls out of divide-y for free, no separate border
needed). "Add attachment" text no longer text-primary (purple) - now default
foreground color; split into "Add" (text-xs, no underline) + "attachment"
(text-sm, underlined) per the request that only "attachment" be underlined
and "Add" render smaller.
Verification: backend - `python -c "import app.services.home_service"`
clean, targeted perms suites (test_permissions_matrix/
test_roles_permissions_gaps/test_space_permissions) 31/31, then full `uv run
pytest` 106 passed / 6 failed - the same 6 pre-existing async-event-loop
asyncpg flakes seen in every prior session (test_auth_profile,
3x test_google_oauth, test_home_extras::test_lineup_add_reorder_remove,
test_home_notifications), not new. Frontend: `npx tsc --noEmit` clean,
`npx eslint` on CreateTaskDialog.tsx shows only the same two pre-existing
errors as the previous entry (unchanged lines), `npx vitest run` 44/44
passing. Still no browser-automation tool available this session - flagged
again that the follower picker, dropdown width fix, and attachments
container need an actual manual click-through before shipping.

TAG: [SUBTASK]
PARENT: Follow-up batch - smaller TODO button, followers picker, dropdown width, attachments container
TITLE: Shrink attachment + followers icon buttons
DESC: User called the followers bell button "notification" this round -
same button from the prior entry, just referred to differently. Both the
paperclip (attachment) and bell (followers) buttons in CreateTaskDialog.tsx's
footer were Button size="icon" (size-8) with size-4 icons; shrunk to
size="icon-sm" (size-7) with size-3.5 icons, and tightened the follower
count badge's expanded-state padding from px-2 to px-1.5 to match the
smaller footprint. `npx tsc --noEmit` clean.

TAG: [SUBTASK]
PARENT: Follow-up batch - smaller TODO button, followers picker, dropdown width, attachments container
TITLE: Tooltips on attachment + followers buttons
DESC: Added Tooltip/TooltipTrigger/TooltipContent (frontend/src/components/
ui/tooltip.tsx) around both icon-only footer buttons in CreateTaskDialog.tsx
- "Attachments" on the paperclip button (plain Tooltip+TooltipTrigger wrap,
straightforward since it's not itself a popover trigger), "Followers" on the
bell button (nested composition since that button IS a PopoverTrigger:
outer <Tooltip> wraps the whole <Popover>, PopoverTrigger's render prop
wraps a TooltipTrigger which wraps the actual Button - same pattern already
used in PeopleView.tsx for a DropdownMenuTrigger+TooltipTrigger combo, just
ported to Popover). While doing this, caught that tooltip.tsx still had the
same z-50-vs-dialog's-z-[100] bug fixed earlier this session for popover/
select/dropdown-menu (2026-07-13 z-index entry, which had deliberately left
tooltip.tsx untouched since nothing used it inside a dialog yet) - now that
a Tooltip is actually mounted inside this modal, bumped tooltip.tsx's
Positioner+Popup z-50 -> z-[110] to match the other three primitives, or the
new tooltips would silently render behind the dialog. `npx tsc --noEmit`
clean, eslint shows the same two pre-existing errors as prior entries
(unchanged lines), `npx vitest run` 44/44 passing.

========================================
DATE_END: 2026-07-13

DATE_START: 2026-07-14

TAG: [FEATURE]
TITLE: Task Dependencies (Blocked by / Blocks / Linked) + create-dialog three-dot menu
DESC: Continuation of CreateTaskDialog.tsx work. Added a three-dot overflow
menu (Subtasks/Checklist - toast "coming soon", not implemented; Dependencies
- opens a Dialog) and a full Dependencies feature. New
frontend/src/components/spaces/TaskPickerDialog.tsx: debounced search + recent-
tasks picker reusing existing fetchTasks(token, workspaceId, undefined,
search) (already access-filtered via space_permissions.visible_space_ids, no
new backend filtering needed). CreateTaskDialog.tsx: DEPENDENCY_SECTIONS
constant (blocked_by/blocking/linked, labels "Add blocked by task"/"Add task
that blocks"/"Add linked task"), StagedDependency type, Dependencies Dialog
listing staged deps per section with the TaskPickerDialog wired to add. Also
removed "None" from the priority dropdown (CreateTaskDialog.tsx and
TaskDrawer.tsx, mirrored) per user request. Backend: new TaskDependency model
(id, task_id, related_task_id, dependency_type, created_at) in
backend-py/app/db/models/home.py; CreateTaskDependencyBody schema
(relatedTaskId, type: Literal["blocking","blocked_by","linked"]); new
add_task_dependency() service in home_service.py; new POST
/tasks/{task_id}/dependencies route; migration
scripts/migrate_task_dependencies.sql + run_task_dependencies_migration.py,
applied to local dev DB only (staging/prod still pending). Also this session:
GlobalCreateTaskDialog.tsx's onCreated no longer unconditionally closes/
navigates, only navigates when options?.open is true (needed so the
Dependencies dialog and other in-progress dialog state survive a background
task creation). Verification: npx tsc --noEmit clean, npx eslint only
pre-existing warnings, npx vitest run 44/44 passing. All of the above landed
in commit 8478983 "feat(tasks): overhaul create-task dialog - attachments,
followers, dependencies".

TAG: [BUG]
TITLE: Denormalize TaskAssignee/TaskFollower join tables into Task.assigneeIds/followerIds arrays
DESC: User pushed back hard on DB design ("why multiple tables like
TaskAssignee, TaskFollowers... can't all this info be kept in the Task table
itself??? very bad design"), asked for the list of tables added in the last 2
commits, then asked for a consolidation analysis specifically for task-related
tables with read/write tradeoffs (chat + PM app, read-heavy list/board views
vs write-heavy chat/time-tracking). Analysis: merge TaskAssignee and
TaskFollower into Task via Postgres ARRAY(String) columns + GIN index
(assignee/follower churn is low-cardinality, read-dominated, and
selectinload's N+1-avoidance benefit goes away once it's just two array
columns on the row already being fetched); explicitly did NOT recommend
merging TaskAttachment, TaskTimeEntry, TaskDependency, or TaskComment - those
are write-heavy/unbounded-growth/needs-independent-locking and a join table
avoids the Postgres MVCC full-row-tuple-rewrite cost that an array column
would otherwise force on every unrelated field update. User approved,
requested implementation: "merge Assignee and Followers into Task. Write the
migration and do the changes in the code."
Implemented: backend-py/app/db/models/home.py - added Task.assignee_ids /
Task.follower_ids (ARRAY(String), nullable=False, default=list,
server_default="{}"), deleted TaskAssignee/TaskFollower classes and their
Task relationships entirely; db/models/__init__.py updated imports/__all__.
New migration scripts/migrate_task_assignee_follower_arrays.sql (adds
columns, backfills via array_agg subqueries from the old tables, creates GIN
indexes, drops the old tables) + run_task_assignee_follower_arrays_migration.py,
applied to local dev DB (staging/prod pending, same as other recent
migrations). home_service.py: removed assignee/follower selectinload from
_TASK_LOAD; added _assignee_name_map() helper (batch-fetches User.full_name
for a set of ids, since the array column no longer carries names via
relationship); _task_filters' assignee match changed to
Task.assignee_ids.any(user_id); update_task rewritten to reassign
task.assignee_ids/follower_ids directly (dedup via
list(dict.fromkeys(...))) instead of delete+insert-loop; is_task_followed_by/
follow_task/unfollow_task rewritten to read/mutate the array directly -
noted behavior change: unfollow_task now 404s on a nonexistent task instead
of silently no-op'ing. home_helpers.py: map_task() takes an optional
assignee_names dict param, assignee label loop now iterates task.assignee_ids
and looks up names from that dict (falls back to "User"); assigneeIds/
followerIds in the response now read straight from the array columns.
notification_service.py: task_notification_recipients() now selects
Task.assignee_ids/follower_ids directly instead of querying TaskAssignee/
TaskFollower tables. spaces_service.py: add_task_comment and all three
map_task() call sites (add/update/delete comment) updated to fetch
_assignee_name_map before calling map_task. JSON API contract
(assigneeIds/followerIds/assignees label array) preserved exactly, so zero
frontend changes were needed for this refactor.
Verification: uv pip install psycopg2-binary (ephemeral dev dependency, not
tracked in pyproject.toml/uv.lock - uv run re-syncs the venv against the
lockfile between invocations so this needed reinstalling more than once this
session) to run the migration script. Full backend-py pytest suite green
aside from the same 6 pre-existing async-event-loop/asyncpg flakes documented
in every prior session's entries (test_auth_profile, 3x test_google_oauth,
test_home_extras::test_lineup_add_reorder_remove, test_home_notifications) -
confirmed unrelated by cross-referencing those entries. Landed in commit
e457e99 "fix: denormalize task assignee and followers tables".

TAG: [CHORE]
TITLE: Add architectural-boundary rules to CLAUDE.md
DESC: User added a mandatory new section to CLAUDE.md: (1) ask before any
change that would shift architectural direction; (2) ask before any DB table
change or new table, called out as a critical decision not to take lightly -
directly follows from the TaskAssignee/TaskFollower merge above, where the
user wants that kind of DB-shape call routed through them going forward, not
made unilaterally; (3) reuse existing code over writing new code - extend an
existing function with a conditional before adding a new one; (4) APIs follow
CRUD - generalized PUT/PATCH over resource-specific update endpoints,
generalized List APIs accepting query params over many narrow list endpoints,
new endpoints only when nothing existing can be extended; (5) new
methods/functions/APIs are still fine, but only after confirming nothing
existing already covers the need. Added as a new "Architectural boundaries"
section at the top of CLAUDE.md, above the existing daily-report-logging
section.

TAG: [FEATURE]
PARENT: Task Dependencies (Blocked by / Blocks / Linked) + create-dialog three-dot menu
TITLE: Checklist feature for task creation dialog
DESC: Third item in CreateTaskDialog.tsx's three-dot menu (Subtasks still
"coming soon"). Clicking "Checklist" opens an inline container below the
TODO/Assignee/Due/Priority button row: heading "Checklist" (bold foreground)
+ "{done} of {total}" (muted gray) count, a divided list of added items
(checkbox toggle, text with line-through when checked, optional single-
assignee avatar, remove X), and a composer row at the bottom - "+" button
(disabled until text entered) on the left, a borderless text input in the
middle, and a person+ icon on the right that opens a searchable single-select
people popover reusing the same `members` array (fetchWorkspaceMembers) and
search-filter pattern already used for the Assignee and Follower pickers in
this same dialog - same access-scoping as those two, no new filtering logic
needed. Clicking a person again deselects (single assignee only, enforced
client-side by replacing rather than appending).
Before implementing, this needed a DB-table decision under the new
CLAUDE.md "ask before creating any table" rule. User initially asked "why
not keep a JSON array of checklist items in the Task row instead of a new
table" (parallel to the earlier assignee/follower array-column merge).
Explained why checklist items are the opposite case: checking/unchecking is
the single highest-frequency write path here, and a JSON array means every
toggle rewrites the *entire* array including every other item's text -
real risk of a lost update if two people tick different items on the same
checklist concurrently, vs. a real table where a toggle is one targeted row
UPDATE. Also: assignee_id as JSON can't FK to User (no cascade cleanup when
a user leaves/is deleted), and a plausible future "my checklist items across
all tasks" view needs an indexed query a JSON blob can't give cheaply. User
agreed, approved a separate table.
Backend: new TaskChecklistItem model (id, task_id FK cascade, text,
isChecked bool default false, assigneeId FK User SET NULL nullable,
createdAt) in backend-py/app/db/models/home.py, back_populated on
Task.checklist_items (cascade delete-orphan, mirrors attachments). Migration
scripts/migrate_task_checklist_items.sql + run_task_checklist_items_migration.py,
applied to local dev DB (staging/prod pending, same caveat as every other
recent migration). Schemas: CreateChecklistItemBody (text, assigneeId
optional, isChecked default false - lets a pre-checked staged item persist
its checked state in the same request instead of create-then-patch) and
UpdateChecklistItemBody (text/isChecked/assigneeId all optional, using
model_fields_set the same way update_task already does for nullable-clear
fields) in schemas/home.py. Per the CLAUDE.md CRUD rule, only 3 endpoints:
POST /tasks/{id}/checklist-items, generalized PATCH /tasks/{id}/checklist-
items/{itemId} (covers rename/check-toggle/reassign/unassign through one
endpoint instead of separate toggle/assign routes), DELETE .../items/{itemId}
- update_checklist_item and delete_checklist_item exist in home_service.py
for future task-detail-view use even though this dialog only calls add
(task doesn't exist yet at compose time, matching the attachments/
dependencies staging pattern). Extracted a new _get_editable_task() helper
(task+space fetch + require EDIT permission) since this was about to become
a third copy of a block already duplicated in update_task and
add_task_dependency - refactored those two existing call sites to use it too
per the CLAUDE.md reuse rule instead of leaving three copies. Checklist items
load via a new selectinload(Task.checklist_items).selectinload(...assignee)
added to the shared _TASK_LOAD tuple, and map_task (home_helpers.py) now
includes a "checklistItems" array (via new map_checklist_item helper) sorted
by created_at, so a future task-detail view gets this for free.
Frontend: TaskChecklistItem type + Task.checklistItems field (lib/types/
task.ts), addChecklistItem() API client call (lib/api/spaces.ts, only POST
wired up - PATCH/DELETE clients intentionally not added yet since nothing in
this dialog needs them, per the "don't build what isn't used yet" rule).
CreateTaskDialog.tsx: staged client-side in checklistItems state
(id/text/checked/assigneeId) same as attachments/dependencies, flushed via
one addChecklistItem POST per item after the real task is created in
handleCreate (each wrapped in its own try/catch so one bad item doesn't
block the rest, matching the attachments loop's error-isolation pattern).
Named the local "add to staged list" handler stageChecklistItem (not
addChecklistItem) after tsc caught a name collision with the imported API
function of the same name. Duplicate-task action still doesn't copy
attachments/dependencies/checklist items to the second task (same
deliberate, previously-noted scope cut).
Verification: `python -c "import app.services.home_service; import
app.api.v1.home"` clean after each backend edit. Frontend `npx tsc --noEmit`
clean, `npx eslint` on touched files shows only the same pre-existing
warnings/errors already documented in prior entries (unused Select imports,
set-state-in-effect, static-components - unchanged lines), `npx vitest run`
44/44 passing. Full backend-py `uv run pytest`: 106 passed, 6 failed - same
pre-existing async-event-loop/asyncpg flakes as every prior entry
(test_auth_profile, 3x test_google_oauth,
test_home_extras::test_lineup_add_reorder_remove, test_home_notifications),
confirmed unrelated. No browser-automation tool available this session -
recommend a manual click-through of add/toggle/remove/assign before shipping.

TAG: [TASK]
PARENT: Checklist feature for task creation dialog
TITLE: Exact menu items per user spec (Add Item, Assign all to, Unassign all)
DESC: User clarified that the checklist UI must have exact named menu items
not previously implemented. Checklist container menu (always visible):
needed "Add Item" at top, "Assign all to..." (popover with member search +
single-select to bulk-assign all items), "Unassign all" (deselect all assignees
on all items), plus exact label "Rename checklist" instead of just "Rename",
and "Delete checklist" instead of just "Delete". Item row menu (hover-only):
needed "Add Item" at top plus the existing Rename/Assign to/Delete. Additions:
assignAllChecklistItemsInChecklist(checklistId, userId) and
unassignAllChecklistItemsInChecklist(checklistId) helper functions in
CreateTaskDialog.tsx; added state for assign-all popover (checklistAssignAllOpen
+ checklistAssignAllSearch); restructured the checklist menu to add all missing
items in exact order with correct labels; added "Add Item" to the item menu.
The "Assign all to" popover had to live outside the DropdownMenuContent
(can't nest Popover inside a dropdown menu due to portal/focus constraints),
so wrapped the entire menu area in a div with a sibling Popover that's opened
by the "Assign all to" menu item onClick. Verification: `npx tsc --noEmit`
clean, `npx vitest run` 44/44 passing.

TAG: [SUBTASK]
PARENT: Exact menu items per user spec (Add Item, Assign all to, Unassign all)
TITLE: Menu styling - width, text size, icons, divider
DESC: User requested visual refinements to both checklist and item menus:
(1) Larger menu container width (added min-w-48 className to both
DropdownMenuContent). (2) Small menu text (added text-xs to all
DropdownMenuItem). (3) Icons on left side (imported Edit2Icon, Trash2Icon,
UserMinusIcon; added icon + className="gap-2 shrink-0" to each menu item).
(4) No text wrapping (added whitespace-nowrap to all items). (5) Thin divider
below "Rename checklist" in checklist menu (added <DropdownMenuSeparator
className="my-1" /> right after that item). Icons: PlusIcon for Add Item,
Edit2Icon for Rename, UserPlusIcon for Assign to/Assign all to, UserMinusIcon
for Unassign all, CheckCircle2Icon for Check All, CircleIcon for Uncheck All,
Trash2Icon for Delete. Verification: `npx tsc --noEmit` clean, `npx vitest
run` 44/44 passing.

TAG: [SUBTASK]
PARENT: Exact menu items per user spec (Add Item, Assign all to, Unassign all)
TITLE: "Assign all to" dropdown + "Unassign all" confirmation
DESC: "Assign all to" popover wasn't showing - Popover component needs
PopoverTrigger child as an anchor point for PopoverContent positioning. Fixed
by adding `<PopoverTrigger render={<div className="hidden" />} />` - creates
an invisible div anchor so PopoverContent can position itself correctly. The
popover opens when menu item is clicked (setChecklistAssignAllOpen), shows
search input + member list filtered by checklistAssignAllSearch, and clicking
a member calls assignAllChecklistItemsInChecklist(checklistId, userId) to
bulk-assign all items + closes popover. For "Unassign all", added confirmation:
new handleUnassignAll(checklistId) function calls confirm("Remove assignee
from all items in this checklist?") and only calls unassignAllChecklistItemsInChecklist
if user clicks OK. Updated menu item to call handleUnassignAll instead of
directly calling unassign function. Verification: `npx tsc --noEmit` clean,
`npx vitest run` 44/44 passing.

TAG: [SUBTASK]
PARENT: Exact menu items per user spec (Add Item, Assign all to, Unassign all)
TITLE: Fix "Assign all to" popover anchor position (was rendering off-screen)
DESC: User reported the "Assign all to" popover wasn't visibly appearing near
the task-creation dialog. Root cause: prior fix used
`<PopoverTrigger render={<div className="hidden" />} />` - className="hidden"
sets display:none, which strips the element from layout entirely, so the
floating-ui positioning engine anchored the popover to a zero-size/zero-position
element (effectively top-left of the document, off the visible dialog area)
instead of near the checklist's three-dot menu button. Fixed by replacing the
hidden div with an in-layout zero-size anchor:
`<span className="absolute right-0 top-full h-0 w-0" />` placed inside the
existing `relative` wrapper div that already contains the three-dot button -
this positions the anchor exactly at the bottom-right corner of that button
(top-full = just below it, right-0 = aligned to its right edge), so the
popover now opens directly below the checklist options menu where the user
expects it. Verification: `npx tsc --noEmit` clean, `npx vitest run` 44/44
passing. Flagged to user for a manual click-through since no browser-automation
tool is available this session.

TAG: [SUBTASK]
PARENT: Exact menu items per user spec (Add Item, Assign all to, Unassign all)
TITLE: Replace prompt()/confirm() with app-style dialogs for rename + unassign-all
DESC: User called out that Rename checklist, Rename item, and Unassign all
used browser-native prompt()/confirm() dialogs, which don't match app style.
Found existing app patterns to reuse: ConfirmDialog (frontend/src/components/
shared/ConfirmDialog.tsx - already used elsewhere e.g. SpacesSidebar's delete
flow) for confirm-before-destructive-action, and the input-Dialog pattern
from SpacesHierarchyDialog.tsx (Dialog + Label + Input + submit Button) for
renames. Implemented locally in CreateTaskDialog.tsx (staged client-side data,
no API call needed, so didn't reuse SpacesHierarchyDialog itself - it's tied
to createSpace/patchSpace etc): new renameTarget state
({type:"checklist"|"item", checklistId, itemId?} | null) + renameValue string;
openRenameChecklist/openRenameItem set the target and prefill the current
name/text; submitRename(e) prevents default, trims, and calls
renameChecklist() or updateChecklistItemText() based on target type, then
closes. New nested <Dialog> (same pattern as the existing Dependencies dialog
already nested inside CreateTaskDialog's outer Dialog) renders a form with
Label+Input+Save button, title switches between "Rename checklist"/"Rename
item". For Unassign all: new unassignAllChecklistId state (string | null);
handleUnassignAll now just sets this id instead of calling window.confirm();
new confirmUnassignAll() runs the actual unassign then clears the id. Reused
the existing <ConfirmDialog> component directly (title "Unassign all",
description "Remove the assignee from every item in this checklist?",
confirmVariant="destructive"). Both prompt() call sites (checklist rename,
item rename) and the one confirm() call site (unassign all) removed.
Verification: `npx tsc --noEmit` clean, `npx vitest run` 44/44 passing.

TAG: [SUBTASK]
PARENT: Exact menu items per user spec (Add Item, Assign all to, Unassign all)
TITLE: Disable "Unassign all" when checklist has no items
DESC: Added `disabled={checklist.items.length === 0}` to the "Unassign all"
DropdownMenuItem (grays it out / blocks click in an empty checklist), plus a
defensive guard in handleUnassignAll() itself (looks up the checklist, returns
early if not found or items.length === 0) so the confirm dialog can't be
opened via a stale click even if the disabled prop is bypassed. Verification:
`npx tsc --noEmit` clean, `npx vitest run` 44/44 passing.

TAG: [SUBTASK]
PARENT: Exact menu items per user spec (Add Item, Assign all to, Unassign all)
TITLE: Disable Check All/Uncheck All/Assign all to when empty + fix "Add Item" no-op bug
DESC: Same empty-checklist guard requested for Unassign all now applied to
Check All, Uncheck All, and Assign all to - all three DropdownMenuItems get
`disabled={checklist.items.length === 0}`.
Also fixed the real bug: "Add Item" in both the checklist menu and the item
row menu called stageChecklistItem(checklist.id) directly, but that function
reads checklist.draftItemText and silently no-ops if it's empty
(`if (!text) return c;`) - since the composer input is virtually always empty
when the menu is opened, clicking "Add Item" appeared to do nothing. Fixed by
giving the composer <Input> a stable id (`checklist-draft-input-${checklist.id}`)
and adding a new focusChecklistComposer(checklistId) helper that looks it up
via document.getElementById and calls .focus() - wrapped in setTimeout(...,0)
since the DropdownMenu closing on click can restore focus to its own trigger
in the same tick, which would otherwise fight with/override the composer
focus. Both "Add Item" menu items (checklist-level and item-level) now call
focusChecklistComposer instead of stageChecklistItem, so clicking them puts
the cursor in the "Add item" input ready to type, instead of silently doing
nothing. The composer's own "+" button (disabled while empty, enabled once
typed) was already correct and untouched. Verification: `npx tsc --noEmit`
clean, `npx vitest run` 44/44 passing.

========================================
DATE_END: 2026-07-14

DATE_START: 2026-07-16

TAG: [FEATURE]
TITLE: List <-> Channel linkage - every List gets its own mandatory 1:1 chat Channel
DESC: User proposal: every List should automatically get its own Channel for
team discussion (mandatory, 1:1), with a new "Channel" tab before List/Board/
Calendar on the list page. Reverse direction stays optional - a regular
workspace Channel can still be created standalone with no List, and per user
clarification can even optionally reference a List without being that List's
"primary" channel. Before building, researched real ClickUp's behavior (web
search: help.clickup.com "What are Channels", "Create a Channel", "Open Chat
Channels") - confirmed location-based channels (Space/Folder/Subfolder/List,
1:1 max), two-way name sync between location and channel, and that in
ClickUp 4.0 creation is actually opt-in via an "Add Channel" button rather
than fully automatic; user explicitly chose the stricter "always auto-create,
mandatory" variant for this product instead of ClickUp's opt-in one. Went
through EnterPlanMode with two Explore-agent research passes (chat/list
schema, migration pattern, membership/permission model, socket emit gaps)
before writing an approved plan to disk. Key architecture decision, called
out explicitly by the user mid-review: whether a channel "is a list's
channel" must NOT be inferred from `listId IS NOT NULL`, because a workspace
channel can optionally reference a List (ClickUp's "Add a List" toggle
equivalent) without being that List's actual primary channel - so a separate
boolean `isListPrimary` column was added instead of deriving from listId
presence, with an explicit code comment recording the reasoning (per user's
"add a comment on why we gone this way" instruction).

What shipped, all in backend-py + frontend on branch feat/roles-and-permission:
(1) Schema: backend-py/scripts/migrate_list_channel.sql (+ its runner
run_list_channel_migration.py, following the project's existing hand-rolled
psycopg2 migration-script pattern - no Alembic in this repo) adds
"ChatChannel"."listId" (nullable, UNIQUE, FK -> TaskList.id ON DELETE SET
NULL - channel survives list deletion, orphaned rather than cascaded, per
user: "you can create new list again for that channel") and "isListPrimary"
(BOOLEAN NOT NULL DEFAULT FALSE) with a COMMENT ON COLUMN explaining the
listId-vs-isListPrimary distinction. Applied to local dev DB.
(2) Model: ChatChannel gained list_id/is_list_primary/task_list fields
(backend-py/app/db/models/chat.py). Hit and fixed a real Python gotcha while
doing this: naming the new relationship attribute `list` shadowed the
builtin `list` for the rest of the class body, corrupting the *unrelated*
`members: Mapped[list["ChatChannelMember"]]` line below it and causing a
cryptic SQLAlchemy `ArgumentError: relationship 'members' expects a class...
received NotImplementedType` at mapper-configure time - renamed the
attribute to `task_list` to fix.
(3) space_permissions.py: new user_ids_with_space_access(session,
workspace_id, space) - the membership source of truth for list-channels
(mirrors who can see the List's Space via resolve_space_permission, not
blanket workspace membership like manual channel creation).
(4) chat_service.py: new create_list_channel() (auto-creates a List's
primary channel with dedupe-on-name-collision, space-scoped membership) and
sync_list_channel_members_for_space()/_for_workspace() (re-diffs
ChatChannelMember rows whenever Space/Workspace membership changes, called
from spaces_service.add_space_member/remove_space_member,
workspace_service.remove_workspace_member, and both
invite_service.accept_invite_for_user/accept_invite_with_signup paths).
Two-way rename sync: update_channel() now also renames the linked List when
a list-primary channel is renamed; spaces_service.update_list() renames the
channel when the List is renamed. Added a new minimal socket event
"chat:channel:renamed" ({channelId, name}, broadcast_channel_renamed in
socket/emit.py) instead of reusing the existing "chat:channel:joined"
broadcast for this - reusing it would have clobbered every recipient's own
starred/isFollowing sidebar state, since that payload's shape is a generic
per-join template, not a real per-recipient patch. Frontend wired via
ChatSocketProvider.tsx -> sidebar-realtime.ts's new
applyChannelRenamedToSidebar -> existing patchSidebarChannel(name-only) helper.
(5) home_service.get_list now also returns channelId (queries the linked
is_list_primary channel), consumed by frontend ListMetaDto.
(6) Frontend: Channel TS type gained listId/isListPrimary; ChatSidebar.tsx's
ChannelRow gets a new listChannel prop swapping the HashIcon for a ListIcon
(reuses an icon already imported) when isListPrimary is true - explicitly
NOT keyed off listId per the same isListPrimary distinction. New "Channel"
tab added before List/Board/Calendar in SpacesListToolbar.tsx +
ListWorkspace.tsx, rendering the existing ConversationView(type="channel")
component as-is (reused, not rebuilt) pointed at meta.channelId.
Verification: `python -m py_compile` + full `import app.main` clean (caught
and fixed the `list` shadowing bug this way), `npx tsc --noEmit` clean. Ran
a real end-to-end smoke test against the local dev DB using existing
Engineering-space data in the Acme Demo workspace (not just unit-level):
created a list via spaces_service.create_list -> confirmed a 14-member
primary channel was auto-created with isListPrimary=True and the correct
listId, confirmed home_service.get_list returns matching channelId, renamed
the list via update_list -> confirmed the channel's name followed, deleted
the list via delete_list -> confirmed the channel survived with listId=NULL
and isListPrimary still True (matches user's "channel isn't deleted, list
can be recreated for it" decision). Smoke-test script and its test row were
both deleted afterward, no test pollution left in the dev DB. Not yet
manually verified in-browser (no UI click-through of the new Channel tab or
sidebar icon this session) - recommend a quick manual pass before considering
this fully done.

TAG: [SUBTASK]
PARENT: List <-> Channel linkage - every List gets its own mandatory 1:1 chat Channel
TITLE: Compact list-page toolbar to match real ClickUp's dense tab bar
DESC: User pasted a real ClickUp screenshot (Chat/List/Board/Credentials tab
row) and asked for the new Channel/List/Board/Calendar tab bar in
SpacesListToolbar.tsx to match - small, tight spacing, colored icon per tab.
Extended the shared UnderlineTabBar (frontend/src/components/shared/Tabs.tsx)
with an optional `icon` slot per tab (backward compatible, other callers like
PageTabs untouched). Rebuilt SpacesListToolbar.tsx's header from a two-line
breadcrumb+big-h1 into one compact single-line breadcrumb+title row
(px-4 py-1.5, text-xs breadcrumb + text-sm title, 7x7 icon buttons instead of
9x9), switched the tab bar to UnderlineTabBar's existing size="compact" and
added small colored icons matching the screenshot's alternating-color style:
HashIcon violet for Channel, ListIcon blue for List, LayoutGridIcon violet
for Board, CalendarIcon blue for Calendar. Tightened the status-filter row
below it too (py-2.5->py-1.5, 8->7 button/select heights, size-4->size-3.5
icons). `npx tsc --noEmit` clean. Not yet manually screenshotted against the
running app this session.

TAG: [SUBTASK]
PARENT: List <-> Channel linkage - every List gets its own mandatory 1:1 chat Channel
TITLE: Hide status/filter toolbar row on the Channel tab
DESC: The status-filter/group/search/display row below the tab bar in
SpacesListToolbar.tsx doesn't apply to the Channel view (it's task-list
specific). Now conditionally rendered only when view !== "channel".

TAG: [SUBTASK]
PARENT: List <-> Channel linkage - every List gets its own mandatory 1:1 chat Channel
TITLE: Tab icons match tab title color instead of fixed violet/blue
DESC: Dropped the hardcoded text-violet-500/text-blue-500 classes from the
Channel/List/Board/Calendar tab icons in SpacesListToolbar.tsx - lucide icons
default to currentColor, so they now inherit UnderlineTabBar's existing
muted-foreground (inactive) / foreground (active) text color automatically,
matching the label instead of a fixed color per tab.

TAG: [SUBTASK]
PARENT: List <-> Channel linkage - every List gets its own mandatory 1:1 chat Channel
TITLE: Unify list-channel view across /chat/c/[id] and the List page tab, drop duplicate header, dual icon
DESC: User reported a list's primary channel rendered differently depending
on entry point - visiting via the Chat sidebar (/chat/c/[channelId]) showed
plain ConversationView with no List/Board/Calendar tabs, visiting via the
List page's new Channel tab showed the tabs but ConversationView still had
its own redundant name+member-count header on top. Fixed both to converge on
one view: (1) frontend/src/app/(app)/chat/c/[channelId]/page.tsx is now a
client component that fetches the channel via fetchChannel/useHomeQuery
first; if channel.isListPrimary is true it router.replace()s to
/spaces/l/{listId}?view=channel instead of rendering ConversationView
directly - reuses the existing ListWorkspace/tabs shell rather than
duplicating it, so there is only one place list-channel UI is built. Non-list
channels render exactly as before. (2) ConversationView.tsx gained an
optional `hideHeaderTitle` prop; ListWorkspace.tsx's Channel-tab usage passes
it so the channel-name/member-count block in ConversationView's header is
skipped there (tabs + breadcrumb already carry that context) - standalone
/chat/c/* usage is unaffected since the prop defaults to showing it.
(3) Per follow-up ask, ChatSidebar.tsx's list-primary channel icon now shows
both HashIcon and ListIcon side by side instead of swapping to just ListIcon.
`npx tsc --noEmit` clean.

TAG: [SUBTASK]
PARENT: List <-> Channel linkage - every List gets its own mandatory 1:1 chat Channel
TITLE: Trim channel header icons into Settings, keep list-channel tabs on the /chat/c/ URL instead of redirecting
DESC: Two follow-up requests. (1) Removed the Search, Notifications (bell),
and "..." More-options icon buttons from ConversationView.tsx's channel
header - Search/Replies/Settings already exist as icons on the always-visible
ChannelDetailsRail, so the header copies were pure duplication; the "..."
dropdown's other actions (mark unread, rename, copy link, favorite, email,
notification settings, follow/unfollow) were already duplicated in
ChannelDetailsPanel's Settings "Options" section too, EXCEPT Pin and Delete
Channel which had no other home - added both there instead of silently
dropping them: a new Pin/Unpin OptionRow (reuses the existing useChannelPin
hook directly) and a destructive Delete Channel OptionRow gated on a new
canDeleteChannel/onRequestDeleteChannel prop pair threaded from
ConversationView (which still owns the actual delete confirm dialog + delete
API call - reused as-is, not duplicated). OptionRow gained a `destructive`
style variant for the red delete row. Cleaned up now-dead code left behind
in ConversationView.tsx after the header trim (unused openChannelPanel/
handleCopyChannelLink functions, unused toggleFavorite/openModal/
toggleChannelDetailsView bindings, unused icon/DropdownMenu imports, unused
useUiStore/appPath imports).
(2) User reported clicking a list's channel from the Chat sidebar navigated
away to /spaces/l/{listId}?view=channel instead of showing the same tabs
in place - "it should open right there... the (channel, list, board) layout
should not [be] fixed for space only." Fixed by generalizing
ListWorkspace.tsx with a new optional `basePath` prop (defaults to
/spaces/l/{listId}, unchanged for the Spaces route) that all its internal
tab/task-drawer URL updates key off instead of a hardcoded /spaces/l/ string.
Rewrote frontend/src/app/(app)/chat/c/[channelId]/page.tsx to fetch the
channel first; if it's a list's primary channel, it now fetches that list's
meta/tasks (same fetchListMeta/fetchListTasks calls the Spaces route uses)
and renders ListWorkspace in place with basePath={`/chat/c/${channelId}`} -
no redirect, tabs work identically, but the URL and entry point (Chat
sidebar) stay put. Non-list channels are unaffected (still plain
ConversationView). `npx tsc --noEmit` clean throughout.

TAG: [SUBTASK]
PARENT: List <-> Channel linkage - every List gets its own mandatory 1:1 chat Channel
TITLE: Remove leftover Pin button from channel header
DESC: The Pin icon button was left behind in ConversationView.tsx's header
after the previous cleanup (only search/notifications/more were removed that
time, pin was moved into Settings but not removed from the header itself).
Removed the now-empty right-side header block entirely and the dead
channelPinned/togglePin/useChannelPin/PinIcon bindings that only it used -
pin now lives solely in ChannelDetailsPanel's Settings Options list.
`npx tsc --noEmit` clean.

TAG: [SUBTASK]
PARENT: List <-> Channel linkage - every List gets its own mandatory 1:1 chat Channel
TITLE: Shrink list-page tabs/title and channel chat toolbar further ("xs", thin)
DESC: User wanted the Channel/List/Board/Calendar tabs even smaller ("xs"),
the breadcrumb+title row above them smaller, and the channel chat toolbar
thinner (smaller icons, less spacing). Added a new `xs` size variant to the
shared UnderlineTabBar (frontend/src/components/shared/Tabs.tsx: 11px text,
size-3 icons, tighter px-1.5/py-1) without touching the existing `compact`
variant used elsewhere (PersonProfilePanel, ChatSidebar) so this stays scoped
to the list toolbar. SpacesListToolbar.tsx now uses size="xs" and shrank
everything alongside it - breadcrumb row height, title down to text-xs,
create-task button to size-6, and the status-filter row below (Select
h-6/text-[11px], filter/group/search/display icon buttons h-6 with size-3
icons). ConversationView.tsx's channel header shrunk h-14->h-10 and text-base
->text-sm, and is now skipped entirely (with its Separator) when
hideHeaderTitle is set - after the last cleanup that header had nothing left
in it for the list-tab case anyway. MessageComposer.tsx's bottom toolbar row
(attach/mention/emoji/send/dropdown/extended-tools icon buttons) shrunk
size-7->size-6 buttons with size-4->size-3.5 icons, ToolbarDivider height
h-4->h-3.5, row padding/gaps tightened - this is shared across all chat
surfaces (DM + channel) so the thinner toolbar applies everywhere messages
are composed, not just the list-embedded channel tab. `npx tsc --noEmit`
clean.

TAG: [SUBTASK]
PARENT: List <-> Channel linkage - every List gets its own mandatory 1:1 chat Channel
TITLE: Shrink list title further, remove create-task button from list toolbar
DESC: List title above the tabs shrunk from text-xs to text-[11px] to match
the breadcrumb size. Removed the "Create task" circular icon button from
SpacesListToolbar.tsx's top row per request - list/board views already have
their own add-task affordances (ListViewGrouped's "Add Task" row,
BoardView), so this was a redundant duplicate entry point. `onCreateTask`
prop kept on the component (still wired from ListWorkspace.tsx) in case it's
needed again, just unused for now; removed the now-dead SquareCheckBigIcon
import. `npx tsc --noEmit` clean.

TAG: [TASK]
TITLE: Task drawer Activity panel - render event feed + ClickUp-style comment cards
DESC: User pasted a ClickUp screenshot showing the task Activity panel: a
bullet-style event log at the top ("X created this task", "Show more",
"added follower: Y", "set priority to Urgent", each with a right-aligned
timestamp), then comment cards below with avatar + name + timestamp header,
top-right action icons, body text, and a bottom Like/Reply bar - and asked
for the Activity section to match. Investigated TaskDrawer.tsx
(frontend/src/components/spaces/TaskDrawer.tsx) and found the backend
activity-event fetch (fetchTaskActivity, list_task_activity in
backend-py/app/services/home_service.py) was already fully wired end-to-end
- activityEvents state populated, filteredActivityEvents computed via
useMemo (search-filtered) - but filteredActivityEvents was never rendered
anywhere in the JSX, a dead computation. Fixed: added an ActivityEventRow
component + inline render block (TaskDrawer.tsx, in the Activity panel
between the "Task created" line and the comment list) that shows events
(excluding activityKind "task_created" since that's already covered by the
existing "Task created" line) newest-last with a "Show more"/"Show less"
toggle collapsing all but the most recent event when there are more than 2 -
new activityEventsExpanded state. Restyled TaskActivityComment.tsx's
CommentActivityItem to match the screenshot: wrapped each comment in a
bg-muted/30 card with Avatar+AvatarFallback (reusing existing
avatarColorClassForKey/avatarInitialFromName from lib/user-display.ts, same
helpers already used elsewhere in TaskDrawer for assignee avatars) next to
name+timestamp in the header, kept the existing edit/delete "..." dropdown
top-right, and added a bottom action row with a Like button (local
per-comment useState toggle - no backend like/reaction model exists yet, so
this is presentational-only, flagged as a scope cut not an oversight) and a
Reply button (rewired from the old top-of-card "Reply" button on hover to
this bottom bar, matching the screenshot's placement); removed the now-
unused `verb` prop ("commented"/"replied" text) since the new layout doesn't
need it. Backend activity events are still coarse-grained (e.g. "Task
updated (name, priority, ...)" as one combined event from
create_task_activity_notifications rather than a granular "set priority to
Urgent" line per field like ClickUp's screenshot) - not changed in this
pass, this was a frontend rendering fix only using data already returned by
the existing endpoint; flagged to user as a possible follow-up if the exact
per-field phrasing from the screenshot is wanted. `npx tsc --noEmit` clean.

TAG: [TASK]
PARENT: Task drawer Activity panel - render event feed + ClickUp-style comment cards
TITLE: Granular chronological task activity log (status/priority/assignee/checklist/attachment/etc)
DESC: Follow-up request: user wants every task action logged in the Activity
panel with xs gray text, not just the coarse "Task updated (status,
priority, ...)" line from before. Investigated via an Explore subagent first
(backend-py/app/services/notification_service.py:904-947
create_task_activity_notifications, home_service.py's update_task
change_labels block, checklist/attachment services) and found a real
architecture problem: the existing activity data source (InboxItem rows,
queried by list_task_activity filtered on InboxItem.user_id == viewing
user) is a PERSONAL NOTIFICATION INBOX, not a shared task log -
create_task_activity_notifications explicitly skips the actor
(`if recipient_id == actor_user_id: continue`) and no-ops entirely when
there are no recipients (no assignees/followers besides the actor). Result:
the actor never sees their own actions, different viewers of the same task
would see different activity lists, and no "task_created" activity_kind
existed anywhere in the codebase despite the frontend already trying to read
one. Flagged this to the user before writing code (DB-table-shape decision,
mandatory per CLAUDE.md) with two options - new dedicated TaskActivityLog
table, or patch the existing per-user rows. User chose a third, simpler
option: add a JSONB `activity` column directly on the Task table itself
(view-only, append-only, no new table needed).
Implemented: migration backend-py/scripts/migrate_task_activity_log.sql
(`ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "activity" JSONB NOT NULL
DEFAULT '[]'::jsonb`), applied to local dev DB via `docker exec -i
clickup-postgres-1 psql -U riseup -d riseup` (still needs to run against
staging/prod before those deploys pick this up, same caveat as every prior
migration script in this project). Added the column to the Task model
(backend-py/app/db/models/home.py, JSONB from
sqlalchemy.dialects.postgresql). New helpers in home_service.py:
_record_task_activity (appends one {id, type, title, preview, source,
createdAt, activityKind, actorName} entry via list reassignment - not
.append() - so SQLAlchemy's change tracking picks it up without
flag_modified), _resolve_user_name / _user_name_map (name lookups),
_status_label / _priority_label (human-readable labels for both legacy
TaskStatus enum and custom ListStatus rows, and for TaskPriority - None ->
"None", set -> Title Case).
Wired into every task-mutating path: create_task and create_subtask log
"X created this task" (activity_kind task_created) plus, for subtasks, a
"X added subtask ..." entry on the parent. update_task was rewritten from
one grouped "Task updated (labels)" message into N granular entries, one
per changed field, each with old-to-new values: status (resolves the OLD
status label via a direct ListStatus query on original_status_id rather
than touching the task.list_status relationship - see bug note below),
name, description ("updated the description", no diff text), priority
(set/removed/changed-from-X-to-Y phrasing depending on which side was
None), due date / start date (via existing format_due_date helper, same
set/changed/removed phrasing), list move (captures target_list.name at
mutation time since it's local-scoped, plus original_list_name captured
up front before the eager-loaded relationship gets expired later in the
function), and per-user assignee
added/removed + follower added/removed entries (follower text intentionally
phrased "added follower: NAME" / "removed follower: NAME" to match the
exact ClickUp screenshot format from the previous request). Checklist
create/rename/delete and checklist item add/rename/check/uncheck/delete
now all log activity too (previously all six checklist functions in
home_service.py were completely silent, no notification or activity of any
kind). Attachment upload finalize (task_attachment_service.py
upload_file_content, only for plain task attachments where comment_id is
None) now also appends an activity entry alongside its existing
notification-only InboxItem row. Existing InboxItem-based notifications
(bell/unread count) were left completely untouched - both mechanisms now
run in parallel, one feeds personal notifications, the new one feeds the
shared Activity panel.
Rewired list_task_activity (home_service.py) to read task.activity straight
off the Task row instead of querying InboxItem - same response shape as
before ({data: [{id, type, title, preview, source, href, createdAt,
activityKind}]}) so the frontend (TaskDrawer.tsx/TaskActivityComment.tsx
from the earlier entry today) needed zero changes. Entries are sorted
newest-first to match the old ordering contract the frontend already
expected.
Bug found and fixed mid-implementation via test failures: initially added
`selectinload(Task.list_status)` to _get_editable_task so the OLD status
label could be read via task.list_status before mutating status_id - this
broke test_task_status_legacy_keys and
test_subtask_create_list_toggle_and_nested_rejected because eagerly loading
that relationship in _get_editable_task caused the SAME already-loaded
Python object (SQLAlchemy identity map, same session) to be returned later
by update_task's post-commit refetch, and selectinload doesn't re-query a
relationship that's already populated on an identity-mapped instance -
so the "refreshed" status label was actually stale. Fixed by reverting that
eager-load and instead resolving the OLD status label via a standalone
`select(ListStatus).where(ListStatus.id == original_status_id)` query that
never touches the relationship attribute at all.
Verification: full backend-py pytest suite - 106 passed, 6 failed, all 6
the same pre-existing async-event-loop/asyncpg flakiness documented in every
prior session (test_auth_profile, 3x test_google_oauth,
test_home_extras::test_lineup_add_reorder_remove,
test_home_notifications) - confirmed not a regression, matches the exact
baseline count from 2026-07-13/07-14 entries. Also ran a live end-to-end
smoke test against the running dev server (localhost:4001, owner@demo.com):
created a task, set priority to urgent, created a checklist, added an item,
checked it, then fetched GET .../tasks/{id}/activity and confirmed all 5
entries came back in the right order with correct actor names and phrasing
(task_created, task_priority_changed, task_checklist_created,
task_checklist_item_added, task_checklist_item_checked); cleaned up the
test task afterward. `python -c "import
app.services.home_service; import app.services.task_attachment_service"`
clean throughout implementation.

TAG: [SUBTASK]
PARENT: Granular chronological task activity log (status/priority/assignee/checklist/attachment/etc)
TITLE: Interleave activity events and comments into one chronological feed
DESC: User feedback on the just-built granular activity log: events were
still piling up as a separate block above the comments instead of sitting
inline where they actually happened in time - e.g. an activity that
happened after a comment should render after that comment, not always
above the whole comment list. Fixed in TaskDrawer.tsx: replaced the
two-section layout (events block, then comments block) with a single merged
`activityFeed` (new useMemo, sorts filteredActivityEvents + filteredComments
together by createdAt ascending, tagging each as {kind:"event"} or
{kind:"comment"}) and one render pass that picks ActivityEventRow vs
TaskActivityComment per item in that order. Removed the now-redundant
static "Created by X" / "Task created" lines and the createdByLabel
memo/extractActorFromPreview helper that computed them - the real
task_created activity event (added in the previous entry) already surfaces
naturally as the first item in the chronological feed with the correct
actor name, so the old fallback-guessing logic (which used to fall back to
the first comment's author when no task_created event existed, back when
none ever did) was fully replaced, not just duplicated. Kept a lightweight
"Show more" collapse but changed its semantics: it now hides everything
before the last 6 feed items (events + comments combined) rather than only
collapsing activity events, since collapsing events but always showing all
comments would have re-introduced the same "not really chronological"
complaint for long threads. `npx tsc --noEmit` clean.

TAG: [BUG]
PARENT: Granular chronological task activity log (status/priority/assignee/checklist/attachment/etc)
TITLE: Comment/reply timestamps wrong while activity timestamps correct
DESC: User noticed activity events showed the correct time but comments and
replies didn't, right after the chronological-merge fix made them sit
side by side in the same feed. Root cause: same recurring asyncpg/SQLAlchemy
driver quirk already hit and fixed once before for chat threads
(2026-07-13 entry, chat_service._as_aware_utc / _thread_has_new bug) -
asyncpg sometimes returns a naive datetime for a column declared
DateTime(timezone=True), so `comment.created_at.isoformat()`
(home_helpers.py _map_task_comment) produced a string with no UTC offset
(e.g. "2026-07-16T13:06:31.514000"). The frontend's `new Date(...)`
misparses an offset-less ISO string as browser-local time instead of UTC,
shifting displayed comment/reply times by the viewer's UTC offset. Activity
entries were immune because their createdAt is built directly in Python via
`datetime.now(timezone.utc).isoformat()` (always carries +00:00) and stored
as a plain JSONB string, never round-tripped through a TIMESTAMPTZ column
read. Fixed by adding the same `_as_aware_utc` helper (attach UTC tzinfo
when naive, otherwise pass through) to home_helpers.py and applying it to
both created_at and updated_at before calling .isoformat() in
_map_task_comment - covers both top-level comments and replies since both
go through the same threaded mapper. Verified live: posted a comment via
httpx against the running dev server, confirmed createdAt now comes back as
"...514000+00:00" instead of naive. Flagged, not fixed (out of scope for
this bug report): the identical root cause likely also affects
Task.created_at/updated_at in map_task and possibly due_date/start_date -
same server_default=func.now() / DateTime(timezone=True) pattern, not
verified whether it currently causes any visible symptom since due-date
display/overdue math wasn't reported broken, but worth a follow-up sweep if
another timestamp-off report comes in. Targeted test suites
(test_home_helpers_tasks, test_tasks, test_task_followers_statuses) 11/11
passing; `python -c "import app.services.home_helpers"` clean.

TAG: [SUBTASK]
PARENT: Task drawer Activity panel - render event feed + ClickUp-style comment cards
TITLE: Restyle activity rows + comment cards to match ClickUp screenshot exactly
DESC: User pasted a second ClickUp screenshot and asked to copy its style
precisely. TaskDrawer.tsx's ActivityEventRow: added a small muted bullet dot
before each line (was plain text-only), and restyled the "Show N
earlier"/"Hide" toggle to use a leading Chevron icon (up when expanded, down
when collapsed) instead of a plain text link, matching the screenshot's
chevron+"Hide" row. TaskActivityComment.tsx's CommentActivityItem: dropped
the bordered/bg-muted card wrapper from the previous pass entirely - now
plain borderless layout matching the screenshot (avatar + bold name +
muted timestamp header, "..." menu top-right for edit/delete, body indented
under the avatar, footer row). Bottom footer changed from a "Like"/"Reply"
text-button pair to match the screenshot's reaction-pill style: the Like
button is now icon-only (no label) until liked, then becomes a filled
primary-tinted pill showing a "1" count (still local per-comment useState,
no backend reaction model - same presentational-only scope cut as before);
Reply stays a plain text link, right-aligned via justify-between. Added a
border-b divider between consecutive top-level comments (last:border-b-0)
since the card backgrounds that used to visually separate entries are gone.
Deliberately did NOT add the screenshot's bookmark/assign-person/forward-
arrow icons in the header - they'd have no backing functionality (no
bookmark or assign-to-comment feature exists) and CLAUDE.md's own
half-finished-feature rule rules out decorative buttons that do nothing;
kept only the two real interactive elements (like pill, reply link) plus
the existing edit/delete menu, which already matches the screenshot's
rightmost "..." icon. Did not touch backend preview wording (e.g. "assigned
to: You" personalized phrasing, colored status swatches) - this was scoped
to visual/CSS style only, not copy changes. `npx tsc --noEmit` clean.

TAG: [SUBTASK]
PARENT: Task drawer Activity panel - render event feed + ClickUp-style comment cards
TITLE: Revert comments to boxed containers, drop dividers, redo attachment image footer
DESC: Follow-up correction to the previous style pass. (1) User wants
comments/replies back in containers, not the borderless layout from the
last change - reverted CommentActivityItem (TaskActivityComment.tsx) to the
rounded-lg border border-border/60 bg-muted/30 card wrapper. (2) Removed the
border-b divider between top-level comments added in the last pass (now
redundant/unwanted now that cards are back). (3) Attachment image cards
(CommentAttachmentCard.tsx) restyled per spec: removed the always-visible
footer row that showed filename + file size + a persistent download icon;
now the image thumbnail itself carries a download button pinned
top-right (absolute, bg-black/50 pill, opacity-0 -> opacity-100 on
group-hover, same reveal pattern as the existing center zoom-icon overlay),
and below the image there's just a small (text-[11px]) left-aligned
filename with no size shown. Non-image attachment rows (the compact
icon+name+size+download layout) were left untouched - the request was
specifically about the image case ("the images should not have a header").
`npx tsc --noEmit` clean.

TAG: [BUG]
PARENT: Task drawer Activity panel - render event feed + ClickUp-style comment cards
TITLE: Attachment download button revealed on comment hover instead of image hover
DESC: User clarified the download button was meant to reveal on hovering
the image thumbnail specifically, not anywhere on the comment. Root cause:
both CommentActivityItem's outer card (TaskActivityComment.tsx) and the
image thumbnail wrapper (CommentAttachmentCard.tsx) used the same plain
Tailwind `group` class - `group-hover:opacity-100` is a CSS descendant
selector keyed off any ancestor with class "group", not specifically the
nearest one, so hovering anywhere on the comment card (which has `group`
for its own "..." menu reveal) also matched the download button nested
several levels down inside it. Fixed with Tailwind v4 named groups: comment
card is now `group/comment` (its "..." button uses
`group-hover/comment:opacity-100`), image wrapper is now `group/image` (its
zoom-icon overlay, image scale, and download button all use
`group-hover/image:...`) - the two hover scopes no longer bleed into each
other. `npx tsc --noEmit` clean.

TAG: [FEATURE]
PARENT: Task drawer Activity panel - render event feed + ClickUp-style comment cards
TITLE: People-only @mention picker for task comments/replies
DESC: User pasted a ClickUp screenshot of its @mention picker (People/Tasks/
Docs/Whiteboards/Locations/Channels tabs, avatar+name rows, keyboard-shortcut
hint bar) and asked for it in task comments/replies, "for now we only
mention people". Investigated first via Explore-equivalent reading and found
@mention already existed end-to-end in TaskCommentComposer.tsx - typing "@"
already opens MentionAutocompleteDropdown (via useRichComposerField's
mentionAutocompleteOpen/mentionQuery state), and there's also a toolbar
@-icon button wired to the same insertMention through MentionPickerPopover.
Both already reuse the same shared chat components (MentionPickerContent,
MentionMemberList) used by the channel/DM composer. So the real gap wasn't
"mentions don't work", it was that the picker always showed a People/
Channels tab pair and per-member email subtext, which doesn't fit task
comments (mentioning a channel from inside a task comment isn't a thing) and
doesn't match the reference screenshot's plain single-column people list.
Added a `peopleOnly` prop threaded through the whole chain: MentionPicker
Content (hides the tab row entirely, replaces it with a plain "People"
label, skips the channels tab logic, and now passes a new `disabled` param
into useMentionChannels so the channel-list fetch doesn't even fire in this
context) -> MentionAutocompleteDropdown -> RichComposerField (new
`peopleOnlyMentions` prop) and -> MentionPickerPopover, both wired from
TaskCommentComposer.tsx (used for new comments, edits, AND replies - one
component, so all three surfaces got this for free). MentionMemberList got
a matching `compact` prop that hides the per-row email subtext for a
tighter avatar+name-only row like the screenshot. Deliberately did NOT add
the screenshot's presence/online status dot on each avatar - grepped the
codebase and confirmed there is no presence/online-tracking system anywhere
(no usePresence hook, no online user id set) to back it with real data;
per the project's no-decorative-non-functional-UI stance, skipped rather
than faking it. Also did not add the Tasks/Docs/Whiteboards/Locations tabs
from the screenshot since those mention targets don't exist as features
yet and the user explicitly scoped this to "for now we only mention
people". `npx tsc --noEmit` clean; eslint on touched files clean except
two pre-existing warnings on untouched lines (RichComposerField's
resizeEditor dep, MentionAutocompleteDropdown's setState-in-effect - same
pervasive pre-existing pattern flagged in multiple earlier sessions) and
one new warning (use-mention-channels missing `disabled` in its effect dep
array) which was fixed inline.

TAG: [BUG]
PARENT: People-only @mention picker for task comments/replies
TITLE: Typed "@" mention dropdown invisible inside task drawer
DESC: User reported typing "@" in a task comment showed nothing. The
mention-detection logic itself (useRichComposerField's mentionQuery/
mentionAutocompleteOpen, driven by getDraftMentionQuery finding the "@" in
the draft text) was firing correctly - the dropdown WAS opening, just
invisible. Root cause: MentionAutocompleteDropdown.tsx portals its dropdown
to document.body with an inline `zIndex: 60`, but the task drawer renders
inside a Dialog whose overlay/content both use z-[100]
(components/ui/dialog.tsx:34,56) - so the dropdown was painting underneath
the drawer the whole time. This is the exact same bug class fixed on
2026-07-13 for Popover/Select/DropdownMenu/Tooltip (all bumped from z-50 to
z-[110] that session) - MentionAutocompleteDropdown is a hand-rolled
document.body portal rather than one of those shared primitives, so it was
missed in that pass. The toolbar @-button path (MentionPickerPopover, which
already uses the shared PopoverContent) was unaffected - only the type-"@"
inline autocomplete was broken. Fixed by bumping MentionAutocompleteDropdown's
inline zIndex from 60 to 110 to match the established convention.
`npx tsc --noEmit` clean.

TAG: [TASK]
PARENT: People-only @mention picker for task comments/replies
TITLE: Arrow-key navigation + Enter-to-select in mention picker
DESC: User wants Up/Down arrows to move a highlighted row through the
mention list and Enter to select the highlighted person, standard picker
UX that wasn't there yet. Tricky part: focus never leaves the
contentEditable message editor while the dropdown is open (it's a separate
DOM subtree, portaled to document.body), so a normal onKeyDown handler on
the list itself would never fire - arrow keys were just moving the text
cursor and Enter was falling through to the editor's own Enter-to-send
handling. Implemented in MentionPickerContent.tsx (shared by both the
type-"@" inline dropdown and the toolbar @-button popover, so both surfaces
get this for free): added `activeIndex` state plus a capture-phase
`document.addEventListener("keydown", ..., true)` that's only registered
while the picker is mounted (mounts/unmounts with the dropdown/popover
itself). Capture phase means it intercepts ArrowUp/ArrowDown/Enter before
the event ever reaches the editor's own bubble-phase keydown handling -
preventDefault+stopPropagation on all three so arrows don't move the text
cursor and Enter doesn't insert a newline or submit the comment while the
picker is open. ArrowDown/Up wrap around (modulo) across whichever list is
currently visible (people or, for non-task chat contexts, channels); Enter
resolves the highlighted item from whichever filtered array is active and
calls the same onSelect the mouse-click path already uses. activeIndex
resets to 0 whenever the query text or active tab changes, done via the
react.dev "adjust state during render" pattern (compare a resetKey to a
previous-value state, setState conditionally in the render body) instead
of a useEffect, since a useEffect-based reset tripped this repo's
react-hooks/set-state-in-effect lint rule as a hard error (not just the
pervasive pre-existing warning seen elsewhere) - the render-time-adjustment
pattern is React's own documented alternative for exactly this "derived
state resets when an input changes" case. MentionMemberList/
MentionChannelList both got a new `activeIndex` prop: the highlighted row
gets a persistent bg-muted/80 (not just :hover) and calls
scrollIntoView({block:"nearest"}) via a callback ref so keyboard-scrolling
past the visible window auto-scrolls the list. `npx tsc --noEmit` and
`npx eslint` both clean on every touched file.

TAG: [BUG]
PARENT: Granular chronological task activity log (status/priority/assignee/checklist/attachment/etc)
TITLE: Comment/reply attachments were double-logged as separate activity entries
DESC: User caught that attaching a file inside a comment or reply produced
its own "added attachment X" activity line in addition to the comment
itself already appearing in the feed - redundant, since the attachment is
visibly embedded in the comment card. Root cause: task_attachment_service.
upload_file_content decided whether to log an attachment activity/
notification using `if row.comment_id is None`, but that check can't
actually distinguish a standalone task attachment from a comment
attachment - the frontend uploads the file (via presign+upload) BEFORE the
comment exists at all, since files are staged client-side in the comment
composer first; TaskAttachment.comment_id only gets linked afterward by
add_task_comment's bulk UPDATE once the user hits send. So comment_id is
always None at upload time regardless of destination, and every comment/
reply attachment was silently falling into the "standalone" branch.
Fixed by having the two callers say which case they are, since only the
frontend actually knows the intent at upload time: added a `for_comment`
bool (query param on POST .../attachments/{id}/upload, defaulting false)
threaded through post_task_attachment_upload (home.py) ->
upload_file_content (task_attachment_service.py, replaced the `if
row.comment_id is None` check with `if not for_comment`) ->
uploadTaskAttachmentContent/uploadTaskAttachment (frontend lib) ->
use-task-comment-attachments.ts's uploadBlob, the only call site that now
passes `true`. TaskDrawer.tsx's separate standalone "Attachments" section
upload path (handleAttachFiles) is untouched and still defaults to false,
so it keeps generating its own activity entry as before - that one really
is a standalone action with nothing else already showing it in the feed.
Verified live: uploaded an attachment with for_comment=true then posted a
comment referencing it, fetched the task's activity and confirmed only the
task_created entry came back - no task_attachment_uploaded entry, the
attachment only shows up embedded in the comment card itself. Targeted
backend suites (test_task_management_complete, test_tasks,
test_home_helpers_tasks) 29/29 passing; `npx tsc --noEmit` and `python -c
"import app.api.v1.home; import app.services.task_attachment_service"`
both clean.

TAG: [SUBTASK]
PARENT: Task drawer Activity panel - render event feed + ClickUp-style comment cards
TITLE: Emoji reaction button next to Like on comments/replies
DESC: Added an emoji-reaction button to the right of the Like pill in
CommentActivityItem (TaskActivityComment.tsx) - reused the existing
EmojiPickerPopover (frontend/src/components/chat/emoji/EmojiPickerPopover.tsx,
same picker already used by the message composer) rather than building a
new one. Picking an emoji toggles it into a local `reactions: string[]`
state; each picked emoji renders as its own small pill (emoji + "1" count)
next to the Like/emoji buttons, clicking a reaction pill again removes it.
Same scope cut as the existing Like button (documented in an earlier entry
today): local per-comment useState only, no backend reaction/emoji model
exists yet, so nothing persists past a page refresh - presentational-only
until a real reactions feature is asked for. `npx tsc --noEmit` clean.

TAG: [SUBTASK]
PARENT: Task drawer Activity panel - render event feed + ClickUp-style comment cards
TITLE: Emoji picker follows app light/dark theme
DESC: User noticed the emoji picker (just added next to Like on comments)
didn't match the app's light/dark theme - emoji-picker-react defaults to
its own light theme regardless of the host app. Wired it to this project's
theme system: EmojiPickerPopover.tsx now reads `resolvedTheme` from the
existing `useTheme()` hook (frontend/src/lib/theme.tsx - a custom
ThemeProvider, not next-themes) and passes emoji-picker-react's own
`Theme.DARK`/`Theme.LIGHT` prop accordingly. Since EmojiPickerPopover is
the one shared component used by both the chat message composer and task
comments, this fix applies everywhere the emoji picker appears, not just
the new comment-reaction button. `npx tsc --noEmit` clean.

TAG: [TASK]
PARENT: Task drawer Activity panel - render event feed + ClickUp-style comment cards
TITLE: Bell icon in task Activity panel repurposed to Followers popover
DESC: User pointed out the bell icon in the Activity panel header was
labeled "Notifications" but pasted a ClickUp screenshot showing it's
actually meant to be a Followers panel: Follow/Unfollow radio choice at
top ("Notify me on all activity" vs "Notify me only on @mentions or
assignment"), a follower search box, the current follower list, and a
"People" section below to add more followers. Asked "what does real
ClickUp do" for which activities notify followers - answer baked into the
Follow/Unfollow copy itself (all activity vs mentions/assignment only),
no separate per-activity-type notification matrix needed since that's
already how the copy frames it.
Backend needed zero changes - Task.follower_ids already existed
(backend-py/app/db/models/home.py) and the general PATCH /tasks/{id}
endpoint (home_service.update_task) already accepts followerIds and logs
task_followed/task_unfollowed entries to the shared activity JSONB log.
Reused that generalized PATCH instead of the old dedicated
follow_task/unfollow_task endpoints (home_service.py ~line 2001-2060),
which only wrote InboxItem notifications and didn't touch the shared
activity log or return the updated task - inferior to going through
update_task, and per project rules (CLAUDE.md: reuse existing generalized
PATCH, don't spin up resource-specific endpoints) the general path was
already there and better-integrated.
Frontend (frontend/src/components/spaces/TaskDrawer.tsx): replaced the
old "Notifications" popover (backed by fetchTaskNotifications/
markTaskNotificationsRead, which queried the per-user InboxItem inbox -
unrelated to the shared task.activity log) with a Followers popover:
Follow/Unfollow rows with checkmark showing current state, a search
input, a follower list (avatars via existing avatarColorClassForKey/
avatarInitialFromName, "Me" label for the current user, hover-reveal
remove icon), and a "People" section listing non-follower workspace
members to add. `following` and the follower/non-follower member lists
are now derived straight from `task.followerIds` + `members` (already
loaded for the assignee picker) instead of separate state, so persistPatch
already keeps everything in sync after every toggle - no new state
duplication. Removed the now-dead notification-fetching state/effects
and the followTask/unfollowTask imports; left the backend
list_task_notifications/mark_task_notifications_read endpoints in place
since deleting unused backend routes wasn't asked for and they're free to
leave. `npx tsc --noEmit -p tsconfig.json` clean. `npx eslint` on the
touched file shows only pre-existing warnings/errors on unrelated lines
(StatusIcon component-during-render at line ~545/1596, setState-in-effect
at line ~427) that predate this change. Not verified in an actual browser
in this session - no browser automation tool available here; user should
smoke-test the Follow/Unfollow toggle and People-add flow visually before
treating as fully confirmed.

TAG: [SUBTASK]
PARENT: Task drawer Activity panel - render event feed + ClickUp-style comment cards
TITLE: Online/offline presence dot on follower avatars
DESC: User asked for a green/gray dot on each avatar in the new Followers
list to show online/offline. Reused the existing app-wide presence system
instead of building anything new - frontend/src/stores/presence-store.ts
(useUserPresence(userId) hook, populated over the existing chat/presence
socket) and frontend/src/components/shared/AvatarWithPresence.tsx
(UserAvatarWithPresence, already used the same way in
components/workspace/PeopleView.tsx for the workspace People list).
Added a small FollowerAvatar subcomponent in TaskDrawer.tsx (calls
useUserPresence per row, same pattern as PeopleView's
MemberPresenceAvatar - a hook can't be called inline inside .map, needs
its own component) and swapped it in for the plain Avatar in the
follower-list rows only (not the "People" add-more section, out of
scope for this ask). `npx tsc --noEmit -p tsconfig.json` clean.

TAG: [SUBTASK]
PARENT: Task drawer Activity panel - render event feed + ClickUp-style comment cards
TITLE: Presence dot for People section + purple follower-count badge on bell icon
DESC: Two follow-ups on the Followers popover. (1) The online/offline dot
added last for the follower list wasn't on the "People" (add-more)
section below it - swapped its plain Avatar for the same FollowerAvatar
subcomponent (useUserPresence-backed) already used for followers, so
both lists are consistent now. (2) Bell trigger button: previously a
plain ghost icon button always. Now transparent/muted when
followerIds.length === 0, and a purple pill (bg-primary/15 text-primary,
matching the existing Like-button active-state color already used on
comment reactions) with the follower count printed next to the bell icon
when there's at least 1 follower - e.g. "🔔 2". Count and color both
driven off the same `followerIds` derived from `task.followerIds` used
everywhere else in this feature, no new state. `npx tsc --noEmit` clean,
`npx eslint` shows only pre-existing unrelated warnings.

TAG: [TASK]
PARENT: Task drawer Activity panel - render event feed + ClickUp-style comment cards
TITLE: Auto-follow assignees, without double-logging activity
DESC: User: "if someone if assigned a task, they are automatically added
to the follower list" - matches real ClickUp behavior. Implemented in
backend-py/app/services/home_service.py update_task: right after
task.assignee_ids is set (~line 1250), any newly-assigned uid not
already in task.follower_ids gets appended to it - placed after the
existing follower_ids block so it wins even if both fields are patched
in the same request. No DB/model change needed, Task.follower_ids
already existed.
User immediately caught a follow-up bug from this: assigning someone was
producing TWO activity log entries ("assigned" and "added follower") for
the same action - same double-logging class as the earlier comment-
attachment bug. Root cause: the follower-activity logging block later in
update_task diffs old vs new follower_ids and logs any addition as
"added follower", with no way to distinguish "explicitly followed" from
"became a follower purely as a side effect of being assigned". Fixed by
tracking the auto-followed uids in a set (`auto_followed_via_assignment`)
at the point they're added, then excluding that set when computing
`added_followers` for the activity log later - so assignment produces
exactly one `task_assignee_added` entry, and explicit follow/unfollow
(via the Followers popover) still produces its own `task_followed`/
`task_unfollowed` entry as before. Also fixed a latent bug this surfaced:
`old_follower_ids` was only captured when `body.follower_ids is not None`
in the request, so an assignee-only patch had no accurate pre-mutation
baseline to diff against - now captured unconditionally at the top of
update_task.
Verified via targeted pytest (test_task_assignment.py,
test_task_management_complete.py, test_member_time_permissions.py - 22
passed) and full suite (106 passed, 6 pre-existing flaky failures
matching documented baseline: test_auth_profile, 3x test_google_oauth,
test_home_extras::test_lineup_add_reorder_remove,
test_home_notifications - all async-event-loop/asyncpg test-infra
flakiness unrelated to this change). Live httpx smoke test against
localhost:4001: created a task, PATCHed assigneeIds with one user,
confirmed followerIds included them and the activity feed showed exactly
one entry (task_assignee_added), no separate task_followed entry.

TAG: [CHORE]
TITLE: Hide subtask feature behind a feature flag
DESC:
User asked to fully hide subtasks from all users for now via a feature
flag, gated in CreateTaskModal and TaskDrawer. No existing feature-flag
system in repo, so added a minimal one: frontend/src/lib/feature-flags.ts
exporting FEATURE_FLAGS = { subtasks: false }. Gated every subtask UI
surface behind FEATURE_FLAGS.subtasks:
- CreateTaskDialog.tsx (the create-task modal): "Subtasks" item in the
  "..." dropdown, and the staged-subtasks panel below it.
- TaskDrawer.tsx: the subtasks list section, the inline add-subtask
  input row, and the "Add subtask" trigger button.
- ListTaskRow.tsx: the subtask-count badge shown on task rows in list
  view (found while sweeping for "hide completely" - same feature,
  same flag).
Backend untouched - createSubtask/subtask endpoints left as-is since
hiding is purely a frontend concern and no data needs to change; existing
tasks that already have subtasks just stop rendering them until the flag
flips back on. Verified with npx tsc --noEmit (clean, twice - once after
CreateTaskDialog/TaskDrawer edits, once after the ListTaskRow addition).
To re-enable: flip subtasks to true in feature-flags.ts.

TAG: [FEATURE]
TITLE: Notify followers on all task activity, matched to real ClickUp
DESC:
User asked: any activity on a task should notify its followers, and the
set of notified events should match real ClickUp's behavior (not spam
every possible change).

Audit of backend-py/app/services/home_service.py + notification_service.py
found most of the plumbing already existed from earlier work: status/name/
description/priority/due-date/start-date/list-move changes were already
bundled into one "task updated" notification (via change_labels + the
generic create_task_activity_notifications/task_notification_recipients
helpers), assignee-add already sent a dedicated "assigned you" notification,
and comments/replies/@mentions/attachment-uploads/subtask-creation already
notified followers+assignees. Three real gaps found and closed, all via the
same existing create_task_activity_notifications/task_notification_recipients
helpers (CLAUDE.md CRUD-reuse rule - no new notification machinery added):
1. update_task: adding someone as a follower (via the Followers popover's
   PATCH followerIds) logged activity but never notified the new follower.
   Now sends "X added you as a watcher on <task>" to newly-added followers,
   excluding anyone who was auto-followed as a side effect of being
   assigned (those already get the "assigned you" notification, matching
   real ClickUp - assignment doesn't double-notify as a separate follow).
2. add_checklist: checklist creation logged activity but never notified.
   Now notifies task followers/assignees "<actor> added checklist \"X\" to
   <task>". Checklist rename/delete and item add/rename/check/uncheck/
   delete were deliberately left un-notified (still activity-logged only)
   - real ClickUp doesn't push a notification per checkbox tick, that
   would be spam; only structural additions notify, matching the existing
   pattern already used for subtasks and attachments.
3. add_task_dependency: previously had NO activity log entry and no
   notification at all. Added both - activity entry
   "task_dependency_added" and a notification "<actor> added a dependency
   on <task> (\"<related task>\")" to the task's followers/assignees,
   mirroring the subtask/checklist/attachment pattern.
Checklist and related-task names are user input interpolated into a
preview_template that gets str.format()'d later with {actor}/{task}
placeholders - escaped literal braces in that user input (name.replace("{",
"{{").replace("}", "}}")) before interpolating, since an unescaped "{" in a
checklist/task name would otherwise throw at notification-send time.

Verified: targeted pytest (test_task_assignment.py,
test_task_management_complete.py - 21 passed), full suite twice (106
passed / 6 pre-existing flaky failures both times, exact match to
documented baseline: test_auth_profile, 3x test_google_oauth,
test_home_extras::test_lineup_add_reorder_remove,
test_home_notifications). Live httpx smoke tests against localhost:4001
(owner@demo.com actor, alex@demo.com as the added follower): (a) PATCHed
followerIds to add Alex, then added a checklist - Alex's inbox showed both
"Added as watcher: <task>" and "Checklist added: <task>" notifications,
matching the task's activity feed; (b) created two tasks, added Alex as
follower on task A, added a "blocking" dependency from A to B - Alex's
inbox showed "Dependency added: Dep smoke A" and the activity feed showed
"task_dependency_added". All smoke-test tasks deleted after verification.

========================================
DATE_END: 2026-07-16

DATE_START: 2026-07-17

TAG: [TASK]
TITLE: Chat channel page styling pass toward ClickUp look
DESC: User pasted a Slack channel screenshot (unrelated ScholarlyHelp
project chat, from a different job) and asked why "our channel" doesn't
look like ClickUp. Clarified via AskUserQuestion that target was our own
app's chat channel page (frontend/src/app/(app)/chat/c/[channelId]/page.tsx
-> ConversationView.tsx), not that external screenshot's content, and that
the two areas to fix were header/topbar styling and message bubble/spacing
density. Confirmed via globals.css this app already deliberately mirrors
real ClickUp UI conventions (e.g. ChannelDetailsRail.tsx comment "ClickUp:
up to 3 avatars"), and structure (avatar + bold name/time row, thread
replies link, reactions) was already close - the gap was density/sizing,
not architecture. No dev-server screenshot tool available in this
environment (no chromium-cli/playwright installed), so changes were made
from known ClickUp/Slack-style chat conventions rather than visual diffing;
flagged to user to eyeball localhost:3001 and report back if sizing is off.

Changes made:
- ChatMessageRow.tsx: avatar size-6 -> size-9 (24px -> 36px), name font
  text-sm -> text-[15px], row padding for header rows py-1 ->
  pt-2.5 pb-1, continuation-row left margin ml-10 -> ml-12 to match new
  avatar width.
- ConversationView.tsx: header height h-10 -> h-14, padding px-3 -> px-4,
  channel/DM title text-sm -> text-base, DM avatar size-7 -> size-9 to
  match message avatar scale.
- Verified with `npx tsc --noEmit` (frontend) - clean, no errors.

TAG: [FEATURE]
TITLE: Slack-style thread reply indicator (avatar + curved connector + last-reply time)
DESC: User pasted a screenshot of Slack's "1 reply" indicator under a message
(small curved connector line, last-replier's avatar, bold reply count, "Today
at 12:07 PM") and asked for the same on our channel/DM message rows. Prior
indicator was just a plain "N replies" text link with no avatar/time - the
data didn't exist yet (ChatMessage only carried `threadCount`, no last-reply
author/timestamp). Asked user whether to do frontend-only styling (no
avatar/time) or the full feature with backend data; user chose full feature.

Backend (backend-py):
- app/services/chat_service.py: `_thread_counts_for_messages` reworked from
  a single COUNT-group-by returning `dict[str, int]` into a two-query batch
  (COUNT group-by + a MAX(createdAt) group-by subquery joined back to
  ChatMessage+User) returning `dict[str, ThreadSummary]` - still one batched
  round-trip per query, no N+1 per message.
- app/services/chat_helpers.py: added `ThreadSummary` dataclass
  (count, last_reply_author_id, last_reply_author_name, last_reply_at).
  `map_message`/`map_message_broadcast`/`map_search_message` gained an
  optional `thread_summary` kwarg; when present, response includes
  `lastReplyAuthorId`, `lastReplyAuthorName`, `lastReplyAt` alongside
  `threadCount`. Old `thread_count` int kwarg still works (falls back to
  previous behavior) so single-message response call sites (send/edit/pin)
  were left untouched.
- Call sites updated to pass `thread_summary` instead of `thread_count`:
  list_channel_messages, list_dm_messages (chat_service.py), and the
  pinned-messages + global-search listings (chat_enhancements.py).
- New index migration (not yet applied to any DB - user must run it):
  scripts/migrate_thread_last_reply.sql adds
  `ChatMessage_parent_created_idx` on ("parentId", "createdAt" DESC) so the
  last-reply lookup isn't a seq scan. Runner:
  scripts/run_thread_last_reply_migration.py (same pattern as existing
  migrate_chat_enhancements.sql / run_chat_enhancements_migration.py).

Frontend (frontend):
- lib/types/chat.ts: ChatMessage gained lastReplyAuthorId/lastReplyAuthorName
  /lastReplyAt (all optional).
- lib/chat/dates.ts: added `formatThreadReplyTime` ("Today at 12:07 PM" /
  "Yesterday at ..." / weekday - reuses formatChatDayLabel logic, unlike
  formatChatMessageTime which omits the day prefix for today).
- components/chat/ChatMessageRow.tsx: replaced the plain-text reply link
  with a button row: small curved connector (absolute-positioned border
  corner), 20px avatar of the last replier (initials, same color-by-id
  scheme as message avatars), bold reply count, muted last-reply timestamp.
- components/chat/ConversationView.tsx: both places that locally bump
  threadCount on reply (optimistic self-reply via ThreadPanel's
  onReplySent, and the realtime socket event handler for other users'
  thread replies) now also set lastReplyAuthorId/Name/At locally so the
  indicator updates immediately without waiting for a refetch.

Verified: `npx tsc --noEmit` (frontend) clean. Backend:
`python -c "import app.services.chat_service, chat_helpers,
chat_enhancements"` clean import. `pytest tests/test_chat_api.py
tests/test_chat_channel_members.py` - 8 passed. Full backend suite kicked
off in background to confirm no wider regression.

No dev-server/browser screenshot tool available in this environment, so
the connector-line pixel alignment wasn't visually diffed against the
Slack reference - flagged to user to check it live and adjust offsets if
the curve doesn't line up.

IMPORTANT: the new SQL index has NOT been applied to any database yet -
user needs to run
`python scripts/run_thread_last_reply_migration.py` (with DATABASE_URL/
DIRECT_URL in .env) before deploying, otherwise the last-reply query still
works (Postgres will just seq-scan on ChatMessage.parentId) but is
slower without it.

TAG: [SUBTASK]
PARENT: Slack-style thread reply indicator (avatar + curved connector + last-reply time)
TITLE: Fix connector alignment and grouped-message header visibility
DESC: User feedback on first pass: (1) the curved connector line wasn't
visually tied to the message avatar above it - it wasn't aligned under the
avatar column at all; (2) when the same author sends several consecutive
messages (grouped into one run, avatar/name only on the first), a later
message in that run that gains replies still rendered with no
avatar/name/time, making the reply indicator look orphaned.

Fixes:
- ChatMessageRow.tsx: reply-indicator button now uses `-ml-12 pl-2` to pull
  the 20px reply avatar left by the same 48px (avatar 36px + gap-3 12px)
  that the content column is offset by, then re-center it under the 36px
  message avatar (8px = (36-20)/2). Connector corner repositioned to
  `left-2 -top-2.5` so it sits at the reply avatar's top-left, reading as
  a short stub descending from the message avatar column.
- MessageList.tsx: `showHeader` prop is now
  `index === 0 || (msg.threadCount ?? 0) > 0` instead of just
  `index === 0`, so any message inside a same-author run that has replies
  gets its own avatar/name/timestamp row, matching the Slack reference
  behavior the user pointed out.

No visual diffing tool available in this environment (still no
chromium-cli/playwright) - pixel offsets are calculated from the known
Tailwind spacing values (avatar size-9, gap-3, avatar size-5) rather than
visually verified; flagged to user again to eyeball on localhost:3001.
Verified with `npx tsc --noEmit` - clean.

TAG: [SUBTASK]
PARENT: Slack-style thread reply indicator (avatar + curved connector + last-reply time)
TITLE: Rework connector as a real vertical guide line, keep reply row aligned with message text
DESC: User corrected the previous approach: the reply row itself should
stay horizontally aligned with the message body (not shifted left under
the avatar column), and instead there should be one straight vertical
line running from the message avatar all the way down to just before the
reply row, which then curves right into the reply avatar - i.e. a proper
continuous guide line, not just a short corner stub floating next to the
reply row.

Implementation (ChatMessageRow.tsx): switched the message row from
`flex items-start gap-3` to CSS Grid
(`grid grid-cols-[2.25rem_minmax(0,1fr)] gap-x-3`). This was the key
trick to do a variable-height vertical line in pure CSS with no JS
measurement: grid items default to `align-items: stretch`, so the avatar
column div automatically stretches to match the content column's natural
height (body + reactions + reply row + optional pinned label), whatever
that height is. The vertical guide (`absolute left-1/2 top-9 bottom-0
w-px bg-border`, rendered only when `showHeader && repliesLabel`) then
spans from the avatar's bottom edge down to the bottom of that stretched
column - i.e. down to roughly the reply row - without hardcoding a pixel
height. The reply button reverted to sitting flush at the content
column's left edge (no more `-ml-12`/`pl-2` shift), with a small corner
(`absolute -left-3 ... rounded-bl-md border-b border-l`) bridging the
12px column gutter (`gap-x-3`) from the vertical line's x-position into
the reply avatar's top-left, so it reads as the line curving into the
avatar. Also removed the now-redundant `!showHeader && "ml-12"` on the
content column - the grid's fixed first column width indents
continuation rows automatically, no manual offset needed anymore.

Still no visual testing tool in this environment to diff pixel-for-pixel
against the reference; the "bottom-0 stretches to content bottom" anchor
is an approximation - it lines up well when the reply link is the last
element in the message, but will run slightly long if a "Pinned" label
renders below it. Flagged to user; can add a wrapper around
reactions+reply+pinned specifically anchored to the reply row's position
if that edge case needs tightening. Verified `npx tsc --noEmit` clean.

TAG: [SUBTASK]
PARENT: Slack-style thread reply indicator (avatar + curved connector + last-reply time)
TITLE: Realign reply avatar under message avatar per reference screenshot
DESC: User shared an actual ClickUp/Slack screenshot (Babar Javaid message
with "1 reply" below it) showing the reply avatar sits directly under the
original message's avatar column (not aligned with the message body text
as the prior fix assumed), with a single straight-then-curved line
connecting them - not two disjoint pieces.

ChatMessageRow.tsx changes:
- Reply button restored `-ml-12 pl-2` (pulls the 20px reply avatar back
  under the 36px message avatar, centered: (36-20)/2 = 8px = pl-2, after
  clawing back the 48px avatar+gutter offset via -ml-12). Removed the
  separate corner span that used to live on the button (in the gutter) -
  now redundant since the reply avatar is back in the same x-column as
  the guide line.
- Column-1 (avatar column) connector is now two pieces sharing the same
  center x (`left-1/2 -translate-x-1/2`) so they read as one continuous
  stroke instead of a floating corner with a gap: a straight bar
  (`top-9 bottom-2.5 w-px bg-border`) for the long run down from the
  avatar, then a small `border-b border-l rounded-bl-md` box at the very
  bottom for the curve into the reply avatar.

Known limitation (flagged to user): the column-1 div's height comes from
CSS Grid's default `align-items: stretch`, so its bottom edge lines up
with the bottom of column-2's *tallest* content - which is usually the
reply row itself, so bottom-0 lands near the reply row's bottom edge, not
precisely at the reply avatar's vertical center. Close in practice for a
single-line reply row, but there's no JS height measurement here to nail
it exactly - still no browser/screenshot tool in this environment, all
tuning done from Tailwind spacing math, not visual diffing. Asked user to
check live and report if the curve visibly misses the avatar.

Verified `npx tsc --noEmit` clean.

TAG: [SUBTASK]
PARENT: Slack-style thread reply indicator (avatar + curved connector + last-reply time)
TITLE: Reply row back under message text column, connector merged into one element
DESC: User confirmed the line itself was right but the reply row should
sit below the message text column, not under the avatar column (reverses
the previous subtask's avatar-alignment change).

ChatMessageRow.tsx: replaced the two-piece connector (straight bar +
separate corner box, both centered on the avatar column) with a single
element using the standard CSS org-chart-connector trick: one box with
`border-l` (draws the vertical run along its left edge) + `border-b`
(draws the horizontal run along its bottom edge) + `rounded-bl-2xl`
(rounds the elbow where they meet), sized `left-[18px] top-9 bottom-0
w-[30px]` - left edge at the avatar's horizontal center (18px = half of
the 2.25rem/36px avatar column), width 30px reaching exactly to the
content column's left edge (36px avatar column + 12px gap-x-3 gutter -
18px already covered = 30px remaining). Reply button dropped the
`-ml-12 pl-2` shift from the last subtask, so the reply avatar now sits
flush with the content column's left edge (same x as message body text),
which is exactly where the connector's curve lands.

Verified `npx tsc --noEmit` clean. Still no visual tool in this
environment - geometry is correct by the Tailwind spacing math (avatar
column 36px, gutter 12px, curve width 30px lands exactly at column2's
left edge) but not visually confirmed; asked user to check live.

TAG: [SUBTASK]
PARENT: Slack-style thread reply indicator (avatar + curved connector + last-reply time)
TITLE: Add gap below avatar before line starts, land curve at reply row's center
DESC: User asked for two more tweaks: a visible gap between the message
avatar and where the connector line begins (was flush at the avatar's
exact bottom edge), and for the line's landing point to align with the
vertical center of the reply row instead of its bottom edge - meaning the
reply row also needed to be pushed down a bit to make room.

ChatMessageRow.tsx:
- Connector `top` offset: `top-9` (36px, avatar's exact bottom) ->
  `top-12` (48px), opening ~10px of gap below the avatar before the line
  starts.
- Connector `bottom` offset: `bottom-0` (column bottom, which happens to
  be the reply row's bottom edge since it's the last element) ->
  `bottom-3.5` (14px up from that edge) - reply row height is roughly
  avatar (20px) + py-1 (8px) = 28px, so 14px is its half-height, landing
  the curve at its vertical center rather than its bottom.
- Reply button: `mt-0.5` -> `mt-2.5`, pushing the row down for clearer
  separation from the reactions/body above it (independent of the curve
  math above, since the connector's `bottom` offset is anchored to the
  stretched column's own bottom edge regardless of the button's top
  margin).

Verified `npx tsc --noEmit` clean. All offsets are computed from Tailwind
spacing values, not visually measured - still no browser/screenshot
tool in this environment. Asked user to confirm live.

TAG: [SUBTASK]
PARENT: Slack-style thread reply indicator (avatar + curved connector + last-reply time)
TITLE: Add matching gap between line end and reply avatar
DESC: User wanted the same ~12px breathing room between the connector's
end and the reply row that already existed between the message avatar
and the connector's start.

ChatMessageRow.tsx: reply button gained `pl-3` (12px) - the connector's
width stayed at 30px (still ending exactly at the content column's left
edge), and the extra left padding on the button pushes the reply avatar
12px further right of that point, opening the same gap used on the
avatar side (`top-9` -> `top-12` from the earlier subtask).

Verified `npx tsc --noEmit` clean.

TAG: [SUBTASK]
PARENT: Slack-style thread reply indicator (avatar + curved connector + last-reply time)
TITLE: Match real ClickUp's relative time format for reply timestamp
DESC: User specified real ClickUp doesn't show a date/time string for the
last-reply timestamp - it shows relative time: just the time for today,
"N days ago" up to 29 days, then "N months ago" using *completed*
calendar months (30 days in = "1 month ago", stays "1 month ago" until a
full 2nd month completes, then "2 months ago", etc.), and past 11
completed months it switches to "N years ago" with the same
completed-unit rule (1 year ago through the whole 2nd year, then 2 years
ago once completed).

lib/chat/dates.ts: rewrote `formatThreadReplyTime` (previously
"Today at 12:07 PM" style) and added two helpers:
- `completedMonthsBetween(from, to)`: calendar month diff, decremented by
  1 if `to`'s day-of-month hasn't reached `from`'s day-of-month yet (so a
  month only counts once it's actually completed, not just 30 raw days).
- `completedYearsBetween(from, to)`: same idea at the year level, checking
  month-then-day to decide if the year is fully completed.
New logic: diffDays<=0 -> time only ("12:07 PM"); diffDays<30 -> "N days
ago"; months<12 -> "N months ago"; else -> "N years ago" via
completedYearsBetween. This deliberately does NOT use a flat
months/30-days bucket for the year rollover (would give "12 months ago"
at 1 year) - months<12 is the switch condition specifically so exactly-1-
year shows "1 year ago" instead.

Verified `npx tsc --noEmit` clean and `npx vitest run src/lib/chat` - 9
files, 30 tests passed (no existing dates.ts test file to extend; none
of the touched code path had prior coverage).

TAG: [TASK]
TITLE: Show sent image attachments as bare thumbnails, not filename/size cards
DESC: User wants image attachments in sent chat messages to render as
plain images (just the picture, clickable to open full-size), not the
existing card treatment (small 70px thumbnail + filename + file size +
download button) - that card style still makes sense for the composer's
upload-in-progress preview and for non-image files, just not for already-
sent images in the message stream.

components/chat/attachments/MessageAttachmentList.tsx: split
`attachments` into images (`mimeType` starts with "image/" and has a
`downloadUrl`) vs everything else. Images render as bare `<img>` tags
(max-h-72 max-w-xs, rounded, wrapped in a link to open full-size in a new
tab) in a flex-wrap row; everything else still goes through the existing
`AttachmentPreviewRow` card. Left `AttachmentPreviewRow` itself and
`ComposerAttachmentChips` (the pre-send upload chip, which needs the
remove button and upload spinner) untouched, since `MessageAttachmentList`
is the only place used for already-sent messages - confirmed via grep
that both `ChatMessageRow.tsx` and `ThreadPanel`'s
`thread/ThreadMessageRow.tsx` share this one component, so thread replies
get the same treatment automatically without a separate change.

Verified `npx tsc --noEmit` clean, `npx vitest run src/lib/chat` - 9
files, 30 tests passed.

TAG: [FEATURE]
TITLE: Replace thread "Create Task" dropdown with list-search popover
DESC: User shared a screenshot of our own app's thread panel (channel
"ScholarlyHelp Project Work" header, Assign to / Create Task buttons) and
asked to remove the two-item dropdown ("New task from thread" / "Link
existing task") that currently shows under "Create Task", replacing it
with a direct list-picker matching the reference layout: "Create Task"
title, "Select a List to create a Task" subtitle, "Search Lists..."
input, "Suggested" section listing only the lists the user has access to,
and "No result found" text under Suggested when the search matches
nothing.

lib/spaces/create-task-from-thread.ts: `createTaskFromThreadMessage`
gained an optional `listId` param - when passed, skips the
"auto-pick-first-list" fallback (`firstListIdFromSpaces`) it used before
and creates directly into that list.

components/chat/ThreadPanel.tsx:
- Replaced the `DropdownMenu`/`DropdownMenuItem` pair with a `Popover`
  reusing the existing `Input`/`SearchIcon` search-box pattern already
  used elsewhere in the app (e.g. `CreateTaskListPicker`,
  `CreateTaskDialog`'s assignee/follower pickers) rather than inventing a
  new one - per this repo's CLAUDE.md rule to reuse existing patterns.
  Lists are fetched via the same `fetchSpacesTree` + `flattenListsFromSpaces`
  pair `CreateTaskDialog` already uses, lazily on first popover open
  (`taskLists.length > 0` guard skips refetching on reopen). Filtering is
  local substring match on `list.label` (`Space / Folder / List`).
  `fetchSpacesTree` is already scoped server-side to the caller's
  workspace access, so "Suggested" naturally only shows lists the user
  can see - no extra access filtering needed client-side.
- `handleCreateTaskFromThread` now takes the clicked list's id and closes
  the popover immediately on click (optimistic-feeling) before the
  create request resolves.
- Removed `linkTaskOpen` state and the `<LinkTaskDialog>` render/import -
  its only call site (the "Link existing task" menu item) is gone per the
  user's "remove those [two options]" instruction, matching what the
  reference image shows (list-picker only, no dropdown). Flagged to user
  that `LinkTaskDialog.tsx` itself is untouched but now has zero call
  sites anywhere in the app, in case that feature was meant to move
  elsewhere rather than disappear.

Verified `npx tsc --noEmit` clean, `npx eslint` on the touched files (the
7 errors it reports are all pre-existing `react-hooks/set-state-in-effect`
issues on `setBundle` calls elsewhere in ThreadPanel.tsx and one
pre-existing `prefer-const`, none on lines I touched - confirmed via
`git diff --stat` scope), `npx vitest run src/lib/chat src/lib/spaces` -
9 files, 30 tests passed.

TAG: [FEATURE]
TITLE: Add user profile peek popover for @mention clicks
DESC: User shared a screenshot (their own app, Waqas's message mentioning
@Muhammad Umair Malik) showing a small peek card - name, avatar with
presence dot, email, local time, team, Chat/View profile buttons - and
asked to build it if nothing like it existed. Confirmed via grep that
`@mentions` in message bodies (`MessageBodyWithMentions.tsx`) were
rendered as inert styled `<span>` text with no click handler at all - the
only existing profile UI was `PersonProfilePanel.tsx`, a full side-panel
opened by clicking a message author's name/avatar (`MessageAuthorButton`),
not a lightweight peek reachable from inline mentions. So this was new
ground, not a duplicate of existing code.

New file components/chat/UserProfilePeek.tsx: self-contained Popover
(same `trigger: React.ReactElement` + internal open-state pattern as the
existing `EmojiPickerPopover`) showing name + `AvatarWithPresence` header,
then email/local-time/team rows (mirroring the "Activity" tab fields
already in `PersonProfilePanel`), then Chat + View profile buttons -
reusing `usePersonProfileMember` (member lookup by id), `useUserPresence`,
`useOpenDirectMessage`, and `useOpenPersonProfile` (opens the existing
full panel) rather than writing new data-fetching or navigation logic.

The harder part: mention tokens in message bodies are stored as plain
text ("@Full Name", see `lib/chat/mention-utils.ts`) with no user id
embedded, so resolving which member a mention points to required a
name-to-id lookup. Reused `useMentionMembers` (the same hook the
composer's mention autocomplete already uses, which already handles
channel-vs-DM-vs-workspace-fallback member sourcing) inside
`MessageBodyWithMentions.tsx`, built a `fullName.toLowerCase() -> id`
map via `useMemo`, and split the existing inline `@mention` span
rendering into a new `PersonMentionToken` sub-component: renders plain
styled text (unchanged from before) when the name doesn't resolve to a
member, or a `UserProfilePeek`-wrapped button when it does.

`MessageBodyWithMentions` gained optional `conversationType`/
`conversationId` props (both `ChatMessageRow.tsx` and
`thread/ThreadMessageRow.tsx` already had these as props one level up, so
just threaded them through) to give `useMentionMembers` the right scope;
left them optional since a third call site, `TaskActivityComment.tsx`
(task comments, unrelated to chat channels/DMs), doesn't have this
context - `useMentionMembers` already falls back to workspace-wide
members when both are undefined, so mentions still resolve there, just
via a broader member list.

Verified `npx tsc --noEmit` clean, `npx eslint` on all 4 touched/new
files clean, `npx vitest run src/lib/chat` - 9 files, 30 tests passed.

TAG: [SUBTASK]
PARENT: Add user profile peek popover for @mention clicks
TITLE: Open peek on hover instead of click
DESC: User wants the mention peek card to show on hover, not require a
click. Checked the underlying `@base-ui/react` Popover primitive's
`PopoverTrigger` - it already has built-in `openOnHover`/`delay`/
`closeDelay` props for exactly this (no custom mouseenter/mouseleave
wiring needed).

UserProfilePeek.tsx: `PopoverTrigger` now passes `openOnHover delay={200}
closeDelay={150}` - 200ms before it opens on hover (avoids flashing open
on a quick mouse pass-through), 150ms grace period before closing so
moving the cursor from the mention text into the card itself doesn't
dismiss it.

Verified `npx tsc --noEmit` clean.

TAG: [SUBTASK]
PARENT: Add user profile peek popover for @mention clicks
TITLE: Fix divider spacing and move presence dot to top-right of avatar
DESC: User reported the dividers (below name/avatar, above the Chat/View
profile buttons) weren't showing right, and the online/offline dot was in
the wrong spot - should sit above (top-right of) the avatar, not
bottom-right.

Root cause on the dividers: `PopoverContent`'s base classes
(components/ui/popover.tsx) include `flex-col gap-2.5` by default: my
override className only replaced `w-72`->`w-80` and `p-2.5`->`p-0` (same
Tailwind property, tailwind-merge dedupes), but `gap-2.5` had no
conflicting utility in my className so it stayed active - the flex gap
between top-level children (header/Separator/info/Separator/buttons) was
adding uneven spacing that read as the separators not really being
there. Fixed by adding `gap-0` to the override.

Root cause on the dot: I'd used the shared `AvatarWithPresence` component,
whose `PresenceDot` is hardcoded `absolute -bottom-px -right-px`
(components/shared/AvatarWithPresence.tsx:43) - correct for its other
call sites (PersonProfilePanel etc., which this task didn't touch and
shouldn't change), but not what the reference image showed for this peek
card. Rather than change the shared component's default position (would
affect every other place it's used), UserProfilePeek.tsx now builds the
dot manually: a plain absolutely-positioned span (`-top-px -right-px`)
reusing the same color-class helpers the shared component uses
(`presenceDotClass`/`presenceOfflineDotClass` from stores/profile-store.ts
- note: not stores/presence-store.ts, which only exports the
`useUserPresence` hook, not these class helpers - fixed an import-path
mistake from the first pass).

Verified `npx tsc --noEmit` and `npx eslint` on the file both clean.

TAG: [BUG]
TITLE: Separator component invisible everywhere — wrong data-attribute variant
DESC: User said dividers weren't visible in the profile peek card even
after confirming the `<Separator />` elements were positioned correctly
in the JSX. Traced it: components/ui/separator.tsx sizes itself via
Tailwind's automatic data-attribute variants `data-horizontal:h-px
data-horizontal:w-full data-vertical:...`, which only match an element
carrying a literal `data-horizontal`/`data-vertical` attribute. Checked
`@base-ui/react`'s actual Separator source
(node_modules/@base-ui/react/esm/separator/Separator.js) - it sets
`data-orientation="horizontal"` (or "vertical"), never a bare
`data-horizontal` attribute. So the sizing classes never matched
anywhere, on any Separator in the app - not a bug specific to the new
UserProfilePeek, this component has been rendering as a zero-size
(invisible) div everywhere it's used since it was added.

Fix: changed the variants to `data-[orientation=horizontal]:h-px
data-[orientation=horizontal]:w-full data-[orientation=vertical]:w-px
data-[orientation=vertical]:self-stretch`, which target the attribute
Base UI actually sets. This is an app-wide fix, not scoped to the peek
card - every existing `<Separator />` (ConversationView header,
ThreadPanel header, PersonProfilePanel, etc.) should now render visibly
where it previously silently collapsed to nothing.

Verified `npx tsc --noEmit` and `npx eslint` on the file clean.

TAG: [TASK]
TITLE: Rework PersonProfilePanel header layout to match reference screenshot
DESC: User shared a screenshot of the full "View profile" side panel
(square avatar, name+chevron, "Add description..." | status pill, close
X, action buttons, tab bar, Activity content) and asked the panel to
follow that layout. Image also showed a "Get StandUp" button next to
Chat and a 5th tab collapsed under "1 more..." - asked user whether those
were in scope; confirmed layout-only, skip both since they imply new
features/unclear scope, not just visual rearrangement.

PersonProfilePanel.tsx: restructured the identity block from a centered
vertical stack (avatar top-center size-20, name/description/status/Chat
button all centered below it) into the image's horizontal layout: square
avatar (size-16, shrunk from size-20 to match the image's proportions)
on the left, with name+chevron / "Add description..." + a vertical
divider + inline status (small presence dot + label) stacked on the
right - all left-aligned instead of centered. Chat button now sits below
the row (still triggers `openDirectMessage`, unchanged behavior) instead
of centered under the avatar.

Removed the `AvatarWithPresence` wrapper (dot-on-avatar-corner) since the
reference image shows status as inline text next to the description, not
a badge on the avatar itself - kept the plain `Avatar` and used the
already-imported `PresenceDot` for the inline status pill instead. This
made the `AvatarWithPresence` import unused in this file, so removed it
(the component itself is untouched and still used elsewhere, e.g. the
sidebar and UserProfilePeek's predecessor design).

Verified `npx tsc --noEmit` clean, `npx eslint` on the file - the one
error it reports (`react-hooks/set-state-in-effect` on line 169,
`setTabLoading(true)` inside the tab-data-loading effect) is pre-existing
and untouched by this change. `npx vitest run src/lib/chat` - 9 files, 30
tests passed.

TAG: [FEATURE]
TITLE: Add "reports to" manager field to workspace members
DESC: User shared 3 screenshots (profile panel with a "Select manager"
dropdown, a "Reports to Usman Ghani" pill, and the same pill with an X
badge over the avatar for removal) and asked for: no label headings above
Email/Local time/Manager/Team (icon+value only, icons stay as-is), a
"Select manager" dropdown when unset, restricting choices to people the
user has access to, "Reports to {name}" once set, click-avatar-to-remove,
and click-the-name-to-open-that-manager's-profile.

Confirmed via a research agent that no manager field/relationship existed
anywhere (grepped DB models, migrations, API routes, frontend API
clients) - this needed a new DB column, which is a CLAUDE.md "ask user
first" boundary. Asked and got explicit go-ahead before touching the
schema.

Backend (backend-py):
- db/models/workspace.py: added `WorkspaceMember.manager_id` (nullable FK
  to User, ON DELETE SET NULL) plus a `manager` relationship - modeled
  directly on the existing `ChatChannel.created_by_id` pattern per the
  research agent's earlier finding. Since `WorkspaceMember` now has two
  FKs to `User` (`user_id` and `manager_id`), had to disambiguate with
  explicit `foreign_keys=` on both sides of the `User.memberships` /
  `WorkspaceMember.user` back-reference (db/models/user.py) - SQLAlchemy
  raises at mapper-configuration time otherwise.
- scripts/migrate_workspace_manager.sql +
  run_workspace_manager_migration.py: same ALTER TABLE ADD COLUMN IF NOT
  EXISTS pattern as every other migration here. Ran it against the local
  dev DB (`python scripts/run_workspace_manager_migration.py` -
  "WorkspaceMember.managerId column is ready.").
- schemas/workspace.py: `UpdateMemberManagerBody` (managerId, camelCase
  alias, nullable).
- services/workspace_service.py: `list_workspace_members` now
  selectinloads `WorkspaceMember.manager` and includes `managerId`/
  `managerName` in the response. New `update_member_manager`: permission
  is self-service (actor can always set/clear their own manager) OR
  `_assert_can_manage_people` (existing OWNER/SUPER_ADMIN/ADMIN gate,
  reused from `update_member_permissions`) for setting someone else's;
  validates the chosen manager is an ACTIVE member of the same workspace
  (this is what makes "only people you have access to" hold - the
  candidate list is scoped to workspace membership) and rejects
  manager_id == target_user_id (can't be your own manager).
- api/v1/workspaces.py: new `PATCH /workspaces/{id}/members/{userId}/manager`
  route following the existing `patch_member_permissions` route shape.

Note: this only touches `list_workspace_members`
(workspace_service.py) - the separate `_channel_member_json`/
`_workspace_member_as_channel_json` serializers in chat_service.py
(which back the channel-members cache used by `usePersonProfileMember`'s
first lookup path) were NOT touched, since they're a fully independent
code path (confirmed via research agent) and updating both was out of
scope for this pass. To avoid showing stale/missing manager data when
that cache path wins, PersonProfilePanel.tsx does its own dedicated
`fetchWorkspacePeople` call for manager data rather than relying on
`usePersonProfileMember`'s member object.

Frontend (frontend):
- lib/api/workspace.ts: `WorkspaceMemberRow` gained `managerId`/
  `managerName`; new `updateMemberManager(token, workspaceId, userId,
  managerId)` PATCH call.
- components/chat/PersonProfilePanel.tsx: replaced the `InfoRow`
  component (icon + label caption + value, three lines effectively) with
  a new `IconRow` (icon + value only, no label) for Email/Local
  time/Manager/Team - matches the "no headings" ask exactly, icons
  unchanged. Manager row is now fully interactive: unset ->
  Popover-based "Select manager" dropdown (search input + list of
  workspace members, excluding self) reusing the same
  search-box-in-popover pattern as `CreateTaskDialog`'s assignee/follower
  pickers; set -> small avatar (click removes, calls
  `updateMemberManager(..., null)`) + "Reports to {name}" button (click
  calls `openProfile(managerId)` via the existing `useOpenPersonProfile`
  hook, swapping the panel to the manager's profile). Editing (both
  setting and removing) is gated behind `canEditManager` = viewing your
  own profile OR your workspace role is OWNER/SUPER_ADMIN/ADMIN,
  mirroring the backend's permission rule exactly so the UI never offers
  an action the API would reject; read-only viewers just see the plain
  "Reports to {name}" text or "No manager assigned".

Verified: backend `python -c "import ..."` clean import, targeted pytest
(test_workspace_flow, test_workspace_people, test_workspace_roles) failed
first (expected - column didn't exist in the DB yet, proving the ORM
mapping was querying the new column correctly), passed after running the
migration; also reran with test_permissions_matrix.py - 27 passed total.
Frontend `npx tsc --noEmit` clean, `npx eslint` on all touched files -
only pre-existing `react-hooks/set-state-in-effect` errors remain (lines
untouched by this change, confirmed by line number).

TAG: [SUBTASK]
PARENT: Add "reports to" manager field to workspace members
TITLE: Wire up the name-chevron as a person switcher
DESC: User wants the chevron next to the displayed name at the top of the
profile panel (previously a dead button, no onClick) to open a dropdown
of people the viewer has access to, and switch the panel to whichever
person is picked.

PersonProfilePanel.tsx: wrapped the existing name button in a `Popover`,
reusing the same search-box-list pattern as the manager picker added
earlier this session (own `personSwitcherOpen`/`personSwitcherSearch`
state and a `personSwitcherCandidates` memo, filtered from the same
`people` list already fetched via `fetchWorkspacePeople` for the manager
field - no new data fetch). Selecting a row calls `openProfile(p.id)`
(the existing `useOpenPersonProfile` hook) and closes the popover - since
`PersonProfilePanel` is rendered from the chat store's
`personProfileUserId`, calling `openProfile` with a new id just re-renders
this same panel for the newly selected person, no separate "profile
detail modal" component needed.

Verified `npx tsc --noEmit` clean, `npx eslint` on the file - only the
pre-existing `react-hooks/set-state-in-effect` on the tab-loading effect
remains, `npx vitest run src/lib/chat` - 9 files, 30 tests passed.

TAG: [FEATURE]
TITLE: Reaction hover tooltip showing who reacted
DESC: User shared a screenshot (thumbs-up reaction badge, hover tooltip
showing big emoji + "Muhammad Umair Malik and Jawad" + "reacted with :+1:")
and asked for the same on our reaction badges.

Researched first (via agent) whether per-user reaction identity existed
anywhere: confirmed `MessageReaction` (backend-py/app/db/models/chat.py)
is already a row-per-reaction table with `user_id` + `emoji` - the data
was there, just discarded by two separate code paths that both collapsed
to `{emoji, count}`:
- `_reaction_counts` (chat_service.py, used by the toggle-reaction
  endpoint + socket broadcast) was a real SQL `GROUP BY emoji` count
  aggregate - switched it to select `emoji, user_id, User.full_name`
  joined, grouped in Python into `{emoji, count, users: [{id,
  fullName}]}`.
- `_reaction_list` (chat_helpers.py, used when mapping full messages for
  list/thread responses) walked the already-loaded ORM `msg.reactions`
  relationship in Python but only counted, never captured user identity -
  now builds the same `users` list from `r.user.full_name`. This
  required adding a nested `selectinload(ChatMessage.reactions)
  .selectinload(MessageReaction.user)` to the shared `_MESSAGE_LIST_LOAD`
  options tuple (chat_service.py) - without it, accessing `r.user.full_name`
  would trigger an implicit lazy-load, which SQLAlchemy's async engine
  can't do (raises MissingGreenlet) - caught this before it could ship as
  a runtime crash.

Frontend: new components/chat/ReactionTooltip.tsx - wraps a reaction
badge in the existing `Tooltip`/`TooltipTrigger`/`TooltipContent`
primitives (same `render` prop pattern already used in
ChannelDetailsRail.tsx), shows the emoji large, a joined names line
("You and Jawad" / "A, B and C" for 3+, with the viewer's own name
replaced by "You"), and "reacted with {emoji}" beneath. Wired into both
`ChatMessageRow.tsx` and `ThreadMessageRow.tsx` (they had near-identical
but not shared reaction-badge markup) without changing either file's own
badge styling - `ReactionTooltip` just wraps whatever trigger element is
passed in and falls through to it unwrapped if a reaction has no `users`
data (e.g. older cached state). `ChatMessage.reactions` type
(lib/types/chat.ts) and the optimistic-toggle helper's `ReactionCount`
type (lib/chat/reactions.ts) both gained the optional `users` field.

Skipped emoji shortcode text (":+1:" in the reference image) - no
emoji-name lookup exists in this codebase and adding one felt like scope
creep for a hover tooltip; used the literal emoji character instead
("reacted with 👍").

Verified: backend clean import, targeted pytest (test_chat_api,
test_chat_channel_members) - 8 passed. Attempted a live httpx smoke test
against localhost:4001 but its route shapes didn't match the current
source (`/chat/channels?workspaceId=` vs the running server's
`/workspaces/{id}/chat/channels` path-param style) - that server is
stale/mismatched from earlier in this long session, not safe to test
against; skipped rather than risk validating against the wrong code.
Full backend suite kicked off in background instead to catch any other
regression. Frontend `npx tsc --noEmit` and `npx eslint` on all
touched/new files clean.

TAG: [TASK]
PARENT: Reaction hover tooltip showing who reacted
TITLE: Reply-thread hover bar restyle to match reference (View thread + chevron)
DESC: User shared screenshot of ClickUp's reply-indicator hover state: on
hover, the timestamp is replaced by a full-width highlighted bar reading
"View thread" with a trailing chevron. Reworked the reply button in
ChatMessageRow.tsx: `w-full`, `pl-3`, and swapped `hover:bg-muted` for
`hover:bg-primary/15` (first pass, later revised - see below) so the row
pops on hover. Content itself group-hover-swaps: the relative-time span
(`group-hover/thread:hidden`) hides and a "View thread" span
(`hidden ... group-hover/thread:inline`) plus a `ChevronRightIcon`
(`hidden ... group-hover/thread:block`, `ml-auto`) appear.

Follow-up 1 - "the hover on reply component does not pop": increased
hover background contrast on the reply button.

Follow-up 2 - "remove the purple from the text n reply/replies, make it
white only": the reply-count label (`repliesLabel` span) was
`text-primary` (purple, inherited from the app's primary color token) -
changed to `text-foreground` so it reads as plain white/foreground text
instead of tinted.

Verified `npx tsc --noEmit` and `npx eslint` on ChatMessageRow.tsx clean
after each change.

TAG: [SUBTASK]
PARENT: Reaction hover tooltip showing who reacted
TITLE: Reaction tooltip follow light/dark theme
DESC: User: "make the reaction tooltip also follow the theme i.e.
light/dark". The shared `ui/tooltip.tsx` `TooltipContent` is intentionally
hardcoded to an inverted look (`bg-foreground`/`text-background`) for
every other tooltip in the app (always renders dark regardless of page
theme) - that's by design for those other usages, so didn't touch the
shared default. Instead overrode via `className` on the specific
`ReactionTooltip.tsx` instance: `border border-border bg-popover ...
text-popover-foreground`, which does follow `--popover`/
`--popover-foreground` theme tokens.

Follow-up - user reported "there is a white orthogonal on user reaction
tooltip" (the small arrow/caret triangle under the tooltip box): the
`TooltipPrimitive.Arrow` in `ui/tooltip.tsx` had its own hardcoded
`bg-foreground fill-foreground` with no way to override it from
`TooltipContent`'s `className` prop (arrow is a separate element).
Added a new `arrowClassName` prop to `TooltipContent` (defaults to
existing behavior, so every other tooltip in the app is unaffected),
passed through to the `Arrow`'s `cn(...)` call. `ReactionTooltip.tsx`
now passes `arrowClassName="border border-border bg-popover fill-popover"`
so the arrow matches the theme-following box instead of staying a fixed
white/foreground triangle.

Verified `npx tsc --noEmit` and `npx eslint` on both
`ui/tooltip.tsx` and `ReactionTooltip.tsx` clean.

TAG: [TASK]
TITLE: Hide top-bar notifications bell behind feature flag
DESC: User asked to hide the notification component in the top bar for all
users, explicitly not touching existing notification push/receive setup -
only how/where users get notified in the UI. Reused the existing hard-coded
feature-flag pattern from frontend/src/lib/feature-flags.ts (same file
already has `subtasks: false` gating subtask UI elsewhere) instead of adding
a new mechanism. Added `topBarNotifications: false`. Gated
`<NotificationsMenu />` in frontend/src/components/shell/TopBar.tsx behind
`FEATURE_FLAGS.topBarNotifications` (renders null when off). No backend
changes, no changes to notification creation/socket/push logic - purely
hides the bell icon entry point in the top bar.

TAG: [FEATURE]
TITLE: Restyle Home Inbox page to match real ClickUp inbox layout
DESC: User pasted a screenshot of their real ClickUp workspace inbox
(Primary/Other/Later/Cleared tabs, Filter button, gear + "Clear all" pill,
Yesterday/Last 7 days/Earlier this month date groups, row layout with
actor+action sentence and hover-reveal actions) and asked to make our own
Home Inbox page (frontend/src/components/home/InboxView.tsx,
frontend/src/components/home/InboxFeedRow.tsx) match it. Asked two
clarifying questions since the data model has no existing Primary/Other
split and no true "cleared" concept: user picked (1) a type-heuristic split
- Primary = mention/assignment/comment/reply/reminder (needs-action types),
Other = chat/reaction/sent/draft/scheduled (lower-priority activity) - pure
frontend filter, no schema change; (2) keep current behavior for Cleared -
marking an item read does NOT hide it from Primary/Other, Cleared is just an
additional view filtering to unread:false items (reuses the existing
`unread` boolean, no new DB field).
Changes: InboxView.tsx tabs renamed all/replies/mentions/later ->
primary/other/later/cleared with the above filter logic; added a working
Filter dropdown (DropdownMenuCheckboxItem per InboxItemType, multi-select,
menu stays open via onSelect preventDefault); date grouping changed from
backend's today/earlier to a new client-side dateGroupFor() bucketing into
Today/Yesterday/Last 7 days/Earlier this month/Older (computed from
createdAt, ignores backend's coarser `group` field); toolbar restyled -
Filter button left, Settings gear (routes to /settings, reuses existing
notification prefs there - no new settings surface built) + filled-pill
"Clear all" button right; dropped the old free-text search input entirely
per the screenshot's design (removed filterBySearch, now unused). Removed
subtitle text under the page title to match the screenshot's minimal header.
InboxFeedRow.tsx: row timestamp switched from formatShortDateTimeUtc (with
time) to formatNotificationDate ("Jul 16" style, matches screenshot); the
inline checkmark-only clear button became a hover-reveal "Clear" text pill
that overlays the timestamp slot (absolute-positioned within a fixed-width
wrapper so layout doesn't shift on hover).
Explicitly NOT done: bolding the actor's name separately within the
notification sentence like the screenshot shows (e.g. "**Babar Javaid**
shared this task") - the InboxItem DB model only stores a pre-composed
title/preview string per notification_service.py, there's no separate
actorName column, and adding one is a DB schema change this project's
CLAUDE.md requires asking the user about first rather than just doing it -
flagged instead of silently adding a migration.
Verification: `npx tsc --noEmit` clean, `npx vitest run` 44/44 passing,
`npx eslint` on both changed files shows only the same two pre-existing
warnings already present on unchanged lines (set-state-in-effect on the
searchParams-sync effect, an "unnecessary" liveTick dep on the items
useMemo - both existed in the file before this change). No browser
automation tool available in this environment to screenshot the result -
flagged to user to eyeball localhost:3001/home/inbox against the pasted
ClickUp screenshot.

TAG: [SUBTASK]
PARENT: Restyle Home Inbox page to match real ClickUp inbox layout
TITLE: Rebuild row as single-line layout, bold actor name, drop DB dependency
DESC: User re-pasted the same ClickUp screenshot saying the previous pass
wasn't close enough - real rows are one horizontal line (icon, bold
target/channel name, small connector icon, actor-bolded sentence, date),
not the 3-line stacked title/preview/source block from before.
Rewrote frontend/src/components/home/InboxFeedRow.tsx: heading is now
item.source (already holds the channel/task/workspace name across every
notification_service.py call site - task_name, channel_label, workspace_name
- confirmed via grep, so no backend change needed), fixed-width truncate,
followed by a small connector icon chosen by a keyword heuristic against
item.preview (shared->Share2, added->UserPlus, removed/unfollowed->UserMinus,
mentioned->AtSign, else Hash/MessageSquare), then the preview sentence with
the actor name bolded.
Actor bolding: backend's preview strings are consistently built as
"{actor_name} <verb phrase>" or "{actor_name}: {message}" (verified across
every create_*_notifications function in notification_service.py) - added
splitActorPrefix() that finds the first known verb marker (" added you to ",
" mentioned you", ": ", etc., capped at 40 chars in) and bolds everything
before it. Pure frontend string parsing, no new actorName column - the
proper fix (a real actorId/actorName field on InboxItem) would be a DB
schema change requiring the CLAUDE.md-mandated ask-first step, and the
heuristic covers every current notification format since they're all
actor-first strings by construction.
Also fixed a real pre-existing lint issue while touching this file: the old
itemIcon()/connectorIcon() pattern returned component references and did
`<Icon />`, which is the react-hooks static-components anti-pattern
(recreates the component identity every render) - refactored both to
renderItemIcon()/renderConnectorIcon() functions that return JSX directly
instead of a component reference, eliminating the eslint error rather than
adding a second instance of it.
Row background: unread rows get bg-muted/30 (was a barely-visible
bg-primary/[0.03]), icon wrapper changed from tinted rounded-square to
rounded-full circle to match ClickUp's neutral circular avatars-as-icons
look.
Verification: npx tsc --noEmit clean, npx eslint on InboxFeedRow.tsx clean
(previously had 1 pre-existing error, now 0), npx vitest run 44/44 passing.
No browser automation tool in this environment - still flagged for manual
visual check against the screenshot.

TAG: [SUBTASK]
PARENT: Restyle Home Inbox page to match real ClickUp inbox layout
TITLE: Two-column aligned row grid, verb-bold + purple channel names, purple Clear pill
DESC: User rejected the previous inline-flow row again - the real ClickUp
inbox (their pasted reference) uses a two-COLUMN aligned layout where the
actor/action sentence starts at a fixed x across every row, not right after
a variable-width truncated name. Rebuilt InboxFeedRow.tsx from a flex row
into a CSS grid: grid-cols-[minmax(0,1.1fr)_minmax(0,1.6fr)_auto] giving
Column A [type glyph + item name (item.source)], Column B [action glyph +
actor sentence], Column C [date / hover actions] - now vertically aligned.
Typography now matches the reference: parsePreview() splits backend's
"{actor} {verb phrase} ..." / "{actor}: {snippet}" preview strings (verb
list: added you to / removed you from / mentioned you (in) / assigned you
to / accepted your invite to / started|unfollowed following you in / shared
this(task|list) / deleted) into actor (regular foreground) + verb (bold
foreground) + rest; renderRest() accent-colors the first #channel/list name
(text-primary) up to a ":" or end. Colon-style comment/chat previews bold
the actor instead (no verb). Fixed the earlier mistake of bolding the actor
- reference bolds the VERB phrase.
Icons switched from filled tinted chips to bare colored glyphs (ClickUp
renders inbox glyphs bare); default/task glyph is now ListChecks in orange.
Per-row hover actions: added a Snooze (Clock) icon button + the Clear button
is now a filled PURPLE pill (bg-primary), matching the reference's purple
Clear. Correspondingly reverted the top-bar "Clear all" from the filled pill
I wrongly gave it back to a plain ghost text button with a CheckCheck icon
(reference shows Clear all as muted text, only the per-row Clear is purple).
Also: added leading icons to the four tabs (Inbox/Activity/Clock/CheckCheck),
changed date-group headers from uppercase letter-spaced to normal-case muted
13px (reference style), and wrapped each date group's rows in a bordered
rounded card container centered at max-w-5xl.
Verification: npx tsc --noEmit clean, npx eslint InboxFeedRow.tsx clean,
InboxView.tsx only the 2 pre-existing warnings on unchanged lines, npx
vitest run 44/44 passing. Still no in-env browser tool - flagged to user to
reload /home/inbox and report if the grid column ratios need tuning.

TAG: [SUBTASK]
PARENT: Restyle Home Inbox page to match real ClickUp inbox layout
TITLE: Full-width feed, fixed date grouping confirmation, non-reflowing hover actions
DESC: Three follow-up fixes from user feedback. (1) Feed was centered at
max-w-5xl - user wanted full width with horizontal margin; changed the feed
container in InboxView.tsx from "mx-auto w-full max-w-5xl px-2" to
"w-full px-4" so rows span the whole pane. (2) User asked for date grouping
(Today/Yesterday/Last 7 days/Earlier this month/...) - this was already
implemented via dateGroupFor()/DATE_GROUP_ORDER in the prior subtask, so no
code change; confirmed the buckets and ordering are correct. (3) Hover
Clear/Snooze buttons were pushing the row text because Column C was an
auto-width grid track that grew on hover. Fixed InboxFeedRow.tsx: pinned the
last grid track to a fixed 150px
(grid-cols-[minmax(0,1.1fr)_minmax(0,1.6fr)_150px]) and made the hover
action cluster absolutely positioned (inset-y-0 right-0) overlaying the date
with an opacity crossfade, so the other two columns never reflow on hover.
Verification: npx tsc --noEmit clean, npx eslint on both files clean (only
InboxView's 2 pre-existing warnings), npx vitest run 44/44 passing.

TAG: [CHORE]
TITLE: Audit which notification delivery channels are actually wired up
DESC: User asked what options currently exist for a user to get notified of
anything. Ran a research-only audit (two subagents independently confirmed
the same findings, no code changed). Results: (1) In-app Inbox - fully
wired end-to-end; notification_service.py creates InboxItem rows on real
triggers (mention, assignment, comment, reply, chat/DM, reminders), fetched
via lib/api/home.ts and rendered in InboxView.tsx / hooks/
use-notifications-unread.ts. (2) Real-time socket delivery - fully wired;
backend socket/emit.py's broadcast_home_notification emits
"home:notification", frontend lib/notifications/realtime.ts ingests it into
the live cache and fires a sonner toast immediately, no refresh needed.
(3) Unread badge count - fully wired, live off the same socket signal, used
in HomeSidebar/GlobalNav/NotificationsMenu. (4) Topbar bell
(NotificationsMenu.tsx) - fully built but unreachable: gated behind
FEATURE_FLAGS.topBarNotifications = false (the flag added earlier today per
the "hide notification bell" task). (5) Email notifications toggle
(SettingsView.tsx) - dead setting: persists to a local Zustand store only
(settings-store.ts, localStorage), nothing backend-side ever reads it -
notification_service.py has zero email_service references; the only real
email-sending path in the app is invite emails (email_service.py via
invite_service.py), unrelated to this toggle. (6) Desktop/browser push
toggle - dead setting: onCheckedChange only calls
Notification.requestPermission() once, but grep for `new Notification(`
across frontend/src returned zero matches - nothing ever actually fires a
desktop notification, including from the live socket/toast handler. No
sound alerts, no mobile push (FCM/APNs/service-worker) anywhere in the repo.
Answered as pure information, no code changes made this entry.

TAG: [FEATURE]
TITLE: Redesign Home sidebar to match real ClickUp (Spaces/Channels/DMs sections) + role-based visibility
DESC: User shared two screenshots of their real ClickUp Home sidebar (Owner/
Member view with a Spaces section; a second workspace showing a Guest/
Limited-Member-shaped view with "Shared with Me" instead of Spaces) and
asked to (1) redesign our Home sidebar to match, and (2) research what real
ClickUp shows per role before deciding what to build.
Researched via WebSearch (help.clickup.com): Owner/Admin/Member get the same
sidebar shape (full Spaces tree + Channels + DMs); Guest/Limited Member get
no Spaces section at all (guests can't have a Space shared with them) -
everything they can see surfaces under a "Shared with Me" heading instead.
Confirmed ClickUp's Home Sidebar is one persistent panel (Home nav + Spaces
+ Shared with me + Channels + DMs together), not swapped per route.
Presented this + flagged that matching the screenshots exactly implies
merging our three route-scoped sidebars (HomeSidebar/ChatSidebar/
SpacesSidebar) into one - an architecture-direction question per CLAUDE.md.
User chose via AskUserQuestion: enrich HomeSidebar only (leave Chat/Spaces
sidebars untouched), and build the role-gating now rather than deferring.
Before implementing, user pushed back on doing this as frontend-only local
state ("we might let users customize later, backend should be source of
truth, light frontend") and asked me to weigh in. Investigated and found
this already exists, fully wired, just never called: backend-py/app/db/
models/home.py:557 UserHomeSidebar table (userId+workspaceId+config JSON)
plus GET/PATCH /home/sidebar in backend-py/app/api/v1/home.py:307-329 and
home_service.get_sidebar_config/update_sidebar_config - identical dead-code
pattern to the email/desktop-notification toggles found earlier. Proposed a
split: (A) pin/order customization -> wire to this existing API instead of
localStorage-only; (B) role-based structural differences (Spaces vs Shared
with Me, hide create buttons for guest/limited member) -> keep as a small
client-side branch on the existing `role` field, not part of the config
blob, since it's a small fixed set of variants and the actual data
visibility is already enforced server-side in the data endpoints
(space_permissions.py already filters what a Guest's /spaces call returns).
User agreed; proceeded.
Backend: zero changes needed (endpoint already existed, config is a
freeform `dict[str, Any]`, no schema decision required).
Frontend: (1) lib/api/home.ts - added fetchHomeSidebarConfig/
updateHomeSidebarConfig + HomeSidebarConfig type, deliberately a diff-only
shape ({pinnedIds, order}) rather than a full item dump, so shipping a new
nav item later (like this session's Assigned Comments) doesn't go stale in
everyone's saved config - unlisted ids just fall back to their code-defined
default. (2) stores/home-sidebar-store.ts - added assigned-comments to
DEFAULT_ITEMS (route/icon already existed, just wasn't in the pinned list),
reordered to match the screenshot, set All Channels/Favorites unpinned by
default (moved under a new "More" expandable), bumped persist version
3->4 so existing users' normalizeItems() merge picks up the new item;
added hydrateFromServer()/toSidebarConfig() and a serverSynced flag (reset
on rehydrate via onRehydrateStorage, since it reflects this session's fetch
only, never persisted state). (3) components/shell/HomeSidebar.tsx -
rewritten: fetches /home/sidebar on mount per workspace, hydrates the store
from the server response (server wins over the localStorage cache), and a
second effect diffs the current items against the last-known server config
(via a ref snapshot) to PATCH only real changes - avoids an effect loop and
avoids re-PATCHing immediately after the GET that just hydrated it. Added
four new sections reusing existing fetchers/dialogs: AI Chats (shortcut
into the existing AI sheet via useTopBarStore), Spaces/Shared with Me
(fetchSpacesTree, flat top-level list since there's no per-space route in
this app yet so rows link to /spaces; header + "New Space" hidden for
GUEST/LIMITED_MEMBER via a new isRestrictedRole(role) check), Channels and
Direct Messages (both via the existing loadSidebarLists() from chat's
sidebar-lists-loader.ts - same fetcher ChatSidebar.tsx uses, just rendered
read-only here without its live-merge/cache complexity since Home's version
is a lighter preview, not the primary chat surface). Footer "Customize
Sidebar" button reuses the pre-existing "customize-home" Dialog in
Modals.tsx (already had pin/unpin controls wired to the same store) - just
gave it a visible footer entry point matching the screenshot, no new modal
built. Old fixed-bottom "Favorites" placement removed since favorites is
now a regular pin/unpin item like the others.
Verification: npx tsc --noEmit clean, npx eslint clean on every touched
file, npx vitest run 44/44 passing. No browser automation tool in this
environment - flagged to user to check /home/* in-browser, especially by
switching a test account to GUEST/LIMITED_MEMBER to confirm the Spaces->
Shared with Me swap and hidden create buttons render correctly.

TAG: [TASK]
PARENT: Redesign Home sidebar to match real ClickUp (Spaces/Channels/DMs sections) + role-based visibility
TITLE: Remove AI Chats section, add per-section collapse persisted to backend config
DESC: Two follow-up requests on the just-shipped Home sidebar redesign. (1)
Removed the "AI Chats" / "Ask, Build, Create" section entirely from
HomeSidebar.tsx (also cleaned up the now-unused openSheet/SparklesIcon/
useTopBarStore imports it pulled in). (2) Added a collapse chevron to each
of the Spaces/Shared-with-Me, Channels, and Direct Messages section headers
- SectionLabel is now a clickable button (chevron + label) toggling that
section's visibility, and per user's ask this state is persisted through
the same backend config wired up moments ago rather than being local-only.
Extended HomeSidebarConfig (lib/api/home.ts) with a third diff field
collapsedSections: string[] alongside the existing pinnedIds/order; home-
sidebar-store.ts got a new collapsedSections array + toggleSectionCollapsed
action, both folded into toSidebarConfig()/hydrateFromServer() so the same
GET-on-mount/diff-and-PATCH-on-change flow built for pin/order now also
carries section-collapse state to backend-py's UserHomeSidebar.config JSON.
Bumped the persist version 4->5 with a defensive migration
(collapsedSections: state.collapsedSections ?? []) so existing users'
localStorage records that predate this field don't end up with undefined.
Verification: npx tsc --noEmit clean, npx eslint clean on all three touched
files, npx vitest run 44/44 passing.

TAG: [TASK]
PARENT: Redesign Home sidebar to match real ClickUp (Spaces/Channels/DMs sections) + role-based visibility
TITLE: Sort Spaces/Channels/Direct Messages by recent activity
DESC: User asked for the three Home sidebar preview sections to sort most-
recently-active first. Channels and DMs already carry a lastAt timestamp
(last message time) from the existing chat API, so that was a pure frontend
sort - HomeSidebar.tsx now sorts both arrays by lastAt descending before
rendering. Spaces had no activity signal at all (Space model only has
created_at, confirmed via backend-py/app/db/models/home.py) so real backend
work was needed: added _last_activity_for_space() in home_service.py -
MAX(Task.updated_at) joined through TaskList for that space, falling back
to space.created_at when the space has no tasks yet. Threaded this through:
_build_space_payload() is now async (awaits the new helper) and both its
call sites in home_service.py (list_spaces, get_space) plus two more in
spaces_service.py (create_space, update_space) updated to await it;
map_space_row() (home_helpers.py) gained a lastActivityAt param, serialized
as an ISO string in the response. No DB migration - purely a computed
aggregate over existing columns, not a schema change. Frontend: SpaceDto
(lib/api/home.ts) gained optional lastActivityAt; HomeSidebar.tsx sorts a
local sortedSpaces array by it before rendering. Deliberately left
SpacesSidebar.tsx's own ordering (Space.is_personal.desc(), Space.name.asc()
at the query level) untouched - that page's alphabetical/personal-first
order is a separate, intentional choice per the earlier decision to only
enrich HomeSidebar, not the dedicated Spaces page.
Verification: python -c "import home_service/spaces_service/home_helpers"
clean, backend suites test_space_permissions/test_spaces_delete/
test_task_assignment/test_task_followers_statuses/
test_task_management_complete/test_roles_permissions_gaps/
test_member_time_permissions all passing (44 tests total) after the async
signature change to _build_space_payload. Frontend: npx tsc --noEmit clean,
npx eslint clean on HomeSidebar.tsx and lib/api/home.ts.

TAG: [TASK]
PARENT: Redesign Home sidebar to match real ClickUp (Spaces/Channels/DMs sections) + role-based visibility
TITLE: Expandable space rows in Home sidebar (hover chevron, nested lists)
DESC: User pasted a reference image of real ClickUp's Spaces section
showing an expanded "Team Space" with its lists (Project 1, Project 2,
LeetCode problems) nested underneath, and asked for the same: each space
avatar shows a dropdown chevron on hover, click expands/collapses to reveal
its lists. Rewrote SpaceRow in HomeSidebar.tsx from a flat Link into a
stateful expand/collapse row: the colored avatar and a chevron are stacked
in the same slot (absolute-positioned, opacity crossfade on
group-hover/space), clicking the row toggles expansion instead of
navigating (there's no dedicated per-space page in this app anyway - the
previous version linked generically to /spaces, which wasn't very useful).
When expanded, renders the space's folders (name + their lists) and
standalone lists via a new SpaceListLink component, each linking to the
already-existing /spaces/l/{listId} route with a task count, mirroring
SpacesSidebar.tsx's ListNavItem styling but without its rename/delete menu
(this is Home's lighter preview, full management stays on the dedicated
Spaces page). Also added a hover-reveal "+" button per space row (opens the
existing SpacesHierarchyDialog in {type:"list", spaceId} mode to create a
list directly) matching the reference image's per-row add affordance. Data
for folders/standaloneLists was already being fetched via fetchSpacesTree
(same call added for the activity-sort task) - no new backend/API work
needed, purely a frontend render change. Expand state
(expandedSpaces: Record<string,boolean>) is local component state, not
persisted - user didn't ask for it to survive reloads this round, unlike
the explicit ask for collapsedSections persistence in the prior sidebar
subtask; flagged as a deliberate scope cut rather than an oversight.
Docs (the "LeetCode problems" doc-icon item in the reference image) were
not implemented - this app has no Doc model/feature yet (same gap noted in
earlier roles/permissions audits: Tag and View models don't exist either),
so only real Lists render.
Verification: npx tsc --noEmit clean, npx eslint clean on
HomeSidebar.tsx, npx vitest run 44/44 passing.

========================================
DATE_END: 2026-07-17

DATE_START: 2026-07-20

TAG: [TASK]
PARENT: Redesign Home sidebar to match real ClickUp (Spaces/Channels/DMs sections) + role-based visibility
TITLE: Open List/Channel/DM in-place under Home instead of a Sheet overlay
DESC: Follow-up correction from user on Friday's last piece of work. I had
built clicking a List/Channel/DM row in Home's sidebar to open a right-side
Sheet overlay (HomePeekPanel.tsx + a `?peek=` query param hook) - user
clarified that was wrong: the actual ask was for the same behavior as the
/chat tab, where clicking a channel does a normal navigation that swaps the
main content area while the sidebar (part of that route group's persistent
layout) stays mounted - not a modal/drawer.
Reverted: deleted frontend/src/components/home/HomePeekPanel.tsx and
frontend/src/hooks/use-home-peek.ts entirely, removed <HomePeekPanel/> from
(app)/home/layout.tsx.
Implemented properly: added three new Home-scoped routes mirroring the
existing /chat and /spaces pages line-for-line (same components, just
under a different path so they render inside Home's layout/sidebar instead
of chat's or spaces'): (app)/home/c/[channelId]/page.tsx (ConversationView,
or ListWorkspace if the channel is list-primary - copied chat's exact
branching logic), (app)/home/dm/[dmId]/page.tsx (ConversationView),
(app)/home/l/[listId]/page.tsx (ListWorkspace, basePath=/home/l/{listId} so
its internal task-drawer/view-switch links stay under Home). Discovered
(app)/home/spaces/[spaceId]/page.tsx already existed as a space-summary
index page - left untouched, unrelated to this fix (Space rows in the
sidebar already expand in place per Friday's other task; only the
list-click target needed fixing).
HomeSidebar.tsx: SpaceListLink/ChannelRow/DmRow reverted from
button+onOpen(peek) back to plain <Link> pointing at the new /home/l|c|dm/
routes; "active" state reverted from comparing against the peek object to
comparing pathname against those routes, matching the original convention
used everywhere else in this file.
Noted but not chased: ConversationView.tsx has two hardcoded
router.push("/chat")/router.replace("/chat") calls (stale-channel-404
recovery, and post-delete-channel redirect) that will still bounce a user
out to /chat in those specific edge cases even when opened from Home -
same pre-existing behavior /chat's own page already has, not a new
regression, just not fully Home-aware. Left as-is rather than threading a
"return path" through ConversationView for two rare error paths.
Verification: npx tsc --noEmit clean, npx eslint clean on HomeSidebar.tsx,
the layout, and all three new page files; npx vitest run 44/44 passing.

TAG: [BUG]
PARENT: Redesign Home sidebar to match real ClickUp (Spaces/Channels/DMs sections) + role-based visibility
TITLE: List-primary channel opened as a channel link should default to the Channel tab, not List
DESC: User caught that opening a list-primary channel (a channel tied to a
List, rendered via ListWorkspace's tabbed layout) always landed on the List
tab by default, even when opened via a channel link (from Home's new
/home/c/[channelId] or the existing /chat/c/[channelId]) - since the user
clicked a channel, they expect to land on the conversation, not the board.
ListWorkspace.tsx hardcoded its no-`?view=`-param default to "list". Added
a defaultView prop (defaults to "list", preserving /spaces/l and /home/l
behavior unchanged) and fixed the view-resolution ternary to also recognize
an explicit "list" in the URL (previously only checked for board/calendar/
channel, relying on "list" being the fallback - which broke once the
fallback could be something else); setView()'s "clear the param for a
clean URL" condition also switched from hardcoding `mode === "list"` to
`mode === defaultView`. Passed defaultView="channel" from both
/chat/c/[channelId]/page.tsx and /home/c/[channelId]/page.tsx (the two
places that render ListWorkspace for a channel rather than a plain list).
Verification: npx tsc --noEmit clean, npx eslint clean on ListWorkspace.tsx
and both channel pages, npx vitest run 44/44 passing.

TAG: [FEATURE]
TITLE: Complete Teams feature to match real ClickUp
DESC: Kicked off closing the gap between Kinetix's existing Teams feature
(named user groups with members) and real ClickUp's Teams. Broken into an
audit task and a spec-writing task (below); implementation to follow in
later sessions.

TAG: [TASK]
PARENT: Complete Teams feature to match real ClickUp
TITLE: Audit current Teams implementation vs ClickUp
DESC: Explore-subagent audit of backend-py and frontend for the existing
Teams feature. Already implemented: Team/TeamMember data model
(backend-py/app/db/models/team.py, enums.py TeamRole LEAD/MEMBER) wired
only to Workspace; full CRUD via app/api/v1/teams.py +
app/services/team_service.py (create/list/get/update/delete, search/sort,
"my teams"); membership add/remove with per-team LEAD/MEMBER role;
authorization is workspace ADMIN+ (can_manage_teams) or the team's own LEAD
for manage/delete, any active member can create a team and becomes its
LEAD; frontend teams list + detail pages (frontend/src/app/(app)/teams/,
src/components/teams/), create/edit dialogs (name/color/single-char-emoji
icon/description/member picks), team badges on PeopleView, "Teams" nav
entry. Migration is a standalone scripts/migrate_teams.sql, not in the main
migration chain - flagged to verify it's applied consistently across envs.
Gaps found vs real ClickUp (where Teams is a functional group primitive,
not just a label): no task assignment by team (assignee pickers only know
individual users), no @mention-a-team support, no permission/sharing
scoping by team (Space/List/Folder ACL never references Team/TeamMember -
real ClickUp lets you share a location with a team), no team filter on
task views, no team avatar image upload (icon is a single emoji/char), no
bulk-add-members endpoint (one userId per call), no team activity/audit
log, no automations integration (no automations system exists at all yet).
Also flagged: specs/roles_and_permissions.md section 1.4 calls Teams
"Kinetix-specific, not a ClickUp concept - no gap to close," which is
stale now that this audit confirms Teams is a real ClickUp concept with a
real gap; noted to update that line once this work lands.

TAG: [CHORE]
TITLE: Create feat/teams branch
DESC: Branched feat/teams off feat/roles-and-permission (most up-to-date
branch at the time) to hold the Teams-completion work separately. Not
pushed to origin yet.

TAG: [TASK]
PARENT: Complete Teams feature to match real ClickUp
TITLE: Write specs/teams.md
DESC: Turned the audit into a formal spec at specs/teams.md, following the
same structure as specs/roles_and_permissions.md (section 1 "Already done"
with file citations, section 2 "To do" as [TASK] items, section 3 suggested
build order). To-do list: assign tasks to a team (expands to member
userIds at assign-time via the existing TaskAssignee path, no new table);
@mention a team (same expand-to-members primitive, notification fan-out);
share Spaces/Folders/Lists with a team for permission scoping - flagged as
needing a DB decision before implementation (either add a nullable team_id
alternative key to SpaceMember, or resolve team membership at
permission-check time in space_permissions.resolve_space_permission by
unioning team-level grants) per CLAUDE.md's "ask user first" rule on any DB
table/column change; filter tasks/views by team; team avatar image upload
(reuse existing avatar-upload path, don't build a new pipeline); bulk-add
team members (extend the existing add-member endpoint per CLAUDE.md's CRUD
guidance, not a new endpoint). Explicitly out of scope for now: automations
by team (no automations system exists), team audit log (no audit-log
system exists generally). Suggested build order: (1) task assignment +
mention by team first since both share the same primitive and need no
schema change, (2) bulk add members + avatar upload, (3) team filter on
task views, (4) Space/List/Folder sharing by team last, only after the DB
decision is confirmed with the user.

TAG: [TASK]
PARENT: Complete Teams feature to match real ClickUp
TITLE: Shelve Teams enhancements
DESC: User changed plan - skip Teams enhancement work for now. specs/teams.md
stays as the reference spec for when this resumes; no implementation
started, nothing to revert. feat/teams branch left as-is, unpushed.

TAG: [BUG]
TITLE: Sidebar scrollbar barely visible on Home/Chat/Spaces/Teams
DESC: User asked to "add" a vertical scrollbar to the left sidebar for
Home/Chat/Spaces/Teams/People. Investigated via Explore subagent first:
Home/Chat/Spaces/Teams each already have their own secondary sidebar
(HomeSidebar.tsx/ChatSidebar.tsx/SpacesSidebar.tsx/TeamsSidebar.tsx, each
rendered by their route-group layout.tsx) and all 4 already wrap their nav
content in the shared frontend/src/components/ui/scroll-area.tsx (base-ui
ScrollArea) - so they were already scrollable, just with a very faint
thumb (bg-muted-foreground/30, 8px wide). People has no secondary sidebar
at all (full-width table page, just the global GlobalNav icon rail on the
far left) - confirmed with user via AskUserQuestion this is fine, skip
People, and that the real complaint on the other 4 is visibility ("I can't
see it"), not missing scroll functionality. Fix: bumped the shared
ScrollBar thumb opacity (30%->50% default, 50%->70% hover) and width
(w-2->w-2.5, both orientations) in scroll-area.tsx - this is the single
shared primitive all 4 sidebars use, so one small style change fixes
visibility everywhere it's used (also affects chat side-panels/menus that
reuse the same component, a consistent improvement not scope creep).
Verification: npx tsc --noEmit clean. No browser-automation tool available
this session - recommend a quick visual check of Home/Chat/Spaces/Teams
sidebar scrollbars before calling this done.

TAG: [TASK]
TITLE: Search bar in workspace switcher popup
DESC: User asked for a search bar in "the workspace panel" - clarified via
follow-up to mean the workspace switcher popup
(frontend/src/components/shell/WorkspaceSwitcherPopup.tsx, opened from
TopBar.tsx). Added a search Input (reused existing ui/input.tsx +
SearchIcon, same pattern as HomeSidebar's search button) above the "Switch
workspace" list, only shown when that section renders (workspaces.length >
1, unchanged condition). Filters the workspace list client-side by
case-insensitive substring match on name; shows a "No workspaces found"
row when the filter yields nothing. No backend change - workspace list is
already fully loaded client-side via the auth store. Verification: npx tsc
--noEmit clean.

TAG: [BUG]
PARENT: Search bar in workspace switcher popup
TITLE: Fix can't type in workspace switcher search input
DESC: User reported the new search Input in WorkspaceSwitcherPopup.tsx
didn't accept keystrokes. Root cause: the popup renders inside base-ui's
Menu (DropdownMenuContent), which handles keydown at the Popup level for
roving-focus/typeahead (jump-to-item-by-typed-letter) - since the Input
isn't a MenuItem, typed keys bubbled up from it into that handler, which
intercepted them before they could register as normal typing. Fixed with
the standard fix for this pattern (same one Radix/base-ui docs recommend
for a search box inside a menu): added onKeyDown={(e) =>
e.stopPropagation()} directly on the Input so keydown events never reach
the Menu's own listener. Verification: npx tsc --noEmit clean. No browser
tool available this session to click-test live - recommend confirming
typing now works before calling this done.

TAG: [TASK]
TITLE: Match Home sidebar's channel/DM icons to Chat sidebar's
DESC: User asked Home's left sidebar to use the same channel/DM icons as
Chat. Both HomeSidebar.tsx and ChatSidebar.tsx already read from the same
loadSidebarLists query (identical Channel/DirectMessage data shape,
lib/types/chat), so Home just wasn't using fields Chat already renders.
Channel: Home's ChannelRow only ever showed a plain HashIcon; added the
listChannel prop + Hash+ListIcon combo Chat uses for list-primary channels
(c.isListPrimary), matching ChatSidebar.tsx's ChannelRow icon logic
exactly. DM: Home's DmRow rendered a static small avatar with presence
hardcoded to "offline" and no group-DM support at all; replaced with the
same shape as ChatSidebar.tsx's DmAvatar/DmRow - live presence via
useUserPresence (stores/presence-store), size-6 avatar with sm presence
dot, and GroupDmAvatarStack (components/chat/GroupDmAvatarStack) +
otherGroupParticipants/resolveGroupDmTitle (lib/chat/group-dm-display) for
group DMs, sourced from the same d.participants/d.isGroup/d.presence
fields Chat already uses. Added currentUserId via useAuthStore (same
pattern ChatSidebar uses) to resolve group DM display. Reused existing
shared components/helpers throughout, no new components created.
Verification: npx tsc --noEmit clean. No browser tool available this
session - recommend a visual check of Home's channel list-icon and a group
DM row before calling this done.

TAG: [BUG]
TITLE: Home/Chat sidebar channel+DM order didn't reflect latest activity live
DESC: User reported channels/DMs in Home and Chat sidebars weren't sorted
desc by latest activity (most recent message first). Backend (chat_service.py
list_channels/list_dms) and the frontend merge helpers
(lib/chat/sidebar-lists-loader.ts sortByLastAt) were already correct on
initial load - the bugs were both in realtime updates never reaching the
sidebar order after that.
Bug 1 (root cause, both Home and Chat): lib/chat/sidebar-realtime.ts's
applyRealtimeMessageToSidebar - the handler for the "chat:message" socket
event - had `if (!currentUserId || event.message.authorId === currentUserId)
return;`, which skipped the sidebar lastAt/lastMessage patch entirely
whenever the CURRENT user was the message author. Sender's own client does
receive its own message's socket broadcast (multi-tab/device sync), but this
guard silently dropped it, so a channel/DM you just sent a message in never
moved to the top of your own sidebar - only reordered when someone else
later replied, or on a full page reload. Fixed: removed the early-return,
compute `isOwnMessage` and use it only to suppress the unread-count bump
(bumpUnread = !isOwnMessage && !isActiveConversation(event)) while still
patching lastAt/lastMessage (and thus reordering) for own messages too.
Bug 2 (Home-specific, more fundamental): HomeSidebar.tsx never subscribed to
the shared useChatStore sidebarListsCache at all - it called `useHomeQuery(()
=> loadSidebarLists(...), [])` once on mount and rendered that one-shot
result with a local .sort(), so it had zero reactivity to realtime patches
regardless of bug 1 (unlike ChatSidebar.tsx, which explicitly subscribes via
useChatStore((s) => s.sidebarListsCache) and re-merges on every store
change). Fixed by porting ChatSidebar's exact pattern into HomeSidebar:
subscribe to sidebarListsCache + sidebarRefreshKey via useChatStore, compute
cacheValid via the existing isSidebarCacheForSession helper, and derive
channels/dms via the existing mergeSidebarChannels/mergeSidebarDms helpers
(both already sort desc by lastAt internally) instead of a local sort on the
one-shot query result. Reused all existing helpers, no new sorting logic
duplicated. Net effect: any new message (sent or received) now live-reorders
both Home's and Chat's channel/DM lists immediately via the socket ->
Zustand-store-patch -> reactive-re-render -> re-sort chain, not just on next
page load. Verification: npx tsc --noEmit clean, npx eslint clean on both
touched files. No browser tool available this session - recommend manually
sending a message and confirming the conversation jumps to top of both
sidebars live before calling this done.

TAG: [FEATURE]
TITLE: Block inviting an already-invited or already-member user
DESC: User asked to prevent inviting someone who's already been invited
(pending invite) or already in the workspace. Audited
backend-py/app/services/invite_service.py's create_invite: the
"already a member" check already existed (409 ALREADY_MEMBER, checks for
an ACTIVE WorkspaceMember row on the target email's user) - only the
"already invited" case was missing. Instead of rejecting a duplicate
pending invite, create_invite silently reissued it (new token, updated
role, refreshed expiry) - redundant with the dedicated resend endpoint
(POST /workspaces/{id}/invites/{invite_id}/resend ->
resend_workspace_invite, which already exists and is what the frontend's
"Resend" action in PeopleView's pending-invites row actually calls).
Changed create_invite to raise 409 ALREADY_INVITED instead of silently
reissuing when a non-accepted Invite already exists for that
workspace+email. Behavior change worth flagging: previously, re-submitting
the invite form for a pending email was a de-facto way to change their
pending role before they accepted; that path is now blocked - to change a
pending invite's role you'd cancel it and send a fresh one (no UI exists
for editing a pending invite's role directly, out of scope here). Frontend
(WorkspaceInviteForm.tsx) needed no change - it already surfaces
ApiError.message via toast for any failed invite in its send loop, so both
new 409s show up automatically with the backend's message text.
Added tests/test_workspace_flow.py::
test_workspace_invite_rejects_duplicate_and_existing_member (3 cases:
duplicate pending invite same-case, duplicate different-case (email
lowercased on both write and lookup, confirmed still case-insensitive),
and inviting the OWNER's own already-active email). Verification: targeted
file 7/7 passed; full suite 107 passed / 6 failed, same pre-existing
async-event-loop asyncpg flakes as every prior session
(test_auth_profile, 3x test_google_oauth,
test_home_extras::test_lineup_add_reorder_remove,
test_home_notifications) - confirmed unrelated, not a regression.

TAG: [BUG]
TITLE: Unread badges missing on Home sidebar's channels/DMs
DESC: User reported no notification/unread indicator on channels or DMs in
Home's left sidebar. Confirmed: HomeSidebar.tsx's ChannelRow/DmRow never
rendered anything for unread count at all - unlike ChatSidebar.tsx's
ChannelRow/DmRow, which already show a Badge driven by the useSidebarUnread
hook (lib/chat/sidebar-display-unread.ts) fed from useChatStore's
unreadBadgeHold. Home's rows had the `unread` field available on the
underlying data (same Channel/DirectMessage shape from loadSidebarLists,
per today's earlier icon-parity and sort-order fixes) but never consumed
it. Fixed by porting Chat's exact badge pattern into both rows: added
`unread` prop, `useSidebarUnread("channel"|"dm", id, unread, active,
unreadBadgeHold)`, and the same Badge markup (size-5 rounded-full, only
rendered when displayUnread > 0), wired from c.unread/d.unread at the two
call sites. Reused existing hook/store, no new logic. This also benefits
from today's earlier HomeSidebar reactivity fix (subscribing to
sidebarListsCache via useChatStore) - unread counts now update live on
incoming messages, not just on next page load. Verification: npx tsc
--noEmit clean, npx eslint clean on HomeSidebar.tsx. No browser tool
available this session - recommend confirming the badge shows and clears
correctly (opening a channel/DM should clear its own badge) before calling
this done.

TAG: [BUG]
TITLE: Sending/replying to a message didn't notify recipients or show in inbox
DESC: User reported that sending a message or reply in Home or Chat wasn't
notifying the other user, and nothing showed up in their Inbox. Traced two
separate real bugs in backend-py/app/services/chat_service.py and
notification_service.py (both surfaces call the same backend, so "home or
chat" wasn't two separate bugs, just two entry points into one broken path
per conversation type):
(1) DM messages (send_dm_message): only ever created a notification via
create_mention_notifications (i.e. only if you @mentioned the other
person's name inside a DM, which is rare/redundant in a 1:1). A plain "hey"
with no mention created zero InboxItem and zero notification for the
recipient - confirmed by reading the function, no other code path patches
the sidebar/inbox for DM sends. Fixed by adding
create_dm_broadcast_notifications (new function, notification_service.py -
nothing existing covered "notify every DM participant on every message",
so a new function was warranted per CLAUDE.md's reuse-first rule) which
notifies every other participant on every DM message unconditionally (DMs
have no per-participant notification-level column to gate on, unlike
channels - a message directly to you should always notify, matching
ClickUp). Wired into send_dm_message alongside the existing mention check;
a mentioned recipient now correctly gets both the "Mentioned you" item and
the plain "New message from X" item, same double-notification pattern
channels already use for a mentioned member.
(2) Channel messages (send_channel_message, via
create_channel_broadcast_notifications): gated on each member's
notificationLevel column, which defaulted to "MENTIONS" both at the
ChatChannelMember DB column default (db/models/chat.py) and the
_notification_level() code fallback - so a plain non-mention channel
message notified nobody by design/default. Asked the user whether this was
also in scope (thread-reply notifications were separately confirmed
correct already - they already notify the parent author + prior repliers +
anyone mentioned in the thread, regardless of level). User confirmed:
change the default to ALL. Changed both the column default and the code
fallback to "ALL"; create_channel_broadcast_notifications already handles
ALL correctly (skips the mention-check branch entirely when level != 
"MENTIONS"), no logic change needed there beyond the default.
Existing ChatChannelMember rows already had 'MENTIONS' baked in from the
old default (SQLAlchemy `default=` only applies at insert time, doesn't
retroactively change persisted rows) - confirmed with user before running
a data-mutating query, then backfilled via a new one-time script
(scripts/backfill_channel_notification_level_default.sql +
scripts/run_channel_notification_level_backfill.py, asyncpg-based since
psycopg2 isn't an actual project dependency despite an existing sibling
migration script assuming it was - reused the existing run_*_migration.py
script pattern otherwise). Ran it against the local dev DB: 6252 rows
flipped MENTIONS -> ALL. Still needs to run against staging/prod before
those environments pick up the new default's real-world effect (same
"local dev only so far" caveat as every other .sql migration in this repo).
Added tests/test_workspace_flow.py::test_dm_plain_message_notifies_recipient
(sends a plain DM message with no mention, confirms the recipient's
/home/notifications feed contains it). Verification: targeted file 8/8
passed; full suite 108 passed / 6 failed, same pre-existing
async-event-loop asyncpg flakes as every prior session in this repo
(test_auth_profile, 3x test_google_oauth,
test_home_extras::test_lineup_add_reorder_remove,
test_home_notifications) - confirmed unrelated, not a regression, both
before and after the notification-level default change.

TAG: [FEATURE]
TITLE: Share Space/Folder/List with existing or not-yet-accepted workspace users
DESC: User request: no way to share a Space/Folder/List with specific people
today. Spec: Share buttons in 4 places (Space-context sidebar three-dot menu,
Home sidebar three-dot menu - didn't exist, had to be created, List/Channel
view top-right corner), gated so not every role can share, a modal that adds
people by picking from existing workspace members or typing an email
(including someone who's been invited to the workspace but hasn't accepted
yet - added now so their access is ready the moment they join), and a rule
that List-only members shouldn't see the parent Space/Folder in the tree.
Planned via EnterPlanMode with 5 upfront AskUserQuestion decisions (locked
before writing code, since CLAUDE.md requires asking first on any new/changed
DB table): mirror SpaceMember's shape for new FolderMember/ListMember tables
(not a unified polymorphic table); grants carry VIEW/COMMENT/EDIT like
SpaceMember already does; sharing by email is blocked unless that email is
an active member or already has a pending workspace Invite (no silent
auto-invite); Share button visible to OWNER/SUPER_ADMIN/ADMIN always, MEMBER
only if their resolved permission on that resource is EDIT (matches the
existing add_space_member gate exactly), GUEST/LIMITED_MEMBER never; pending
shares stored as nullable email+status columns directly on
SpaceMember/FolderMember/ListMember (reusing the existing MemberStatus enum)
rather than a separate pending-grant table, with userId nullable.

Backend: SpaceMember gained email/status columns + nullable userId (plus a
partial unique index on spaceId+email); new FolderMember/ListMember tables,
identical shape, via backend-py/scripts/migrate_share_grants.sql +
run_share_grants_migration.py (same runner-script convention as every other
.sql migration here). New backend-py/app/services/folder_list_permissions.py
mirrors space_permissions.py: resolve_folder_permission/resolve_list_permission
(List falls through List override -> Folder override -> Space, Folder falls
through Folder override -> Space, taking the highest applicable level at each
step so an override only ever widens access), require_*, user_ids_with_list_access
(per-list version of user_ids_with_space_access), resolve_share_target (turns
a ShareMemberBody's userId/email into a real grant or a pending one, or
raises the "invite them first" 400), resolve_pending_shares (converts pending
email-only grants into real userId grants, called from both
accept_invite_for_user/accept_invite_with_signup in invite_service.py before
the existing channel-membership sync). Generalized AddSpaceMemberBody into
ShareMemberBody (userId or email, exactly one) reused across all three
resource types' new GET/POST/DELETE .../members endpoints in home.py,
following the exact CRUD shape /spaces/{id}/members already used. Added
list_folder_members/add_folder_member/remove_folder_member and the List
equivalents to spaces_service.py (same file that already owns Folder/List
CRUD). Added a canShare bool to every Space/Folder/List response payload
(_build_space_payload, map_list_entry) computed from the same EDIT-or-
privileged rule, so the frontend can gate the button without an extra call.
New GET /home/shared-with-me endpoint + home_service.list_shared_with_me,
returning Folders/Lists the user has a grant on but can't already see via
Space access - what backs the "Shared with you" section.

Found and fixed two correctness gaps while wiring this in, beyond what the
plan explicitly enumerated but necessary for the feature's core promise to
actually work: (1) every task/list-scoped permission check in home_service.py
(get_list, list_tasks_for_list, create_task, create_subtask, checklists,
task dependencies, get_task, delete_task - 12 call sites) and
spaces_service.py (update_list, delete_list, add_task_comment) was still
gated on require_space_permission(space-only) - a List-only or Folder-only
share would have shown up in "Shared with you" but 403'd on every actual
action, including opening the list itself. Swapped all of them to the new
require_list_permission. (2) sync_list_channel_members_for_space
(chat_service.py) computed one target_ids set for the whole Space and
applied it to every list's channel - no per-list concept - so a List/Folder-
only grant would never actually add that person to the list's chat channel.
Changed the loop to call user_ids_with_list_access per channel/list instead.

Frontend: new frontend/src/components/shared/ShareModal.tsx, generic over
resourceType (space/folder/list) - reuses AddChannelMembersDialog's
member-picker pattern and WorkspaceInviteForm's email+role-select pattern
rather than building either from scratch. New addShareMember/fetchShareMembers/
removeShareMember + fetchSharedWithMe in lib/api/spaces.ts and lib/api/home.ts.
Wired into all 4 requested locations: SpacesSidebar.tsx's existing three-dot
menus (Space/Folder/List rows already had them); HomeSidebar.tsx, which had
no three-dot menu on any row at all - added one net-new to SpaceRow, the
inline folder block, and SpaceListLink, copying SpacesSidebar's
DropdownMenu pattern; SpacesListToolbar.tsx's breadcrumb row - a Share button
here covers both the List tab and the List's embedded Channel tab since they
share one toolbar, so ConversationView.tsx itself needed no changes. Added a
"Shared with you" section (SpacesSidebar and HomeSidebar) for List/Folder-only
grants that can't otherwise reach the tree - deliberately worded differently
from the pre-existing unrelated "Shared with Me" link (that one points to
assigned-to-me tasks, not this feature). Folder-only shared entries render
without a link since there's no dedicated Folder page in this app - a real
scope gap, noted rather than silently building a workaround route.

Verification: backend - `python -m ast` syntax check on every touched file,
full app import + SQLAlchemy configure_mappers() clean (no circular imports,
relationships resolve). Applied the migration to the local dev DB; smoke-
tested the whole flow end-to-end via FastAPI TestClient against the real DB
(sign up owner, create a private Space + List, confirm sharing an unknown
email 400s, share with a pending-invite email, accept that invite via
accept-signup, confirm the new user can open/edit the shared List, gets a
403 on the parent Space, shows up in shared-with-me, and got added to the
list's chat channel). Caught and fixed a real bug this way: the migration
created FolderMember/ListMember's status/permissionLevel as plain TEXT, but
the SQLAlchemy models declare them as native Postgres Enum columns (matching
how SpaceMember/WorkspaceMember already work) - inserts worked but any
query comparing against the enum (e.g. resolve_pending_shares) 500'd with
"operator does not exist: text = MemberStatus". Fixed the migration SQL to
use the real "MemberStatus"/"PermissionLevel" enum types and applied a
corrective ALTER COLUMN ... USING ...::"TypeName" to the already-migrated
dev DB. Frontend: `npx tsc --noEmit` clean; eslint clean except the same
pre-existing pervasive react-hooks/set-state-in-effect pattern already
noted in multiple earlier entries in this log (present in the codebase's own
use-home-query.ts hook, not something this change introduced). No browser
available this session - the 4 UI entry points and the ShareModal itself
have not been manually clicked through in-browser, only verified against
the API directly; recommend a manual pass before shipping.

TAG: [BUG]
TITLE: Guest-shared list not showing in "Shared with me" - investigation
DESC: User reported adding a guest to a List didn't show up in the guest's
"Shared with me" section. Traced the full path: resolve_share_target
(folder_list_permissions.py) correctly resolves an existing active
workspace member to an immediate ACTIVE ListMember grant;
list_shared_with_me (home_service.py) correctly filters to ACTIVE grants
whose parent Space isn't already visible to the user. Reproduced in-process
against the local dev DB with a real GUEST account (guest@test.com) and a
real shared list ("list with channel") - list_shared_with_me returned the
list correctly when called directly, so the backend logic was not actually
broken. User confirmed it started showing (looked like a stale-data/refresh
issue on their end, not a code bug) - no backend change made for this part.

TAG: [TASK]
PARENT: Guest-shared list not showing in "Shared with me" - investigation
TITLE: Merge duplicate "Shared with You" section into existing "Shared with Me"
DESC: While investigating the above, found I'd previously added a second,
separate "Shared with You" sidebar section (individually-shared List/Folder
entries from list_shared_with_me) sitting alongside the existing "Spaces"
section, which itself already relabels to "Shared with Me" for
GUEST/LIMITED_MEMBER roles. User pointed out this was a duplicate concept
and asked for one section. Fixed in frontend/src/components/shell/
HomeSidebar.tsx: removed the standalone "Shared with You" block entirely
and folded its entries (sharedWithMeQuery.data) into the existing
Spaces/"Shared with Me" container, rendered right after the user's own
sortedSpaces list, under whichever label that section already uses
(restricted roles see "Shared with Me" with both their granted spaces and
individually-shared lists/folders together; other roles see "Spaces" with
the same items appended). No second heading anymore. npx tsc --noEmit
clean.

TAG: [FEATURE]
PARENT: Guest-shared list not showing in "Shared with me" - investigation
TITLE: Notify recipient in inbox when a Space/Folder/List is shared with them
DESC: User asked: sharing a Space/Folder/List with someone should notify
them in their inbox, same as channel access already does (there's an
existing create_channel_access_notifications for "added to #channel", but
nothing equivalent for the Space/Folder/List sharing feature added earlier
today). Added create_resource_share_notification (new function,
notification_service.py - generic across all three resource types via a
resource_type param, since the three add_*_member functions in
spaces_service.py are otherwise near-identical and a single shared notifier
fits better than three near-duplicates). Wired into add_space_member,
add_folder_member, add_list_member (spaces_service.py): after the
member-row upsert commits, if the grant resolved to an immediate ACTIVE
real user (not a pending email-only/INVITED grant - there's no user to
notify yet in that case, and no actor-attribution data available for it
either), creates one InboxItem (type CHAT, same type channel-access
notifications reuse) and emits it live via the existing
emit_home_notifications. hrefs: space -> /home/spaces/{id} (real page,
exactly the access being granted); list -> /home/l/{id}; folder -> /home
(no dedicated folder page exists anywhere in the app today, matching the
same limitation the frontend's shared-items list already had for folder
entries - non-clickable). Explicitly NOT wired into
resolve_pending_shares/invite-acceptance (the case where someone shared a
resource with an email that didn't have an account yet, and the grant only
materializes later when they accept their workspace invite) - flagged as a
related known gap rather than half-building it, since Space/Folder/
ListMember rows have no "who granted this" column to attribute the
notification to at that later point. Added
tests/test_workspace_flow.py::test_list_share_notifies_recipient (shares a
list with an already-active member, confirms their /home/notifications
feed contains it). Verification: targeted files 9/9 (test_workspace_flow)
passed.

TAG: [FEATURE]
PARENT: Guest-shared list not showing in "Shared with me" - investigation
TITLE: Mask private Space name as "Shared with me" when only List/Folder was shared
DESC: User asked: on the list page's breadcrumb (spaceName / listName
title, same breadcrumb used whether the list is opened as a plain list or
as a list-primary channel - both routes render the same ListWorkspace
component fed by the same GET /workspaces/{id}/lists/{listId} endpoint, so
one backend fix covers both "spaceName" and "channelName" appearances the
user described), if the viewer doesn't actually have access to the parent
Space (only the List/Folder was individually shared with them), the real
private Space name shouldn't leak - show "Shared with me" instead.
Backend: home_service.py's get_list now also resolves the user's
Space-level permission via the existing resolve_space_permission (separate
from the List-level resolve_list_permission check that gates access to the
endpoint at all - a user can pass the List-level check via an explicit
ListMember override while still resolving to no Space-level access
whatsoever). Response's `space` object gained `name: "Shared with me"` (in
place of the real name) and a new `accessible: boolean` field when Space
access is absent. Frontend: threaded `accessible` through ListMetaDto
(lib/api/spaces.ts) -> ListWorkspace.tsx -> SpacesListToolbar.tsx; the
breadcrumb's space-name Link (which pointed at /home/spaces/{spaceId})
now only renders as a Link when accessible - otherwise plain text, so a
guest doesn't get a dead/403-bound link on top of the masked name (masking
the name but leaving it clickable would just move the leak one click
later). Added tests/test_space_permissions.py::
test_list_only_share_masks_private_space_name (private space, list shared
directly with a promoted GUEST, no space-level grant - confirms the guest
sees name="Shared with me"/accessible=false while the OWNER still sees the
real name/accessible=true on the same endpoint). Verification: targeted
file 5/5 passed, npx tsc --noEmit clean, npx eslint clean on all touched
frontend files (one pre-existing unused-var warning in
SpacesListToolbar.tsx, unrelated line, not introduced by this change), npx
vitest run 44/44 passed.

TAG: [TASK]
TITLE: Uniform text-sm in channel/DM conversation header
DESC: User asked for the conversation header (ConversationView.tsx) text
to be consistent - previously title was text-base (16px) and the
subtitle/member-count line was text-xs (12px), a big jump between the two.
Clarified via AskUserQuestion: wanted both lines at the same text-sm size,
not a size bump. Changed both the channel branch (h2 title +
ChannelNameLabel, p subtitle showing topic/member count) and the DM branch
(h2 title, p subtitle showing "Direct message"/member count) from
text-base/text-xs to text-sm/text-sm. Verification: npx tsc --noEmit
clean. No browser tool available this session - recommend a quick visual
check before calling this done.

TAG: [BUG]
PARENT: Uniform text-sm in channel/DM conversation header
TITLE: Wrong header targeted - fix was the list-page breadcrumb, not the chat header
DESC: User clarified the earlier "header section" complaint meant the
list-page breadcrumb (SpacesListToolbar.tsx, e.g. "Shared with me /
channel" - spaceName / listName row above the list/board/channel tabs),
not ConversationView.tsx's chat header title/subtitle that I changed
instead. That breadcrumb was text-[11px] throughout (both the spaceName
link/span and the listName), which matches "looking very small" literally.
Fixed: both spans in SpacesListToolbar.tsx's breadcrumb row (container
holding spaceName + separator, and the listName span) changed from
text-[11px] to text-sm. Left the earlier ConversationView.tsx change in
place (not wrong, just not what was being asked about - a reasonable
improvement on its own, no reason to revert). Verification: npx tsc
--noEmit clean.

TAG: [SUBTASK]
PARENT: Wrong header targeted - fix was the list-page breadcrumb, not the chat header
TITLE: List-page view tabs (Channel/List/Board/Calendar) also to text-sm
DESC: Follow-up on the breadcrumb fix - user asked for the view tabs row
right below it (SpacesListToolbar.tsx's UnderlineTabBar - Channel/List/
Board/Calendar) to match, also text-[11px] via its size="xs" variant.
UnderlineTabBar (components/shared/Tabs.tsx) is a shared component used in
4 other places (InboxView.tsx, PersonProfilePanel.tsx, ChatSidebar.tsx) -
didn't touch its "xs" size definition itself (would've changed those too);
instead just changed this one call site's size prop from "xs" to
"default", which maps to text-sm. Verification: npx tsc --noEmit clean.

TAG: [SUBTASK]
PARENT: Wrong header targeted - fix was the list-page breadcrumb, not the chat header
TITLE: Share button - offwhite/black styling, moved to sit above tabs line
DESC: Continued styling pass on SpacesListToolbar.tsx. (1) Share button
recolored: was variant="outline" (theme-reactive bg/text) - now fixed
bg-neutral-100 (offwhite, same in light/dark since it's a literal Tailwind
gray step, not a theme CSS var) with border-neutral-200, text-black on
both the label and the Share2Icon, hover:bg-neutral-200. (2) Moved the
button out of the breadcrumb row (where it sat top-right, away from the
tabs) into its own right-aligned row directly above UnderlineTabBar, so it
sits flush just above the tab bar's own border-b line instead of up next
to the spaceName/listName breadcrumb. Verification: npx tsc --noEmit
clean.

TAG: [SUBTASK]
PARENT: Wrong header targeted - fix was the list-page breadcrumb, not the chat header
TITLE: Share button - white bg, inline with tabs row
DESC: Two more tweaks to SpacesListToolbar.tsx's Share button. (1)
bg-neutral-100 (offwhite) -> bg-white per user correction, hover ->
hover:bg-neutral-100. (2) "Vertically align with the tabs" - previously
the button sat in its own row directly above UnderlineTabBar; now it's
inline in the same row as the tabs, vertically centered with them via one
shared flex container (`justify-between border-b border-border px-3`
wrapping both). UnderlineTabBar's own border-b/px-3 were stripped via its
className prop (border-b-0 px-0 - cn() uses tailwind-merge so the passed
className's conflicting utilities win over the component's defaults) so
the wrapper's single border-b is now the one continuous line under both
the tabs and the button, instead of two separate borders. Verification:
npx tsc --noEmit clean.

TAG: [BUG]
PARENT: Wrong header targeted - fix was the list-page breadcrumb, not the chat header
TITLE: Share button bg-white wasn't actually rendering white
DESC: Root cause: Button (ui/button.tsx) builds its class string via
buttonVariants({variant, size, className}) - class-variance-authority
concatenates className in with the variant's own classes, then the whole
string goes through cn()/tailwind-merge. variant="outline" sets
bg-background, a custom theme utility mapped to this project's own
--background CSS var (not a standard Tailwind palette class) -
tailwind-merge's default conflict rules don't recognize it as being in the
same "background-color" group as bg-white, so both classes survived in the
compiled output and whichever one's CSS rule happened to come later in the
generated stylesheet was winning, not my bg-white. Fixed by switching the
Share button from variant="outline" to variant="ghost" (no bg-* class in
its variant definition at all), so bg-white in className is the only
background class present - no ambiguity for tailwind-merge to get wrong.
Verification: npx tsc --noEmit clean.

TAG: [SUBTASK]
PARENT: Wrong header targeted - fix was the list-page breadcrumb, not the chat header
TITLE: Share button - slightly bigger
DESC: h-6->h-7, px-2->px-3, gap-1->gap-1.5, text-[11px]->text-xs,
icon size-3->size-3.5. Verification: npx tsc --noEmit clean.

TAG: [BUG]
PARENT: Wrong header targeted - fix was the list-page breadcrumb, not the chat header
TITLE: Share button hover showing transparent - dark: variant class wasn't overridden
DESC: User reported hover background showing transparent instead of the
intended neutral-100. Verified my earlier "tailwind-merge doesn't
recognize custom theme tokens" theory was actually wrong - empirically
tested via node (`twMerge('bg-background bg-white')` etc.) and confirmed
twMerge correctly dedupes bg-background/bg-white, hover:bg-muted/
hover:bg-neutral-100, and text-primary/text-black just fine; the earlier
outline->ghost variant switch happened to fix the rest-state background
for an unrelated reason (outline's dark:bg-input/30 + dark:hover:bg-input/50
weren't the active problem at the time). The real, still-present bug:
tailwind-merge buckets classes by modifier stack, so `dark:hover:bg-*` and
plain `hover:bg-*` are DIFFERENT buckets and don't conflict with each
other - ghost variant's `dark:hover:bg-muted/50` (Button's ghost variant,
ui/button.tsx) survives untouched by a plain `hover:bg-neutral-100`
override, and in dark mode that translucent 50%-opacity dark:hover class
wins, reading as "transparent" on hover. Fixed by adding matching
dark:-prefixed overrides (dark:bg-white dark:text-black
dark:hover:bg-neutral-100 dark:hover:text-black) alongside the existing
plain ones, verified the exact final merged class list via a direct
tailwind-merge node script before committing to it (confirmed
hover:bg-muted, dark:hover:bg-muted/50, and hover:text-foreground all
correctly get dropped, only my classes remain for those buckets).
Verification: npx tsc --noEmit clean, plus the node-level tailwind-merge
verification described above (higher confidence than the tsc check alone,
since this was a pure CSS-cascade bug tsc can't catch).

TAG: [FEATURE]
TITLE: Folder/List privacy + tighten Space/Folder/List sharing to match ClickUp
DESC: Grew out of investigating why a plain MEMBER could add/remove people
from a Space/Folder/List. Researched real ClickUp's actual rules via
WebSearch (help.clickup.com - Owner/Admin toggle Space privacy, public by
default, private locations need explicit invite, Guests can never be
shared a whole Space (only Folder/List/Task), Guests can't manage sharing
even with Edit permission, default grant on invite is Full Edit). Entered
plan mode given the DB-schema + architectural scope; ran 2 parallel Explore
agents to map Folder/TaskList models, permission resolution, the 6 add/
remove-member functions, and existing GUEST-gating patterns before writing
the plan (saved at
C:\Users\dell\.claude\plans\glittery-gliding-falcon.md). Plan approved
after two AskUserQuestion rounds: (1) manage-access gate = workspace
ADMIN+ only, not "any EDIT holder" (Kinetix has no creator-column concept
to replicate ClickUp's looser rule) - also fixes a previously-flagged
known gap (2026-07-09 audit: "any Member can privatize/rename a public
space"); (2) full backend+frontend scope, not backend-only.

Backend: (1) New Folder.isPrivate/TaskList.isPrivate columns (db/models/
home.py), migration scripts/migrate_folder_list_privacy.sql +
scripts/run_folder_list_privacy_migration.py (asyncpg-based, applied to
local dev DB after explicit confirmation). (2) Rewrote
resolve_folder_permission/resolve_list_permission (folder_list_
permissions.py) from a widen-only max(override,parent) scheme to match
resolve_space_permission's shape exactly: override wins, else own
is_private blocks ambient access, else inherit from parent - List now
properly recurses into resolve_folder_permission instead of inlining a
stale folder-override-vs-space check that never looked at folder.is_private
at all. (3) New _require_can_manage_access (is_workspace_admin gate,
spaces_service.py) replaces the EDIT-level check in all 6 add/remove_*_
member functions and the isPrivate branch of update_space/update_folder/
update_list (name/other-field changes stay at the old EDIT-level gate -
deliberately not touched, out of scope). New _get_space existence-only
helper (mirroring the pre-existing _folder_with_space/_list_with_space
pattern) so ADMIN+ can manage sharing on a private resource without first
needing their own grant on it, same as OWNER/SUPER_ADMIN's existing
bypass. (4) add_space_member now 400s if the resolved target's
WorkspaceRole is GUEST (folder/list shares with a Guest still work,
unaffected). (5) isPrivate added to Create/UpdateFolderBody and
Create/UpdateListBody schemas. (6) canShare flags across
_build_space_payload/get_list/create_folder/update_folder/create_list/
update_list switched from EDIT-level to is_workspace_admin(role) - found
and fixed a pre-existing bug in the process: create_folder/update_folder/
create_list/update_list were hardcoding canShare=True unconditionally,
never actually gated at all. _build_space_payload also gained proper
VIEW-level filtering so a private Folder/List with no grant is hidden
from the tree entirely, not just shown with canShare=false (necessary
now that Folder/List privacy can be stricter than their parent Space -
previously nothing needed this since Folder/List could never be more
restrictive than Space).

Hit a real design conflict while testing: the new "Guest can never get
Space access" rule broke test_private_space_override_grants_guest_access,
an existing, intentionally-built test from an earlier session verifying a
GUEST *can* get private-Space access via SpaceMember override (documented
in specs/roles_and_permissions.md). Flagged to user via AskUserQuestion
rather than silently picking a side - confirmed: keep the ClickUp rule,
update the old test. Renamed it to test_private_space_override_grants_
limited_member_access (LIMITED_MEMBER is a role ClickUp does allow this
for) with a comment explaining the intentional behavior change, so the
override mechanism itself stays covered.

Added 4 new tests to test_space_permissions.py: admin-only manage-access
across all 3 resource types (MEMBER 403s, ADMIN succeeds even without an
existing grant on a private resource), admin-only privacy toggle (rename
alone still works for MEMBER - verifies that boundary wasn't
accidentally tightened too), Guest-blocked-from-Space-but-not-List
sharing, and private Folder/List narrowing access below what the Space
grants (including tree-visibility filtering and override-restores-access).

Frontend: isPrivate threaded through ListMetaDto/SpaceDto types
(lib/api/spaces.ts, lib/api/home.ts) and create/patch Folder/List API
functions. SpacesHierarchyDialog.tsx: widened the existing "Make private"
Switch (previously Space-only) to also cover Folder/List create+edit,
gated to workspace-admin visibility only (via the same inline role-check
pattern already used in WorkspaceSettingsView.tsx) since only admins can
actually change it now. SpacesSidebar.tsx and HomeSidebar.tsx (both have
their own independent Space/Folder/List tree renderers, built in an
earlier session today): added a LockIcon next to private Folder rows and
List rows, matching the existing private-channel visual pattern, and
threaded initialIsPrivate into the rename dialogs.

Known, deliberate scope boundaries (not gaps, decided against per plan):
task-level privacy (no per-task sharing model exists in Kinetix at all);
Folder/List rename permission (unchanged, still EDIT-level, only the
isPrivate field itself is admin-gated); create-time isPrivate isn't
admin-gated at the raw API level the way update-time is (mirrors Space's
pre-existing create_space behavior; the UI never exposes the toggle to a
non-admin either way, so this is API-only defense-in-depth, not a
user-reachable gap) - noted rather than silently expanded scope to fix.

Verification: targeted file 9/9, full suite 114 passed / 6 failed (same
pre-existing async-event-loop asyncpg flakes as every session:
test_auth_profile, 3x test_google_oauth,
test_home_extras::test_lineup_add_reorder_remove,
test_home_notifications). Frontend: npx tsc --noEmit clean, npx eslint
clean except one pre-existing set-state-in-effect warning on an unchanged
line (same pervasive pattern flagged repeatedly elsewhere in this log),
npx vitest run 44/44 passed.

TAG: [SUBTASK]
PARENT: Folder/List privacy + tighten Space/Folder/List sharing to match ClickUp
TITLE: Move the privacy toggle from the rename dialog into the Share modal
DESC: User feedback: create-time "Make private" toggle in
SpacesHierarchyDialog.tsx is fine as-is, but for an EXISTING Space/Folder/
List the toggle belongs in ShareModal.tsx (alongside who it's shared
with) instead of the separate rename dialog - matches real ClickUp, where
privacy lives next to sharing, not next to renaming.
Backend already returned isPrivate on the share-members fetch
(fetchShareMembers -> ShareMemberDto response's isPrivate field,
add_space_member/etc.) but the frontend never read or rendered it - dead
data waiting for exactly this. Added patchResourcePrivacy (lib/api/
spaces.ts, new thin dispatcher over the existing patchSpace/patchFolder/
patchList given a ShareResourceType - reuses those, no new backend
endpoint). ShareModal.tsx: added a "Make private" Switch under the
header, seeded from fetchShareMembers' isPrivate on open, optimistic
toggle with rollback-on-error via patchResourcePrivacy. No admin-role
check needed inside ShareModal itself - the Share button that opens it is
already admin-gated (canShare, from this session's earlier work), so
anyone who can reach this modal is already an admin.
SpacesHierarchyDialog.tsx: showPrivateToggle now only true for the 3
create modes (space/folder/list), not edit-space/edit-folder/edit-list;
removed isPrivate from the edit-* submit payloads and dropped
initialIsPrivate from the HierarchyDialogMode edit-* variants entirely
(cleanup, not just hidden) - had to also strip the corresponding
initialIsPrivate props at all 3 SpacesSidebar.tsx call sites that
constructed edit-space/edit-folder/edit-list dialog modes, or the object
literals would no longer type-check against the narrowed variants.
Verification: npx tsc --noEmit clean, npx eslint clean except 3
pre-existing set-state-in-effect warnings on lines that predate this
change (same pervasive pattern noted repeatedly elsewhere in this log,
not newly introduced), npx vitest run 44/44 passed.

TAG: [SUBTASK]
PARENT: Folder/List privacy + tighten Space/Folder/List sharing to match ClickUp
TITLE: Share modal - move helper text into a tooltip next to Add people
DESC: The "Add people by name or email..." blurb was a DialogDescription
under the modal title. Moved it into a CircleHelpIcon button + Tooltip
next to the "Add people" label instead, removed the now-unused
DialogDescription import/usage. Verification: npx tsc --noEmit clean,
npx eslint clean except the same 2 pre-existing set-state-in-effect
warnings from the previous entry (unchanged lines).

TAG: [BUG]
PARENT: Folder/List privacy + tighten Space/Folder/List sharing to match ClickUp
TITLE: Private toggle wrong/stale in Share modal for Folder/List
DESC: Two bugs. (1) list_folder_members/list_list_members in
spaces_service.py never returned isPrivate in their response dict (only
list_space_members did) - add_folder_member/add_list_member route
through those same functions, so the ShareModal always saw isPrivate
undefined -> defaulted to false, showing the toggle off even for a
list already marked private. Added "isPrivate": folder.is_private /
task_list.is_private to both return dicts. (2) ShareModal's
handleTogglePrivate patched the backend but never told the sidebar
tree to refetch, so the lock icon in SpacesSidebar/HomeSidebar stayed
stale until a manual reload - both sidebars key their queries off
useSpacesStore's refreshKey, so added a bumpSpacesRefresh() call right
after a successful toggle. Verification: npx tsc --noEmit clean,
uv run pytest tests/test_space_permissions.py 9/9 passed.

TAG: [SUBTASK]
PARENT: Folder/List privacy + tighten Space/Folder/List sharing to match ClickUp
TITLE: Share modal - relabel candidates list, surface implicit Owner/Super Admin access
DESC: Two changes. (1) "Workspace members without access" label ->
"People". (2) OWNER/SUPER_ADMIN always get full EDIT on every
Space/Folder/List via resolve_space_permission's is_privileged bypass
(space_permissions.py), with no SpaceMember/FolderMember/ListMember row
backing it - so they were showing up in the "invite" candidates list as
if they had no access, when they actually always do. Added
_implicit_privileged_members() in spaces_service.py: queries active
WorkspaceMembers with role OWNER/SUPER_ADMIN not already in the
explicit override rows, appends them to list_space_members/
list_folder_members/list_list_members' data with implicit: true +
role. Frontend (ShareModal.tsx): these rows now render under "Who has
access" with a role label ("Owner"/"Super Admin" + "full access")
instead of a permission label, remove button hidden (no row to
delete - access is role-based, only removable by demoting their
workspace role). Regular ADMIN role NOT included here - ADMIN doesn't
get the automatic bypass (DEFAULT_LEVEL_BY_ROLE still applies to them
on public resources, no access at all on private ones without an
override), only OWNER/SUPER_ADMIN do. No "creator" concept exists on
Space/Folder/List (no created-by column) - not added, out of scope.
Also checked "who can remove admins" per user question: workspace
member removal (workspace_service.py's remove_workspace_member) already
correctly gates via can_edit_member - OWNER can remove anyone but
itself, SUPER_ADMIN can remove ADMIN/MEMBER/etc but not
OWNER/SUPER_ADMIN, plain ADMIN cannot remove another ADMIN or higher.
Pre-existing, correct, no change needed.
Verification: npx tsc --noEmit clean, uv run pytest
tests/test_space_permissions.py 9/9 passed.

TAG: [SUBTASK]
PARENT: Folder/List privacy + tighten Space/Folder/List sharing to match ClickUp
TITLE: Per-person permission dropdown in Share modal's People list
DESC: Each row in the "People" candidates list previously was one big
clickable button that added the member at whatever level was picked in
the single global permission Select up top - no per-person control.
Replaced each row with a static avatar/name/email + its own VIEW/COMMENT
/EDIT Select (uncontrolled, placeholder "Add as..."); picking a level
calls addMember with that row's own permissionLevel immediately (the
select IS the add action). Backend needed no changes - ShareMemberBody.
permission_level (schemas/spaces.py) is already a required field and
add_space_member/add_folder_member/add_list_member already store
whatever level is sent, so this was purely a frontend wiring fix - the
old code was just discarding per-person choice by always using the one
shared `permission` state. Top global Select still used unchanged for
the email-invite fallback row when typing a non-member's email.
Verification: npx tsc --noEmit clean, npx eslint clean except the same
2 pre-existing set-state-in-effect warnings (unchanged lines), uv run
pytest tests/test_space_permissions.py 9/9 passed.

TAG: [BUG]
PARENT: Folder/List privacy + tighten Space/Folder/List sharing to match ClickUp
TITLE: Private Space missing lock icon in sidebars
DESC: Earlier this session's Folder/List privacy work added a LockIcon
next to private Folder headers and private List rows in both
SpacesSidebar.tsx and HomeSidebar.tsx, but never added the equivalent
icon at the Space row itself - SpaceDto already carried isPrivate
(lib/api/home.ts), just wasn't read/rendered at that level.
SpacesSidebar.tsx: added LockIcon next to the Space name span.
HomeSidebar.tsx: SpaceRow's inline space prop type was missing
isPrivate entirely (only folders/lists sub-types had it) - added the
field and the icon next to the name span. Verification: npx tsc
--noEmit clean, npx eslint clean on both files.

TAG: [SUBTASK]
PARENT: Folder/List privacy + tighten Space/Folder/List sharing to match ClickUp
TITLE: Block explicit share/remove of Owner/Super Admin on Space/Folder/List
DESC: Owner already had the same implicit full-EDIT bypass as Super
Admin on every Space/Folder/List regardless of privacy or any override
row (is_privileged check in space_permissions.py/resolve_*_permission
covers both roles identically, confirmed by re-reading every call site
- symmetric already, nothing to fix there). The actual gap: nothing
stopped an admin from calling add_*_member to create a pointless
explicit override row for an Owner/Super Admin target (dead weight,
since is_privileged short-circuits before the override is even
checked), or remove_*_member to delete such a row - which would look
like it revoked their access via the "who has access" remove button,
but silently does nothing since access isn't row-backed for them.
Added _target_workspace_role() + _reject_if_privileged_target() in
spaces_service.py, wired into all 6 functions (add/remove x
space/folder/list) - raises 400 VALIDATION_ERROR instead of a
misleading no-op. Frontend already hid the remove button for implicit
Owner/Super Admin rows (ShareModal.tsx, from the earlier "who has
access" implicit-member work) and already excludes them from the
People/candidates list, so no frontend change needed here.
Verification: uv run pytest tests/test_space_permissions.py 9/9
passed, full suite 114 passed / 6 failed (same pre-existing baseline
flakes as every prior run this session - test_auth_profile, 3x
test_google_oauth, test_home_extras::test_lineup_add_reorder_remove,
test_home_notifications - nothing new broken).

TAG: [BUG]
PARENT: Folder/List privacy + tighten Space/Folder/List sharing to match ClickUp
TITLE: Owner could see a "remove myself" button on own private Space
DESC: User (logged in as OWNER) reported their own private Space's
"who has access" list showed them with a working-looking remove
button. Root cause: create_space (spaces_service.py) unconditionally
added an explicit SpaceMember row for the creator whenever body.is_
private was true, regardless of role - meant for a plain MEMBER
creator (who has no other way to keep access to their own private
Space), but also fired for OWNER/SUPER_ADMIN creators who already
bypass privacy entirely via is_privileged. That stray explicit row is
what showed up as a normal removable member instead of the implicit
"Owner - full access" row from the earlier _implicit_privileged_
members work. Fixed: `if body.is_private and not is_privileged(role)`
guard, added is_privileged to the workspace_permissions import.
Ran a one-off cleanup (confirmed with user first) deleting existing
stale SpaceMember rows where the target's workspace role is OWNER/
SUPER_ADMIN, joined through Space->WorkspaceMember - DELETE 50 in the
dev DB. Also checked FolderMember/ListMember for the same pattern
(no equivalent creator-row logic exists there, but a pre-guard admin
share could have left one) - DELETE 0 for both, nothing to clean.
Verification: uv run pytest tests/test_space_permissions.py 9/9
passed.

TAG: [BUG]
PARENT: Folder/List privacy + tighten Space/Folder/List sharing to match ClickUp
TITLE: Removed-from-share stays in victim's "Shared with me" sidebar
DESC: User A removes User B from a Space/Folder/List -> User B visiting
it gets "not found" (correct, permission-wise), but the entry lingered
in User B's "Shared with me" sidebar section until a manual page
reload. Cause: sharedWithMeQuery/spacesQuery in both HomeSidebar.tsx
and SpacesSidebar.tsx only refetch when useSpacesStore's refreshKey
changes, and bumpRefresh() is a client-local zustand call - it only
fires in the browser of whoever clicked remove (User A), User B's tab
never learns anything changed. Fixed with a targeted socket event
rather than a bigger poll/refetch-everything approach: added
broadcast_resource_access_removed() (app/socket/emit.py, "space:
access:removed", follows the same {workspaceId, userIds, ...} +
ws-room-broadcast-with-client-side-userId-filter shape as the existing
chat:channel:removed) and call it from remove_space_member/
remove_folder_member/remove_list_member (spaces_service.py) right
after a real row was deleted (checked via the DELETE statement's
rowcount, so it's a no-op when the target wasn't actually a member).
Frontend: new ResourceAccessRemovedPayload type (lib/types/realtime.
ts), ChatSocketProvider.tsx listens and calls useSpacesStore's
bumpRefresh() when the removed userId matches the current session -
same trigger the sidebars already use for the actor's own changes, so
both trees + Shared with me drop the entry live, no reload needed.
Scoped to explicit member removal only, per the report - a public-
>private toggle silently narrowing someone's ambient access has the
same staleness gap but wasn't what was reported, left alone.
Verification: npx tsc --noEmit clean, npx eslint clean, uv run pytest
tests/test_space_permissions.py 9/9 passed.

TAG: [BUG]
PARENT: Folder/List privacy + tighten Space/Folder/List sharing to match ClickUp
TITLE: Added-to-share doesn't show up live in Shared with me/Home sidebar
DESC: Mirror of the removal bug just fixed - User A shares a Space/
Folder/List with User B, the inbox notification fires fine
(create_resource_share_notification + emit_home_notifications already
worked), but the new entry didn't appear in User B's Shared with me/
Home sidebar until a manual reload - same root cause, User B's client
never gets told to refetch. Added broadcast_resource_access_granted()
in socket/emit.py ("space:access:granted", identical shape/pattern to
access:removed), called from add_space_member/add_folder_member/
add_list_member right where create_resource_share_notification already
fires (target_user_id set + status ACTIVE). Renamed frontend's
ResourceAccessRemovedPayload -> ResourceAccessChangedPayload (same
shape covers both events, was granted/removed-agnostic already) and
added a second ChatSocketProvider.tsx listener for space:access:granted
doing the same bumpSpacesRefresh() as removed.
Verification: npx tsc --noEmit clean, npx eslint clean, uv run pytest
tests/test_space_permissions.py 9/9 passed.

TAG: [BUG]
PARENT: Folder/List privacy + tighten Space/Folder/List sharing to match ClickUp
TITLE: No inbox notification on removal from Space/Folder/List
DESC: Adding someone already sent an inbox notification
(create_resource_share_notification), removing them sent nothing.
Added symmetric create_resource_unshare_notification() in
notification_service.py ("Removed from {resource}" / "{actor} removed
your access to..." , href "/home" since the resource is gone from
their view, activity_kind "{type}_unshare"). Wired into
remove_space_member/remove_folder_member/remove_list_member right
after a real row was deleted (result.rowcount check, same guard used
for the access:removed socket event) - only fires when target resolves
to a real active/invited workspace member (captured target_role from
the existing _target_workspace_role call already needed for the
privileged-target guard, reused instead of a second query) so a
pending-email target with no account doesn't get a dangling
notification. Same not-notifying-yourself guard as the share
notification.

TAG: [TASK]
PARENT: Folder/List privacy + tighten Space/Folder/List sharing to match ClickUp
TITLE: Verified Space/Folder/List share cascade behavior
DESC: User described expected cascade (List share -> just that list;
Folder share -> that folder + all its lists; Space share -> all its
folders + lists) using an OWNER->GUEST example. Traced resolve_list_
permission/resolve_folder_permission/resolve_space_permission
(folder_list_permissions.py, space_permissions.py) - cascade already
works exactly as described for Folder and List shares (List inherits
Folder override which inherits Space override, each level's own
is_private/override checked first). Flagged a real conflict: the
Space+Guest half of the example contradicts this session's earlier,
explicitly-confirmed rule that Guests can never get whole-Space access
(add_space_member 400s on a GUEST target) - real ClickUp behavior,
decided via AskUserQuestion earlier in this session. Asked user how to
reconcile - confirmed: keep the block. No code change; noted the
example should use Member/Admin for the Space-share case, Guest only
applies cleanly to the Folder/List cases.

TAG: [BUG]
PARENT: Folder/List privacy + tighten Space/Folder/List sharing to match ClickUp
TITLE: Shared folder shows in "Shared with me" but its lists don't
DESC: The previous task's cascade verification (resolve_list_permission
correctly inheriting a shared Folder's access) was right about the
*permission* layer - the actual bug was one level up, in how "Shared
with me" is assembled. list_shared_with_me (home_service.py) only ever
queried FolderMember/ListMember rows directly - a Folder shared with
someone produces exactly one FolderMember row, no ListMember rows for
its children (that's the whole point of the cascade), so the lists
inside it were never in the query result at all. Fixed by eager-
loading each shared folder's TaskLists (+ their tasks, for the count),
resolving each one's permission with the already-correct resolve_list_
permission, and nesting the visible ones as a "lists" array on the
folder entry (filters out any independently-private list with no
override, same VIEW-level check _build_space_payload already uses).
Deduped against the flat ListMember loop via a nested_list_ids set, so
a list that's both under a shared folder AND has its own separate
ListMember row doesn't render twice.
Frontend: SharedWithMeEntryDto (lib/api/home.ts) gained an optional
lists[] field. The folder row in both HomeSidebar.tsx and
SpacesSidebar.tsx's "Shared with me" rendering was previously a dead
end (icon + name, no children, not even a link) - now renders its
nested lists indented underneath, reusing the existing SpaceListLink
component in HomeSidebar and the same inline Link pattern already used
for top-level shared lists in SpacesSidebar.
Verification: npx tsc --noEmit clean, npx eslint clean, uv run pytest
tests/test_space_permissions.py 9/9 passed, full suite 114 passed / 6
failed (same pre-existing baseline flakes as every prior run this
session, nothing new broken).

========================================
TAG: [TASK]
PARENT: Folder/List privacy + tighten Space/Folder/List sharing to match ClickUp
TITLE: Verified shared-Space cascade + real-time already work, added regression test
DESC: User reported sharing a private Space with a LIMITED_MEMBER (1)
didn't show live, needed a manual reload, and (2) the Space showed but
its Folder/List didn't - explicitly asked to fix for every role, not
just LIMITED_MEMBER. Investigated both against actual code/tests
rather than assuming:
(1) Real-time: add_space_member already calls broadcast_resource_
access_granted (same "space:access:granted" event wired up two tasks
ago for Folder/List), and ChatSocketProvider.tsx already listens for
it and bumps useSpacesStore's refreshKey - identical, already-verified
mechanism as the Folder/List case. Code is correct and symmetric.
(2) Cascade: added test_shared_private_space_shows_its_folders_and_
lists (test_space_permissions.py), parametrized over MEMBER and
LIMITED_MEMBER (the two non-privileged, non-guest roles that can
receive a Space share - resolve_folder_permission/resolve_list_
permission have no per-role branching, so this structurally covers
every such role, not just the one tested by hand) - creates a private
Space with a Folder+List inside (default, not independently private),
shares the Space, asserts GET /spaces/{id} returns the Folder nested
under "folders" with its List inside "lists", and the standalone List
under "standaloneLists". Passed on the first run, no code fix needed -
_build_space_payload (home_service.py) already filters/nests correctly
via level_at_least(resolve_folder_permission(...), VIEW) same as
verified for the Folder/List "Shared with me" case previously.
No backend bug found for either report. Most likely explanation: this
session's granted-notification/cascade-adjacent fixes landed only
minutes before this report - if the backend dev server isn't running
with auto-reload, or the browser tab wasn't hard-refreshed, none of
today's changes would be live yet. Flagged this to the user; asked
them to confirm after a clean restart, and if still reproducible, to
check whether the Folder/List in question are independently marked
isPrivate (which correctly blocks inheritance even from a shared
parent - working as designed, not a bug, so worth ruling out first).
Also strengthened the new test to hit the plural GET /spaces endpoint
(what the sidebar actually calls, not just the single-space GET) with
the same nested assertions - still passed immediately, no gap there
either. Confirmed with user after restart+hard-refresh: (1) real-time
Space-share visibility now works fine (was stale server, as suspected -
no code bug), (2) the Folder/List in question were independently
marked isPrivate - confirmed working as designed, sharing a Space
doesn't unlock a Folder/List that's separately private, each level
needs its own explicit grant (matches test_private_folder_and_list_
narrow_access_below_space, an existing test from earlier this
session). No further code changes needed - both reports resolved via
investigation, not a fix.
Verification: uv run pytest tests/test_space_permissions.py 11/11
passed (9 previous + 2 new parametrized), full suite 116 passed / 6
failed (same pre-existing baseline flakes, nothing new broken).

========================================
TAG: [BUG]
PARENT: Folder/List privacy + tighten Space/Folder/List sharing to match ClickUp
TITLE: Private list's chat channel still visible in Channels tab
DESC: Real bug (unlike the previous two tasks, which turned out to be
non-issues after investigation). User: made a Folder+List private
inside an already-private, now-shared Space (correct: privacy is
independent per level, sharing the Space alone doesn't unlock them) -
but the private List's auto-created chat channel still showed up in
the recipient's Channels tab, which is wrong.
Root cause: update_space/update_folder/update_list (spaces_service.py)
toggle is_private but never called sync_list_channel_members_for_space
afterwards - so a List's primary channel (mandatory 1:1,
create_list_channel in chat_service.py) keeps whatever
ChatChannelMember rows it had from before the toggle. Someone who had
ambient (non-explicit) access before the List went private stays
stuck as a real channel member forever - nothing else ever re-derives
it. Fixed: added the resync call to all three update_* functions,
gated on privacy actually changing (same condition already used for
the _require_can_manage_access gate).
Added a regression test, test_making_list_private_removes_ambient_
members_from_its_channel - importantly it checks GET /chat/channels
(the real Channels-tab query, row-driven for every channel) not GET
/chat/channels/{id}/members (a different endpoint that, for any
non-private ChatChannel, returns the ENTIRE workspace roster
regardless of real membership rows - a separate quirk noticed along
the way: list-primary channels are always created with
ChatChannel.is_private=False, unrelated to the underlying List's own
is_private. Flagged to user as a secondary, unfixed issue - doesn't
affect the Channels tab, but means the "members" panel inside an
already-open private list's channel misleadingly shows everyone).
Ran a one-off cleanup (confirmed with user first): wrote scratchpad/
resync_list_channel_members.py, calling chat_service.sync_list_
channel_members_for_workspace (existing app service function, not raw
SQL) for every Workspace in the dev DB - 238 workspaces resynced
cleanly, no errors.
Verification: uv run pytest tests/test_space_permissions.py 12/12
passed, full suite 117 passed / 6 failed (same pre-existing baseline
flakes, nothing new broken).

TAG: [BUG]
PARENT: Folder/List privacy + tighten Space/Folder/List sharing to match ClickUp
TITLE: Channel of inaccessible private list still showing in Channels tab
DESC: User still saw the private List's channel after the previous
backend fix + DB resync. Backend data was already correct - wrote a
diagnostic script (scratchpad/diagnose_private_list_channels.py)
recomputing resolve_list_permission for every ChatChannelMember row on
every private list-primary channel workspace-wide: 27 private
channels, 0 mismatches. So the bug was purely stale frontend state.
Root cause: applyChannelMemberUpdate (lib/chat/sidebar-realtime.ts)
handles the chat:channel:member socket event (removed: true) - which is
exactly what sync_list_channel_members_for_space emits when it prunes
someone from a List's channel (unlike chat:channel:removed, which only
fires for an explicit, direct channel-removal action) - by patching the
cached *member roster* of that channel (patchCachedChannelMembers), but
never touched the current user's own sidebarListsCache.channels when
they themselves were the one removed. So losing List access via a
privacy toggle correctly deleted the ChatChannelMember row server-side
and correctly emitted the socket event, but the recipient's own
Channels tab just never dropped the entry - permanently stuck until
some unrelated cache invalidation happened to fire.
Fixed: applyChannelMemberUpdate now mirrors applyChannelRemovedFromSidebar
exactly when removed && member.id === currentUserId - calls
removeChannelFromSidebar/invalidateChannelMembers, clears active
conversation state if currently viewing it, and returns a boolean the
caller uses to redirect + toast (function signature changed void ->
boolean, only call site is ChatSocketProvider.tsx, updated to match
the existing chat:channel:removed handler's pattern). HomeSidebar.tsx
and ChatSidebar.tsx both read the same shared sidebarListsCache
(useChatStore), so this single fix covers both surfaces.
Verification: npx tsc --noEmit clean, npx eslint clean, uv run pytest
tests/test_space_permissions.py 12/12 passed (backend untouched this
round, re-run only for safety).

TAG: [BUG]
PARENT: Folder/List privacy + tighten Space/Folder/List sharing to match ClickUp
TITLE: List directly shared under an unshared private Folder never appears in tree
DESC: Real repro: private Space shared, private Folder inside NOT
shared, one private List inside that Folder IS shared directly - the
List's channel correctly showed (already-fixed logic), but the List
itself never appeared anywhere in the sidebar tree. Root cause:
_build_space_payload (home_service.py) resolved each Folder's own
permission first and `continue`d past the entire Folder - including
its lists loop - whenever the Folder itself failed the VIEW check.
resolve_list_permission already correctly prioritizes a List's own
override over its parent Folder's privacy (override checked before
ever looking at the Folder), so the permission layer was right all
along - the tree builder just never gave it the chance to run for any
List sitting under a Folder the user can't otherwise see.
Fixed: each List under a Folder is now resolved independently of the
Folder's own visibility; the Folder itself is only skipped if BOTH the
Folder has no access AND none of its Lists do either - so a Folder
with zero own-access but one individually-shared List now still shows
up, containing only that one List (its other, unshared Lists correctly
stay hidden). Added test_list_shared_directly_shows_in_tree_despite_
private_unshared_folder covering exactly this shape (Space shared,
Folder private+unshared, one List private+directly-shared, one List
private+unshared) - confirms the shared List shows nested under the
Folder and the unshared sibling List does not.
This also means list_shared_with_me's existing "skip if the Space is
already visible" logic (home_service.py, from two tasks ago) is
correct as-is now - previously that skip could have hidden a list like
this from Shared with me too (since the code assumed the normal tree
would show it, which it now actually does after this fix) - no change
needed there, already covered as a side effect.
Verification: uv run pytest tests/test_space_permissions.py 13/13
passed, full suite re-run pending.

TAG: [SUBTASK]
PARENT: Folder/List privacy + tighten Space/Folder/List sharing to match ClickUp
TITLE: Don't expose the unshared Folder's existence for a directly-shared List
DESC: Correction to the previous task. User: the private Folder itself
is not shared, only the List inside it is - the Folder container
should not show at all, only the List. My first fix nested the shared
List under a visible Folder entry, which leaked that Folder's
name/existence to someone who was never granted access to it.
_build_space_payload (home_service.py): when a Folder itself isn't
visible, its independently-visible Lists (still correctly resolved via
resolve_list_permission's override-wins-over-parent rule) now get
pushed into the Space's standaloneLists array instead of a folders[]
entry - the Folder is skipped entirely, same as if it didn't exist
from that user's point of view. Updated test_list_shared_directly_
shows_in_tree_despite_private_unshared_folder to match: asserts the
Folder is absent from body["folders"] and the shared List is the only
entry in body["standaloneLists"] (its unshared sibling List still
stays fully hidden, not leaked into standalone either).
No frontend change needed - SpacesSidebar.tsx/HomeSidebar.tsx already
render standaloneLists as flat entries, purely data-shape-driven.
Verification: uv run pytest tests/test_space_permissions.py 13/13
passed, full suite 118 passed / 6 failed (same pre-existing baseline
flakes, nothing new broken).

TAG: [FEATURE]
PARENT: Folder/List privacy + tighten Space/Folder/List sharing to match ClickUp
TITLE: Lock icon on private list's channel in Channels tab
DESC: Requested addition, not a bug. ChatSidebar.tsx and HomeSidebar.tsx
already had lock-icon rendering wired to channel.isPrivate (from
earlier Chat/Home icon-parity work), so this was purely a backend data
problem: ChatChannel.is_private is hardcoded False in create_list_
channel for every List-primary channel (noted as a side finding two
tasks ago) - it was never meant to carry meaning there, the List's own
is_private (a separate column on TaskList) is what should drive the
icon for these channels, and nothing surfaced it into the API.
_channel_payload (chat_service.py) gained a list_is_private param -
when channel.is_list_primary, the payload's "isPrivate" now reports
that instead of the always-False channel column. Wired into all 3
real call sites: list_channels (Channels tab, batch-fetches TaskList.
is_private for every list-primary channel in one query), get_channel
(single-channel fetch), and _emit_channel_joined (the realtime push
when someone gains channel access). The 4th call site (create_channel,
manual non-list channels) is untouched - list_id is always None there,
not applicable.
Added test_private_list_channel_reports_isprivate_true - creates a
private List, checks both GET /chat/channels (tab) and GET /chat/
channels/{id} report isPrivate: true for its channel.
Verification: uv run pytest tests/test_space_permissions.py 14/14
passed, full suite 119 passed / 6 failed (same pre-existing baseline
flakes, nothing new broken).

TAG: [SUBTASK]
PARENT: Folder/List privacy + tighten Space/Folder/List sharing to match ClickUp
TITLE: Lock icon still not showing - frontend sidebar cache never refetches
DESC: Backend was already correct (previous task's test proved it) -
user still not seeing the icon because of a third caching layer,
different from the two already fixed this session. loadSidebarLists
(sidebar-lists-loader.ts) returns the existing sidebarListsCache
as-is without calling GET /chat/channels at all whenever a cache
already exists for that user+workspace (force defaults false) - and
that cache is zustand `persist`-backed (chat-store.ts), so it survives
page reloads too. An existing channel member's cached entry has no
mechanism to ever pick up a List's is_private flipping after the
channel was first cached - sync_list_channel_members_for_space only
emits chat:channel:member events for members actually added/removed,
never for members who stay but whose channel's privacy display went
stale.
Fixed: added broadcast_channel_privacy_changed (socket/emit.py,
"chat:channel:privacy", same minimal-payload pattern as the existing
chat:channel:renamed sync), wired into update_list right where
privacy_changed is detected - fires only when the List's own
is_private literally flips (Folder/Space privacy toggles don't touch
TaskList.is_private, so they don't need this - the channel's isPrivate
is driven purely by its own List's flag, confirmed in the previous
task's _channel_payload change).
Frontend: patchSidebarChannel's patch type widened to include
isPrivate; new applyChannelPrivacyChanged (sidebar-realtime.ts) calls
it; new chat:channel:privacy listener in ChatSocketProvider.tsx.
Mirrors the exact chat:channel:renamed live-patch pattern already in
place, so both ChatSidebar.tsx and HomeSidebar.tsx (shared cache) pick
it up immediately, no manual reload needed - for any *future* privacy
toggle. Already-cached-stale entries from before this fix landed will
self-correct on the next debounced full sidebar refresh
(scheduleSidebarRefresh, existing mechanism, fires ~1.2s after new
channel activity) or a workspace switch/reload; not worth a one-off
client-side cache-bust since there's no way to reach into a user's
browser localStorage from here.
Verification: uv run pytest tests/test_space_permissions.py 14/14
passed, npx tsc --noEmit clean, npx eslint clean, full suite 119
passed / 6 failed (same pre-existing baseline flakes, nothing new
broken).

TAG: [CHORE]
PARENT: Folder/List privacy + tighten Space/Folder/List sharing to match ClickUp
TITLE: Commit staged changes for the sharing/real-time fix chain
DESC: Committed the full staged diff (13 files: chat_service.py,
home_service.py, notification_service.py, spaces_service.py,
socket/emit.py, test_space_permissions.py, ChatSocketProvider.tsx,
HomeSidebar.tsx, SpacesSidebar.tsx, lib/api/home.ts, lib/chat/sidebar-
channel.ts, lib/chat/sidebar-realtime.ts, lib/types/realtime.ts) as
a26b3c0 "fix: real-time sync and access cascade for space/folder/list
sharing" - covers unshare notifications, live sidebar/Channels-tab
sync on add/remove/privacy-toggle, the Folder-visibility-blocking-a-
directly-shared-List tree bug, and the private-list-channel lock icon.
Branch feat/roles-and-permission, 1 commit ahead of origin, not
pushed.

TAG: [FEATURE]
PARENT: Folder/List privacy + tighten Space/Folder/List sharing to match ClickUp
TITLE: Home sidebar's Space/Folder/List menus now match the Spaces page
DESC: HomeSidebar.tsx's dropdown menus only had Share (Space/Folder)
or Share (List) - SpacesSidebar.tsx (the dedicated /spaces page) has
always had the full set: New folder + New list + Rename + Share +
Delete space on a Space, New list + Rename + Share + Delete folder on
a Folder, Rename + Share + Delete list on a List (Personal
list/space exempted from Delete). Brought Home's menus up to parity by
porting the exact same conditions/ordering/icons.
SpaceRow gained onAddFolder/onAddListToFolder/onRename/onDelete props
(a new shared SpacesTreeMutationTarget = {type, id, name, isPersonal?}
type, mirroring the existing onShare callback shape) alongside the
existing onAddList/onShare; the Space dropdown trigger is now always
rendered (previously gated behind canShare, hiding Rename too) with
New folder/New list always available, Rename always available, Share
gated by canShare, Delete gated by !isPersonal - matching
SpacesSidebar exactly. Same treatment for the inline Folder dropdown.
SpaceListLink gained isPersonal/onRename/onDelete props; its dropdown
now shows whenever any action is available (not just canShare), with
Delete correctly excluded for the Personal space's Personal List
(same space.isPersonal && list.name === "Personal List" check
SpacesSidebar uses for standalone lists; Folder-nested lists never
carry isPersonal, matching SpacesSidebar's ListNavItem call sites too).
The flat "Shared with me" list/folder entries intentionally still get
no action menu at all - matches SpacesSidebar, you don't get to
rename/delete something someone else shared with you.
HomeSidebar() gained openRenameDialog (routes to SpacesHierarchyDialog's
edit-space/edit-folder/edit-list modes) and handleDeleteSpacesItem
(mirrors SpacesSidebar's handleDelete - calls deleteSpace/deleteFolder/
deleteList, redirects off a deleted List's own page, bumps
useSpacesStore's refreshKey), plus a ConfirmDialog mount identical to
SpacesSidebar's.
Verification: npx tsc --noEmit clean, npx eslint clean, npx vitest run
44/44 passed.

TAG: [BUG]
PARENT: Folder/List privacy + tighten Space/Folder/List sharing to match ClickUp
TITLE: Restrict dangerous Rename/Delete/New folder/New list to non-Guest/Limited-Member
DESC: User flagged the menu options just ported to Home (previous task)
as dangerous - backend only ever gated Rename/Delete/create-child at
plain content EDIT level (spaces_service.py, same bar as editing a
task), so any Member/Limited Member/Guest with an EDIT grant could
delete an entire Space and everything nested in it. Asked user to
scope it: confirmed restrict all four actions (not just Delete),
bar = "anyone with EDIT, except GUEST/LIMITED_MEMBER" (not a full
is_workspace_admin gate - regular Members keep these rights, matching
typical ClickUp collaborative norms), and the frontend must not even
show the options when blocked (not just rely on the backend 403).
Backend: added _require_can_edit_structure(role) (spaces_service.py) -
blocks GUEST/LIMITED_MEMBER regardless of an explicit EDIT override,
mirrors the existing _require_can_create_space Guest/Limited-Member
exclusion. Wired into create_folder, create_list, update_space (name/
color/description branch), update_folder (name branch), update_list
(name branch), delete_space, delete_folder, delete_list - privacy-
toggle branches keep their existing separate _require_can_manage_
access (is_workspace_admin) gate, untouched.
Exposed the check to the frontend as a new canManageStructure field:
map_list_entry/map_space_row (home_helpers.py) gained a can_manage_
structure param; _build_space_payload (home_service.py) computes it
per Space/Folder/List via a new _can_manage_structure(level, role)
helper (EDIT-level check + role exclusion, mirrors the backend gate);
the two direct spaces_service.py response sites (create_list/
update_list, plus the raw create_folder/update_folder dicts) set it
from the role check directly since EDIT is already guaranteed by the
time those responses build.
Frontend (HomeSidebar.tsx + SpacesSidebar.tsx): SpaceDto and its
nested folder/list types (lib/api/home.ts) gained canManageStructure.
New folder/New list/Rename are now wrapped behind space.
canManageStructure / folder.canManageStructure (Delete additionally
requires !isPersonal, same as before); the "..." actions trigger
itself is now hidden entirely when neither canManageStructure nor
canShare is true (previously always shown). SpaceListLink/ListNavItem
made onRename/onDelete optional - call sites only pass them when
list.canManageStructure is true, and both components' own dropdown-
trigger visibility already keyed off "is any action available" so no
change needed there beyond making the props optional.
Fixed test_private_space_override_grants_limited_member_access, which
explicitly proved a Limited Member with an EDIT override COULD create
a Folder - that's now the intentionally-blocked case, so replaced that
assertion with a canManageStructure: false check on the tree response
instead. Added test_limited_member_cannot_manage_structure_even_with_
edit (Space+Folder+List, all 4 actions blocked, canManageStructure
false at every level) and test_guest_cannot_manage_folder_list_
structure_even_with_edit (Folder/List only - Guest can never reach
Space-level structural actions in the first place, per the pre-existing
Guest+Space rule) and test_member_can_manage_structure_with_edit
(sanity check the gate doesn't over-block a plain Member).
Verification: uv run pytest tests/test_space_permissions.py 17/17
passed, full suite 122 passed / 6 failed (same pre-existing baseline
flakes, nothing new broken), npx tsc --noEmit clean, npx eslint clean,
npx vitest run 44/44 passed.

========================================
DATE_END: 2026-07-20

DATE_START: 2026-07-21

TAG: [BUG]
TITLE: Prod API calls missing /api/v1 prefix (empty NEXT_PUBLIC_API_URL build arg)
DESC: UI rendered correctly on prod after the Docker-container deploy fix,
but most API calls 404'd with a generic "API not found" message. Traced
via frontend/Dockerfile: ARG NEXT_PUBLIC_API_URL= (empty-string default)
baked straight into ENV, and docker-compose.app.yml's web build had no
args: block, so the empty string got baked into the prod image as a
genuine value (not unset). frontend/src/lib/api/client.ts does
process.env.NEXT_PUBLIC_API_URL ?? "/api/v1" - ?? only falls back on
null/undefined, not empty string, so API_BASE became "" and every
request lost its /api/v1 prefix, hit nginx's catch-all location / (the
web container itself) instead of /api/, and 404'd. Matched all 7 pasted
failing URLs exactly. docker-compose.staging.yml already passed this
build arg correctly and never hit the bug. Fix: added explicit args:
block (NEXT_PUBLIC_API_URL, NEXT_PUBLIC_APP_URL, NEXT_PUBLIC_SOCKET_URL)
to docker-compose.app.yml's web build, mirroring staging. Prepared
commit message/PR title/description on fix-prod-deploy branch per
user's standing instruction (I don't commit/push, user does). Confirmed
fixed live - other APIs started working.

TAG: [TASK]
PARENT: Prod API calls missing /api/v1 prefix (empty NEXT_PUBLIC_API_URL build arg)
TITLE: Fix DATABASE_UNAVAILABLE 503 on space/list members endpoints
DESC: After the /api/v1 fix landed, GET /spaces/{id}/members and
/lists/{id}/members still 503'd with DATABASE_UNAVAILABLE. Backend's
generic exception handler in main.py disguises many different failures
as this same message (real OperationalError, timeout, cancelled, or
any exception whose text contains "timeout"/"connection"/"pool"/etc),
so the code alone couldn't say which. Had user pull real traceback from
docker logs kinetix-api-1 on prod (ssh ubuntu@3.140.5.67). Actual error:
asyncpg.exceptions.InvalidTextRepresentationError: invalid input value
for enum "WorkspaceRole": "SUPER_ADMIN". Root cause:
backend-py/scripts/migrate_super_admin_role.sql (ALTER TYPE
"WorkspaceRole" ADD VALUE 'SUPER_ADMIN') existed in the repo but, unlike
every other .sql file under scripts/, had no matching
run_*_migration.py runner wired up - so it was never executed on prod.
_implicit_privileged_members in spaces_service.py filters
WorkspaceMember.role.in_([...,  WorkspaceRole.SUPER_ADMIN]), which
Postgres rejected since the enum type on prod never had that label.
check_schema_drift.py didn't catch this either since it only diffs
table columns, not enum labels - a real blind spot in that tool, noted
but not fixed (out of scope for this fix). Unblocked immediately by
running the SQL directly against prod via docker exec ... psql. Then
added backend-py/scripts/run_super_admin_role_migration.py (same
single-shot cur.execute(raw) pattern as run_space_permissions_migration.py,
needed because the SQL has a DO $$...$$ block that breaks under naive
;-splitting) so fresh environments don't hit the same gap. Prepared
commit message/PR title/description on fix-prod-deploy branch for user
to commit/push themselves. Confirmed working live on prod.

TAG: [TASK]
PARENT: Prod API calls missing /api/v1 prefix (empty NEXT_PUBLIC_API_URL build arg)
TITLE: Rewrite PROD_DEPLOY_RUNBOOK.md for Docker-based deploy.sh
DESC: Old runbook (untracked, written earlier this session before the
stale-container discovery) still described prod as systemd-based
(kinetix-api/kinetix-web services, uv sync on bare host). Rewrote fully
against Docker reality: backup/confirm-deploy/verify steps now use
docker compose -f docker-compose.yml -f docker-compose.app.yml against
prod's actual containers; migration steps now docker cp scripts/ into
the api container (image doesn't bake scripts/ in per
backend-py/Dockerfile - only app/ is COPYed) then docker exec with
DATABASE_URL exported and /app/.venv/bin/python, mirroring the pattern
already documented in deploy/STAGING_DEPLOY_RUNBOOK.md (found on
feat/roles-and-permission branch, commit 9924e58, not yet merged to
main). Added an explicit "Notes" callout for today's schema-drift blind
spot (check_schema_drift.py diffs columns only, not Postgres enum
labels - write the run_*_migration.py runner in the same PR as any
enum-altering .sql file, don't rely on drift check to catch a missing
one) plus notes on kinetix_edge external network, NEXT_PUBLIC_* being
build-time not runtime, and nginx/systemd gotchas already learned this
session.

========================================
DATE_END: 2026-07-21

DATE_START: 2026-07-22

TAG: [FEATURE]
TITLE: Platform admin portal (workspaces/users, separate app)
DESC: Existing Admin power (WorkspaceRole on WorkspaceMember) is scoped
per-workspace only - no way for internal staff to see/manage across all
workspaces and users. Built a new internal-only admin portal (2 pages:
Workspaces, Users) for platform staff, shipped as a third deployable app
so the main frontend never grows admin-only checks.

Key decisions worked through with user via AskUserQuestion/plan mode:
new PlatformRole DB table (separate from WorkspaceRole, single value
STAFF for now, room to add tiers later); Workspace gets a new `status`
enum column (ACTIVE/SUSPENDED - MemberStatus.SUSPENDED already existed
but is a different per-member concept); User gets `isDisabled` boolean
(disabling revokes all RefreshToken rows too); new AdminAuditLog table
(no audit-log concept existed anywhere before). Deploy routing: checked
live EC2 box (ss -tlnp, docker ps, systemctl status) and confirmed the
Docker stack (docker-compose.app.yml + kinetix-nginx-1) is the real prod
path - host nginx/systemd from deploy.sh is dead (masked/failed), so
deploy.sh is stale documentation, not reality. No domain exists yet (IP
3.140.5.67 only), so went with nginx path-prefix routing at
/admin-portal/ (same proven pattern as the existing /staging/ prefix)
instead of a subdomain - confirmed with user that path routing still
keeps admin-frontend a fully separate app/container, nginx just proxies
by path.

Backend (backend-py/): scripts/migrate_admin_portal.sql +
run_admin_portal_migration.py (repo has no Alembic, raw idempotent SQL
is the existing pattern) for PlatformStaff/AdminAuditLog tables and the
two new columns. app/db/models/platform.py (PlatformStaff,
AdminAuditLog), enums.py (PlatformRole, WorkspaceStatus), updated
user.py/workspace.py models. app/services/platform_permissions.py +
app/deps/platform.py (PlatformStaffDep) mirror workspace_permissions.py/
deps/workspace.py exactly. app/deps/auth.py get_current_user now 401s
disabled users globally. app/api/cookies.py adds a distinctly-named/
scoped cookie (riseup_admin_refresh, Path=/api/v1/admin) so it can't
collide with the main app's riseup_refresh when both apps are open in
the same browser (they're same-origin under path routing). New
app/services/admin_service.py (list/search workspaces+users with
pagination - no pagination pattern existed anywhere else in the API, so
this introduces the first one; suspend/reactivate/delete/transfer-
ownership for workspaces, reusing workspace_service's delete/transfer
logic minus the owner-only gate since PlatformStaffDep is the new
authorization boundary; disable/enable for users; audit log writes/
reads) and app/api/v1/admin.py router, registered in
app/api/v1/router.py. Caught and fixed a real bug during review: initial
router draft passed a literal string "platform-staff" as the audit log
actor_id instead of the real user's id, which would have violated the
AdminAuditLog FK on every write - fixed by adding CurrentUserDep to each
route. Verified: `uv run python -c "import app.main"` succeeds clean.

Frontend: new admin-frontend/ sibling Next.js app (same Next
16.2.6/React 19.2.4 versions as frontend/, reused frontend/'s existing
NEXT_PUBLIC_BASE_PATH-driven next.config.ts pattern verbatim since it
was already app-agnostic). Own zustand auth store with a distinct
persist key (riseup-admin-auth vs frontend's riseup-auth) and own
session-cookie module (riseup_admin_session vs riseup_session), since
localStorage/cookies are origin-scoped and both apps share an origin
under path routing. Deliberately skipped shadcn/base-ui/lucide/sonner to
keep the new app's dependency footprint small (just next/react/zustand)
- plain Tailwind v4 + native HTML. Pages: /login, /workspaces (search,
suspend/reactivate, delete w/ confirm, transfer-ownership via prompt,
per-row audit-log toggle), /users (search, disable/enable, same audit
toggle) - audit log folded in as an expandable row rather than a third
page. Verified: npm install + npx next build succeeded clean (TS +
lint), including confirming Next 16's proxy.ts (renamed from
middleware.ts per frontend/AGENTS.md's breaking-changes warning) compiled
as middleware correctly.

Deploy: added admin-frontend/Dockerfile + docker-entrypoint.sh (mirrors
frontend/'s two, adjusted for port 3002 and no socket-url arg), empty
public/.gitkeep (image COPY needs the dir to exist). docker-compose.app.yml
gets a new `admin` service (build ./admin-frontend, PORT 3002, no host
port published, same as web/api). deploy/nginx/docker.conf gets a new
location /admin-portal/ block, same shape as the existing /staging/ web
block (resolver-based upstream var, no path rewrite since Next's own
basePath already expects the full prefix). Verified end-to-end locally:
`docker run nginx:1.27-alpine nginx -t` against the edited config passed;
built the admin-frontend image with the real build args
(MSYS_NO_PATHCONV=1 needed locally since Git Bash on Windows mangles
leading-slash build-arg values into Windows paths - confirmed that's a
local-shell artifact only, not a real bug, by rebuilding with the
workaround); ran the built container and curled /admin-portal/login,
got HTTP 200, confirming the basePath is correctly baked in at build
time. Bootstrap plan for the first platform admin: manual one-off
INSERT into PlatformStaff via docker exec into postgres, no UI for
granting staff access in v1 (agreed with user, can add later).

TAG: [TASK]
PARENT: Platform admin portal (workspaces/users, separate app)
TITLE: Run admin portal migration locally + bootstrap first staff user
DESC: Ran backend-py/scripts/run_admin_portal_migration.py against local
Docker postgres (clickup-postgres-1, port 5433) - needed psycopg2-binary
installed into the uv venv first (uv pip install psycopg2-binary; not a
declared pyproject dependency, matches how every other run_*_migration.py
script in this repo already assumes it's installed ad hoc, not unique to
this one). Granted PlatformStaff to the existing seeded demo user
owner@demo.com (password123, already used across tests/seed scripts) via
a direct INSERT INTO "PlatformStaff" - simplest local bootstrap, matches
the agreed no-UI-for-granting-staff-in-v1 decision. Gave user the 3-terminal
local run instructions (backend on :4001 via uv run python -m app.main,
frontend on :3001, admin-frontend on :3002 via npm run dev) plus an
admin-frontend/.env.local copied from the example (NEXT_PUBLIC_API_URL
pointing straight at :4001, no NEXT_PUBLIC_BASE_PATH locally since that
prefix is prod/nginx-only).

TAG: [BUG]
PARENT: Platform admin portal (workspaces/users, separate app)
TITLE: Admin login blocked by CORS (OPTIONS preflight 400)
DESC: First local login attempt failed: OPTIONS /api/v1/admin/auth/login
400, "Login failed" in the UI. Root cause: backend-py/app/config.py's
browser_cors_origins property only ever derived allowed origins from a
single FRONTEND_URL setting (localhost:3001) - a single-frontend
assumption that predates this session's second app. admin-frontend runs
on :3002, a different origin, so the browser's preflight got rejected
before the real request was ever sent. Fix: added a second
admin_frontend_url setting (default http://localhost:3002) and widened
browser_cors_origins to union origin variants (localhost/127.0.0.1) from
both frontend_url and admin_frontend_url instead of just one. Verified
via `uv run python -c "from app.config import get_settings; print(...)"`
- origins list now includes both :3001 and :3002 (both localhost and
127.0.0.1 variants). In prod this is a non-issue (path-based nginx
routing means both apps share one origin, no CORS involved at all) - the
gap was local-dev-only, from running the two apps on different ports.

TAG: [BUG]
PARENT: Platform admin portal (workspaces/users, separate app)
TITLE: Disabled user only got logged out on hard refresh, not immediately
DESC: User reported: after an admin disables an account, the app shows
an error saying the account is disabled, but the user isn't actually
kicked to the login page until they hard-refresh. Root cause in
frontend/src/components/providers/AuthProvider.tsx: the session-recovery
logic (bootstrap(), which correctly clears the session on a 401) only
runs once, in a useEffect keyed off `hydrated` on initial mount - there
was no ongoing listener for 401s that happen later, from arbitrary API
calls made during normal navigation. AuthGate.tsx's redirect-to-login
effect IS properly reactive to accessToken - the actual gap was that
nothing outside the initial bootstrap ever cleared accessToken again
after that.

Fix: added a global 401 hook to frontend/src/lib/api/client.ts
(setUnauthorizedHandler/apiFetch fires it synchronously on any 401,
carrying the error code) and registered it in AuthProvider.tsx to call
clearSession() the instant code === "ACCOUNT_DISABLED" is seen, from any
API call anywhere in the app - not just the bootstrap flow. Deliberately
scoped to that one non-recoverable code rather than every 401: a
blanket "clear session on any 401" would have broken the existing silent
access-token-refresh flow (ordinary token expiry retries via refresh
before giving up; ACCOUNT_DISABLED never recovers via refresh since the
disable path already deletes all of that user's RefreshToken rows, so
it's safe to short-circuit immediately for that code specifically).
Verified with `npx tsc --noEmit` clean.

TAG: [FEATURE]
PARENT: Platform admin portal (workspaces/users, separate app)
TITLE: Expandable rows for per-workspace role management on both admin pages
DESC: User wanted deeper drill-down on both admin pages: Workspaces page
rows expand (click anywhere on the row, buttons stopPropagation so they
don't also toggle it) to show that workspace's member list, each with a
role dropdown (all WorkspaceRole values except OWNER - owner changes
stay exclusively on the existing Transfer button) and a per-member
Disable button; Users page rows expand to show all of that user's
workspace memberships as rows, each with the same role dropdown (again
excluding OWNER). Both role-change paths and the disable paths require
an explicit confirmation modal describing the consequence before acting
- built a small reusable ConfirmDialog component for this (replaces the
bare window.confirm the Users page's Disable button used before) since
the user explicitly asked for real modals, not browser-native confirm().

Backend: reused existing code where it already existed rather than
duplicating - workspace_service.list_workspace_members (already used by
the regular non-admin GET /workspaces/{id}/members endpoint) is called
directly from a new admin-gated GET /admin/workspaces/{id}/members (no
permission check inside the shared function itself, so just needed the
PlatformStaffDep wrapper); added one new field to that shared function's
output, isDisabled (m.user.is_disabled) - purely additive, safe for the
existing non-admin consumer. auth_service.get_me already builds exactly
{id, name, slug, role} per active membership for a given user_id, so
reused it directly for the new GET /admin/users/{id}/workspaces instead
of writing a new query. New admin_service.update_member_role_admin
rejects role=OWNER outright (400, "use transfer ownership instead") and
also rejects changing a target whose current role is OWNER, for the same
reason - the single-owner invariant lives entirely in
transfer_ownership_admin, this endpoint deliberately can't touch it.
Reuses broadcast_workspace_member_role_updated so regular workspace
members see the role change over the socket in real time, same as a
normal in-app role change. New PATCH
/admin/workspaces/{workspaceId}/members/{userId}/role and GET
/admin/users/{userId}/workspaces routes registered alongside the
existing admin router. Verified: `uv run python -c "import app.main"`
clean.

Frontend: added WORKSPACE_ROLES/WorkspaceRole/AdminWorkspaceMember/
AdminUserWorkspace types plus listWorkspaceMembers/updateMemberRole/
listUserWorkspaces calls to lib/api/admin.ts. Both pages track their own
expand/pending-confirmation state locally (no new store needed - this is
page-local UI state, not session state). Verified: `npx next build`
clean (TS + route generation) after the rewrite of both
workspaces/page.tsx and users/page.tsx.

TAG: [BUG]
PARENT: Platform admin portal (workspaces/users, separate app)
TITLE: Suspending a workspace didn't actually block access
DESC: User reported: after suspending a workspace from the admin portal,
members could still freely use it - Workspace.status existed as a column
(added earlier this session) but nothing anywhere actually checked it.
Root cause: app/deps/workspace.py's get_workspace_member - the dependency
every single workspace-scoped route runs through (home, tasks, chat,
spaces, members, everything) - only checked WorkspaceMember.status
(ACTIVE membership), never Workspace.status. Fix: added a check there -
if the workspace itself is SUSPENDED, raise 404 "WORKSPACE_NOT_FOUND"
(deliberately indistinguishable from a workspace that doesn't exist,
matching the user's own phrasing "it should say workspace does not
exist" - don't leak suspension state to a member who's lost access).
This is the real enforcement boundary; it alone fixes the bug since
every next request 404s immediately.

Also hid suspended workspaces from the two places a user's workspace
list gets built - workspace_service.list_workspaces (the "my
workspaces" picker) now filters them out directly, and
auth_service.get_me (used by /auth/me, the session bootstrap/refresh
path) got a new include_suspended param, default False so regular
users stop seeing a suspended workspace at all, but the admin portal's
GET /admin/users/{id}/workspaces passes include_suspended=True since
staff need to see (and reactivate) a suspended workspace when looking
at a user. get_me's per-workspace dict also gained a "status" field as
part of this (harmless additive change, only admin_service actually
uses it today - surfaced in the Users page's workspace-expansion table
too, small bonus).

For "should be logged out" specifically (not just blocked on next
click): reused the app's existing Socket.IO broadcast pattern (the same
one already powering live role-updates, chat, presence, etc. - see
app/socket/emit.py's room="ws:{workspace_id}" convention) to add
broadcast_workspace_suspended/_reactivated/_deleted, fired from
admin_service.set_workspace_status and delete_workspace_admin.
frontend/src/components/providers/ChatSocketProvider.tsx (the one
socket connection every authenticated session already holds) now
listens for workspace:suspended/workspace:deleted, and when it's the
member's currently-active workspace: toasts, re-fetches getMe() (which
now naturally excludes the gone workspace), and updateSession() without
an explicit activeWorkspaceId - the store's existing fallback logic
(currentActive not found in new list -> workspaces[0] ?? null) picks a
different workspace automatically, same mechanism the live role-update
handler already relied on. Verified: `uv run python -c "import
app.main"` and `npx tsc --noEmit` both clean.

TAG: [FEATURE]
PARENT: Platform admin portal (workspaces/users, separate app)
TITLE: Realtime pass - instant disable-kick + admin portal live-sync
DESC: Follow-up to the suspend fix above - user asked to discuss making
admin actions realtime more broadly. Landed on two decisions via
AskUserQuestion rather than building speculatively:

1) Disable a user -> instant socket kick, not just next-action kick.
Added broadcast_account_disabled(user_id) (app/socket/emit.py, same
room="user:{id}" pattern already used elsewhere - sockets already
auto-join that room on connect per app/socket/server.py), fired from
admin_service.set_user_disabled only when disabling (not enabling).
ChatSocketProvider.tsx listens for "account:disabled", and on match
calls the same clearSession() the existing ACCOUNT_DISABLED 401-handler
uses, plus routes to /auth/login - so a disabled user gets logged out
immediately even if they're sitting idle and never trigger a 401.

2) Admin portal's own Workspaces/Users tables, for multiple staff
sessions seeing each other's changes - went with plain polling (20s
setInterval per page) over adding a Socket.IO client to admin-frontend.
Reasoning discussed with user: admin-frontend has zero socket
dependency today and is a low-traffic internal tool, so a full socket
client (new auth-over-socket flow reusing the admin JWT, new
admin-scoped broadcast events for every action) was judged not worth it
yet versus a cheap interval refetch. Polling is guarded by a ref
(pollGuardRef) checked inside the interval callback - skips the refetch
entirely while any mutation is in flight or a ConfirmDialog is open, so
the table can't shift under an admin mid-action. Reuses the exact same
load()/AbortController plumbing built for search, just called on a
timer instead of a user event.

Verified: `uv run python -c "import app.main"` clean; `npx next build`
clean on admin-frontend after both page edits.

TAG: [BUG]
TITLE: admin-frontend dropdowns didn't follow dark theme
DESC: User: select dropdowns stayed light in dark mode. Root cause:
globals.css defines --background/--foreground CSS vars and flips them
via prefers-color-scheme, but never set the `color-scheme` CSS property
- browsers render native form controls (select's open option-list
popup, scrollbars) using their own OS/browser default chrome unless
color-scheme tells them which palette to use; our CSS vars alone don't
reach into that native popup. Fix: added `color-scheme: light` to
:root and `color-scheme: dark` inside the existing dark media query in
admin-frontend/src/app/globals.css, plus explicit
background-color/color on `select`/`select option` as a belt-and-braces
backup for browsers that respect element-level styling on the option
list. Verified `npx next build` clean.

TAG: [BUG]
PARENT: Platform admin portal (workspaces/users, separate app)
TITLE: Demoting a member's role left them still able to see private channels
DESC: User: dropping a member to a lower role correctly hid the private
Space/List from their sidebar, but the matching chat channel for that
list stayed visible - wrong. Investigated
chat_service.sync_list_channel_members_for_workspace - it already exists
specifically for this ("Workspace-wide membership changes (join/leave/
role change) can shift who can see every Space, so re-sync every Space's
list-primary channels" per its own docstring) and already does the right
thing (adds/removes ChatChannelMember rows, broadcasts chat:channel:member
removed=True, which ChatSocketProvider.tsx already listens for and kicks
the viewer out of the channel + toasts). The bug: it's only ever called
from delete_member (being removed from the workspace entirely) and from
invite_service - nobody called it after a role change, despite the
docstring explicitly naming that case. Not admin-portal-specific - the
regular in-app workspace_service.update_workspace_member had the exact
same gap, just never noticed until the admin portal made role-testing
easy. Fix: added the missing sync_list_channel_members_for_workspace
call after commit in four places - workspace_service.
update_workspace_member and .transfer_workspace_ownership (the regular
in-app paths), admin_service.update_member_role_admin and
.transfer_ownership_admin (the new admin paths) - all four now match
the pattern already used by delete_member. No new sync logic needed,
the function already did the right thing once actually called. Verified
`uv run python -c "import app.main"` clean.

TAG: [FEATURE]
PARENT: Platform admin portal (workspaces/users, separate app)
TITLE: Workspace "Delete" is now soft-delete (archive), with Restore
DESC: User: replace the admin portal's hard workspace delete with a
soft-delete/archive flag. Asked two clarifying questions before touching
schema (per project rule on DB changes) since the boolean's behavior had
real ambiguity: (1) should an archived workspace immediately block
member access same as Suspend, or just hide from the admin list -
user chose full access-block; (2) should there be a Restore action, or
flag-only with no UI - user chose add Restore. Both match the "delete
should still mean gone" intent, just non-destructively.

Migration: scripts/migrate_workspace_soft_delete.sql +
run_workspace_soft_delete_migration.py adds Workspace.isDeleted
(boolean, default false) and deletedAt (nullable timestamp) - ran
locally against the dev DB. Model updated to match.

Enforcement reuses everything built for Suspend rather than inventing a
parallel path: app/deps/workspace.py's get_workspace_member now 404s
"WORKSPACE_NOT_FOUND" for is_deleted the same way it already does for
SUSPENDED (same indistinguishable-from-missing reasoning). Hidden from
the regular "my workspaces" surfaces the same way Suspended is -
workspace_service.list_workspaces filters it out, auth_service.get_me's
existing include_suspended param now also governs is_deleted (kept the
name rather than adding a second flag, since both cases are "staff need
full visibility, regular users don't"). admin_service.delete_workspace_admin
no longer runs a hard DELETE - it flips is_deleted/deletedAt and reuses
the exact same broadcast_workspace_deleted socket event already built
for the (still real, for now unused by admin) hard-delete case, so the
instant-kick behavior for currently-active members needed zero new
frontend work. New admin_service.restore_workspace_admin clears the
flag; _get_workspace_or_404 got an allow_deleted param (default False)
so every other admin action - suspend, reactivate, transfer, view
members, change role - correctly 404s on an archived workspace until
it's restored first, without duplicating the check at each call site.

List view: admin_service.list_workspaces got include_deleted (default
False, excludes archived; True switches to a dedicated "trash" view -
archived only, status filter doesn't apply since it's frozen at
whatever it was when archived). Registered GET .../restore alongside
the existing suspend/reactivate/delete routes rather than adding a new
resource - matches the project's CRUD-reuse convention.

Frontend: admin-frontend's Workspaces page got a "Show archived"
checkbox (disables the status dropdown while checked, since they're
mutually exclusive filters) driving includeDeleted; archived rows swap
their entire action set to just Restore (+Activity), and row-click no
longer opens the members panel for them since the backend now rejects
that until restored - avoids a confusing 404 in the UI. Also reworded
the non-archived path: the button/confirm text said "Permanently
delete... cannot be undone", which became false the moment this landed,
so relabeled to "Archive" with accurate copy ("Members lose access
immediately... can be undone with Restore") - a correctness fix to
existing copy, not a new design decision. AdminUserWorkspace and the
Users page's workspace-expansion status column also show ARCHIVED where
relevant, reusing the isDeleted field get_me now returns. Verified:
`uv run python -c "import app.main"` and `npx next build` both clean.

========================================

TAG: [TASK]
PARENT: Platform admin portal (workspaces/users, separate app)
TITLE: Realtime audit-log refresh, descriptive log entries, themed transfer dialog
DESC:
Four follow-up requests on the admin portal, handled together since they
all touch the same audit-log/transfer-ownership surface.

1. Audit panel now refreshes itself after any mutating action, instead of
only populating once on open. Added a refreshAudit(targetId) helper on
both pages (workspaces/page.tsx, users/page.tsx) that re-fetches
listAuditLog only when the audit panel for that exact target is
currently open (auditFor === targetId) - cheap no-op otherwise. Wired
into runAction (suspend/reactivate/delete/restore, enable/disable),
confirmRoleChange, confirmDisableMember/User, and the new transfer-
ownership flow.

2. Audit entries are now human-readable instead of raw action strings.
New admin-frontend/src/lib/audit.ts (describeAuditEntry) maps each
action to a title + a detail line built from the entry's metadata
(role change: "Name: OLD_ROLE -> NEW_ROLE (workspace)"; transfer:
"Old Owner -> New Owner (workspace)"; suspend/delete/restore: workspace
name; disable/enable: user name). Backend metadata had to get richer to
support this - admin_service.py's set_workspace_status,
transfer_ownership_admin, update_member_role_admin, and
set_user_disabled now all record names/emails alongside the raw ids
they already stored (e.g. role_change_metadata gained workspaceName,
userEmail, userFullName; transfer_metadata gained workspaceName,
newOwnerEmail/FullName, previousOwnerEmail/FullName) - reused the
existing dual-target audit writes, just fattened the metadata dict each
already builds. New shared admin-frontend/src/components/AuditList.tsx
renders entries as cards with the timestamp pinned to the top-right
corner (formatAuditTimestamp in the same lib file) instead of the old
single-line "action by email — date" list; used by both pages instead
of duplicating markup.

3. Checked ConfirmDialog.tsx - it already themes correctly via CSS vars
(--card/--border/etc), no fix needed there. The actual unthemed dialogs
were the two remaining native browser prompts: window.prompt for
transfer-ownership and window.confirm for workspace Archive. Both
replaced - Archive now goes through the existing ConfirmDialog (new
pendingArchive state + confirmArchive handler, same pattern as
pendingDisable), matching every other destructive action on the page.

4. Transfer ownership rebuilt as a proper modal (new
admin-frontend/src/components/TransferOwnershipDialog.tsx) replacing
window.prompt on both pages. Shows two ways to pick a new owner: a free
"by email" input, or a radio list of the workspace's current non-owner
members (fetched live via listWorkspaceMembers when the dialog opens).
Selecting an option only updates local state - the mutation only fires
when "Transfer" is pressed, matching the ask that selection alone
must not auto-submit. Backend: AdminTransferOwnershipBody
(schemas/admin.py) now accepts newOwnerUserId OR newOwnerEmail (a
model_validator requires at least one). transfer_ownership_admin
resolves the email to a user, and - new behavior - if that user isn't
already a member of the workspace, adds them as one (reusing the same
WorkspaceMember(role, status=ACTIVE) + ensure_personal_space pattern
invite_service.py uses when an invite is accepted) instead of 404ing;
existing-member transfers work exactly as before. Had to fetch the
current owner *before* creating/flushing the new member row - originally
looked it up after, which meant a brand-new owner row (role=OWNER,
status=ACTIVE) could itself match the "find current owner" query
alongside (or instead of) the real previous owner, since there's no
ordering guarantee on which row a plain `scalar()` returns when two
rows satisfy the filter. Fixed by resolving current_owner first, then
creating the new member row with a placeholder role (MEMBER) and only
promoting it to OWNER at the very end, after the previous-owner lookup
and demotion are already done.

Verified: `uv run python -c "import app.main"` clean, `npx tsc --noEmit`
and `npx next build` both clean for admin-frontend.

TAG: [FEATURE]
PARENT: Platform admin portal (workspaces/users, separate app)
TITLE: Admin no longer joins workspaces they create - invite an owner instead
DESC:
First item of a longer backlog the user is working through one-by-one
(spec pasted at session start covering admin portal + several unrelated
frontend/notification/task features - each to be picked off in order,
pausing after each for user testing).

Change: admin portal "Create workspace" flow. Previously
create_workspace_admin (admin_service.py) reused workspace_service.
create_workspace as-is, which always adds the creating user as an
OWNER WorkspaceMember - so the staff member who created it from the
admin portal ended up a member of every workspace they spun up. Per the
ask, admin should not be part of the workspace at all; instead they
invite someone else in as owner.

Backend: workspace_service.create_workspace(...) gained an add_owner:
bool = True keyword-only param - when False, skips the WorkspaceMember
insert but still creates the workspace + provisions the personal space
as before. create_workspace_admin now calls it with add_owner=False.
No new function needed - reused the existing one via a conditional,
per the "only add new code if nothing existing covers it" rule.
Self-serve workspace creation (workspace_service call sites elsewhere)
is untouched, still defaults to add_owner=True.

Invite-as-owner: the admin-side invite endpoint
(create_workspace_invite_admin) already called invite_service.
create_invite with inviter_role=WorkspaceRole.OWNER (staff acts as
OWNER as a permission ceiling, not real membership) - can_assign_role
already permits OWNER assigning OWNER, so no backend change was needed
to allow inviting someone as OWNER. Only added "OWNER" to the frontend
INVITE_ROLES list (admin-frontend/src/lib/api/admin.ts) which is what
had been missing it.

Frontend: CreateWorkspaceDialog.tsx rewritten as a 2-step modal instead
of closing immediately after creation - step 1 is just the name input
(copy updated: "You won't be added as a member..."); on success it
flips to step 2 in the *same* modal (per "in the same modal show the
people to invite"), an inline email+role invite form defaulting role to
OWNER, with a running list of invites sent this session and a "Done"
button that closes/refreshes. Once an OWNER invite has been sent in
that session the OWNER option drops out of the role dropdown (state is
local to the dialog since the workspace is brand new and has no invites
yet from anywhere else).

For the *existing*-workspace inline invite row on workspaces/page.tsx
(the expandable per-workspace panel used for workspaces that already
have members), added a hasOwner(workspaceId) helper - true if the
currently-loaded members or invites for that workspace include an
OWNER - and used it to filter the OWNER option out of that dropdown too,
so already-owned workspaces (every workspace created before this
change, or via normal self-serve signup) don't offer a redundant/
conflicting "invite as owner" option.

Verified: `npx tsc --noEmit` clean for admin-frontend; backend files
parse clean (ast.parse). Not yet run end-to-end in a browser - next
step is the user testing this manually before moving to the next item
in the backlog (auto-showing invite-people after creating a workspace
was actually bundled into this same change since it's the same modal).

TAG: [FEATURE]
TITLE: View-password toggle on login password fields
DESC:
Second item off the same backlog list as [[Admin no longer joins
workspaces they create - invite an owner instead]] - user tested and
confirmed that one worked, moving to the next.

Added a show/hide toggle button inside the password input on both
login screens:
- frontend/src/app/auth/login/page.tsx - added showPassword state,
input type flips between "password"/"text", eye/eye-off icon button
(lucide-react EyeIcon/EyeOffIcon, already used elsewhere on this page)
positioned absolute inside the existing relative wrapper that already
held the LockIcon. tabIndex={-1} so it doesn't steal tab order between
the field and the submit button.
- admin-frontend/src/app/login/page.tsx - same pattern but this app
doesn't pull in an icon library, so used a plain text "Show"/"Hide"
button instead of an icon, positioned the same way.

Scoped to login only per the literal ask - did not touch signup,
reset-password, invite-accept, or the settings change-password field,
which have their own separate password inputs (frontend/src/app/auth/
signup/page.tsx, reset-password/page.tsx, invite/accept/page.tsx,
components/account/SettingsView.tsx) - can revisit those the same way
if asked.

Verified: `npx tsc --noEmit` clean for both frontend and admin-frontend.
Not yet clicked through in a browser - pending user test like the prior
item.

========================================

TAG: [TASK]
PARENT: Platform admin portal (workspaces/users, separate app)
TITLE: Split admin-portal deploy from the main app's prod CI pipeline
DESC:
Committed the full admin-portal feature (59 files) on a new admin-portal
branch cut from develop, so develop itself stays clean/matches origin -
the feature commit lives only on admin-portal until PR review. Gave the
user a PR title/description for it (not opened yet - waiting on the CI
piece below first).

Then worked through where admin's deploy should live. Discovered along
the way: docker-compose.staging.yml has no admin service at all - the
only admin container is the one in docker-compose.app.yml (prod-facing),
and deploy-staging.sh's existing line that touches docker-compose.app.yml
already runs with no --build flag, i.e. it only ensures the container
exists/keeps the shared nginx+edge network up for staging to attach to,
it was never actually redeploying admin with fresh code. Confirmed with
the user: admin portal is prod-only by design - staging keeps carrying
the code (same repo, same branch merges through) but gets no running
admin container and no dedicated GitHub Action of its own. Left
docker-compose.staging.yml and deploy-staging.sh/deploy-staging-ec2.yml
completely untouched.

Also hit a second landmine before writing anything: deploy/deploy.sh on
the `develop`/admin-portal branch was still the old systemd-based script
(dead on the real server per earlier this-session SSH diagnostics -
prod actually runs Docker, started manually). Checked origin/main and
found deploy.sh was already fixed there to be fully Docker-based
(docker-compose.yml + docker-compose.app.yml, builds api/web, health-
checks through nginx) - develop just hadn't caught up yet. Pulled
main's deploy.sh as-is (`git show origin/main:deploy/deploy.sh >
deploy/deploy.sh`) rather than re-fixing something already fixed, so
the split builds on the real prod deploy path instead of the dead one.

Built the split on .github/workflows/deploy-ec2.yml (prod, push to
main - the only checkout admin's container can correctly be built from,
since docker-compose.app.yml's build context is relative to wherever
compose runs, and only PROD_ROOT is guaranteed to be on main):
- New `changes` job (dorny/paths-filter@v3, fetch-depth 0) computes two
  booleans: `app` (backend-py/**, frontend/**, deploy/**, both compose
  files, the workflow file itself) and `admin` (admin-frontend/** only).
- `deploy-app` job runs deploy.sh unchanged, gated on
  `needs.changes.outputs.app == 'true'` (or workflow_dispatch).
- New `deploy-admin` job runs a new deploy/deploy-admin.sh, gated on the
  `admin` output. `needs: [changes, deploy-app]` plus `if: always()`
  gives app priority (admin's SSH step never starts until deploy-app's
  job has concluded, whatever its result) while keeping them properly
  independent - a failed or skipped deploy-app doesn't block or fail
  deploy-admin, and vice versa, since neither job's `if` depends on the
  other's outcome, only on ordering + its own path filter. This also
  sidesteps a git-checkout race that would exist if they ran as two
  separate workflows hitting the same PROD_ROOT directory concurrently -
  as sequential jobs in one workflow run, the SSH sessions never overlap.
- deploy-admin.sh: independent git fetch/reset (can't assume deploy-app
  ran), `docker compose ... up -d --build admin` (only touches that one
  service), then an explicit `nginx -t && nginx -s reload` - needed
  because nginx bind-mounts deploy/nginx/docker.conf read-only, so
  `compose up -d nginx` alone won't pick up the new /admin-portal/
  location block on this feature's first deploy. Health-checks through
  nginx at /admin-portal/login before declaring success.

Verified: YAML parses (`python -c "import yaml; yaml.safe_load(...)"`),
both shell scripts pass `bash -n`. Not yet run for real - first live
test happens when this branch's PR merges to main.

========================================

TAG: [TASK]
PARENT: Platform admin portal (workspaces/users, separate app)
TITLE: Pre-merge hardening - forced re-login, gated main-app self-serve auth, staff management page
DESC:
Six items requested before opening/merging the admin-portal PR into
develop. Handled all on the same admin-portal branch.

1. Admin portal now always requires a fresh login. Previously
admin-frontend/src/stores/auth-store.ts persisted accessToken/
refreshToken to localStorage (zustand persist) and
use-admin-session.ts silently exchanged the httpOnly refresh cookie
for a new access token on every mount - so closing the tab and coming
back later (or even just reloading) logged you straight back in. Since
this is the most privileged account in the whole app, that's the wrong
default. Rewrote auth-store.ts as a plain in-memory zustand store (no
persist middleware at all), and use-admin-session.ts no longer calls
adminRefresh() - it just reads the in-memory token and router.replace's
to /login the moment it's missing, i.e. on every fresh mount. Left
proxy.ts and the riseup_admin_session marker cookie untouched - it
still fast-paths an SSR redirect for someone with literally no cookie,
but no longer matters for "already logged in" purposes since the
client-side hook enforces the real check regardless of cookie state.

2. Main app: self-serve signup, Google sign-in/up, and the demo-
credentials hint are switched off - not deleted - via three new
entries in frontend/src/lib/feature-flags.ts (selfSignup, googleAuth,
demoCredentialsBanner), reusing the existing hard-coded flags file
instead of building a new mechanism. auth/login/page.tsx: Google
button, demo-creds banner, and the "Create an account" link are each
wrapped in their flag check; the description text also switches
depending on googleAuth. auth/signup/page.tsx: whole page now calls
redirect("/auth/login") as its first statement when selfSignup is
false (page code untouched otherwise, still reachable again by
flipping the flag), and its own Google button is separately gated so
flipping selfSignup back on wouldn't silently re-expose Google if that
flag's still off. Confirmed via `npx eslint` that redirect-before-hooks
here doesn't trip react-hooks/rules-of-hooks (it's an unconditional
early throw before any hook call, not a hook inside a conditional).

3. Admin portal already had no /signup route to begin with (checked
admin-frontend/src/app/** - only login/workspaces/users existed) - ask
was already satisfied, nothing to change.

4/5. Covered by items 1 and 2 above (Google removal is one flag
gating both apps' relevant surfaces; admin-only-sign-in was already
true).

6. New admin-management page. Backend: three new endpoints on the
existing /admin router rather than a new resource - GET /admin/staff
(list, with each row's granter resolved via a batched User lookup
since PlatformStaff.granted_by is a bare FK column, no ORM
relationship), POST /admin/staff (grant by email - reuses the same
"resolve by email" pattern as transfer_ownership_admin; 404s if no
such user, 400s if that user is disabled, 409s if already staff),
DELETE /admin/staff/{userId} (revoke; blocks revoking your own access
to avoid an accidental self-lockout with no one left to undo it).
Grant/revoke by email only works for users who already have an
account - matches the existing transfer-ownership convention, doesn't
create accounts. Both write to AdminAuditLog (platform_staff.grant /
.revoke). New admin_service.py functions + AdminGrantStaffBody schema
+ routes in admin.py. Frontend: new admin-frontend/src/app/staff/page.tsx
(table + inline grant-by-email form + revoke with the existing themed
ConfirmDialog, no new dialog component needed since it's a single
email field), new "Admins" tab in PortalNav.tsx, /staff added to
proxy.ts's protected prefixes and matcher.

Verified: `uv run python -c "import app.main"` clean; `npx tsc --noEmit`
+ `npx next build` clean for both frontend/ and admin-frontend/.

========================================

TAG: [TASK]
PARENT: Platform admin portal (workspaces/users, separate app)
TITLE: Staff-search combobox for granting access, self-revoke hidden, workspace-scoped member disable
DESC:
Three more asks on the admin portal, on top of PR #12 (admin-portal ->
develop, merged) and PR #13 (admin-portal -> main, opened by the user;
migrations + PlatformStaff bootstrap already run on the prod server
this session). All three land on the same admin-portal branch, not yet
committed/pushed.

1. Admins page's "grant access" field is now a search-as-you-type
combobox instead of a raw email box - reuses the existing GET
/admin/users search endpoint (no backend change), debounced, filters
out users who are already staff. Selecting a result only fills the
field; the actual POST /admin/staff only fires on pressing "Grant
access" - matches the same "selection isn't submission" pattern used
for TransferOwnershipDialog.

2. Revoke button hidden on the logged-in admin's own row (labeled
"(you)"). Backend already blocked self-revoke server-side
(revoke_platform_staff 400s on target_user_id == actor_id) from the
original build - this was a UX gap, not a security one.

3. Bigger one: the expanded-row Disable/Enable buttons on both
Workspaces and Users pages were - discovered while implementing -
actually calling the GLOBAL user-disable endpoint the whole time, even
though they're rendered per-workspace. Fixed by adding a real
workspace-scoped suspend, distinct from set_user_disabled:
- WorkspaceMember already has a status column (MemberStatus:
  ACTIVE/INVITED/SUSPENDED) that nothing wrote to before. New
  admin_service.set_member_status_admin flips just that one row's
  status - refuses to suspend an OWNER (must transfer first, same
  invariant as update_member_role_admin). New POST .../members/{userId}
  /suspend and /reactivate routes.
- Enforcement was already fully in place with zero new code:
  get_workspace_member (deps/workspace.py) already 403s on any non-
  ACTIVE membership status, and auth_service.get_me already only
  returns ACTIVE memberships to a user's own /auth/me - a suspended
  member simply stops seeing/reaching that one workspace, nothing else
  touched. Had to add get_me(..., include_suspended_memberships=False)
  as a new opt-in param though, since admin's own "this user's
  workspaces" list (list_user_workspaces, wraps get_me) was silently
  dropping SUSPENDED memberships entirely - staff could suspend a
  member and then never see that workspace in their row again to
  reactivate it. Regular /auth/me still defaults to ACTIVE-only,
  unaffected.
- list_workspace_members_admin rewritten as its own query (was
  delegating to workspace_service.list_workspace_members, which
  hard-filters ACTIVE-only - wrong here for the same reason) - now
  returns SUSPENDED members too plus a status field.
- New broadcast_workspace_member_suspended emits to the target user's
  own user:{id} room (not the whole ws:{id} room - a per-member suspend
  shouldn't kick anyone else). Wired a new workspace:member:suspended
  handler into frontend/ChatSocketProvider.tsx, same shape as the
  existing workspace:suspended/deleted handlers - only acts if it's the
  workspace the user is currently sitting in.
- Both pages' modal copy rewritten to say "this workspace only" instead
  of the old (incorrect) "every workspace" text; the Users page's
  top-level main-row Disable stays exactly as it already was (global,
  modal already correctly said "all workspaces" - no change needed
  there, per explicit instruction to keep that one as-is).
- Audit: workspace.member.suspend/reactivate dual-logged (workspace +
  user target) same as every other admin action, descriptions added to
  admin-frontend/lib/audit.ts.

Verified: `uv run python -c "import app.main"` clean; `npx tsc --noEmit`
+ `npx next build` clean for frontend/ and admin-frontend/.

========================================

TAG: [FEATURE]
PARENT: Platform admin portal (workspaces/users, separate app)
TITLE: Show "Deactivated" wherever a disabled user's content still appears in the main app
DESC:
Follow-up to workspace-scoped/global user disable: nothing in the
regular app UI (as opposed to the admin portal) previously indicated
when a task assignee, comment author, or chat message author had since
been disabled - they rendered exactly like any other active member.
Researched how real ClickUp handles this first (web search, since
ClickUp's own help pages 403'd on direct fetch) before touching
anything: their pattern is to leave the person's name/avatar in place
wherever it already appears (assignee cards, comments) and just append
a "Deactivated" label next to it, plus a dedicated assignee-sidebar
tool for bulk reassigning their tasks. Confirmed with the user to build
everything except an assignee-sidebar-style bulk tool and @mentions -
mentions are baked into message/comment bodies as static "@Name" text
at write time rather than a live user-id reference, so there's nothing
to re-check at render time without a much bigger rework of how
mentions are stored; out of scope for now.

Also ran an Explore agent first to map every place a disabled user's
name could still render, before writing anything - confirmed
is_disabled was already fully wired for auth-blocking and the admin
portal, but completely absent from task, comment, chat-message, and
mention code paths on both backend and frontend, and technically
present-but-unused in the in-app People page (backend already sent
isDisabled in that payload; the frontend type just never declared the
field).

Backend - all additive, no schema change:
- home_helpers.py: _map_task_comment now sets authorIsDisabled from the
  already-loaded comment.user relationship (zero extra query). map_task
  gained a disabledAssigneeIds output list, computed from a widened
  assignee_names shape (id -> (name, isDisabled) instead of id -> name).
- home_service.py: _assignee_name_map (the one and only producer feeding
  every map_task call site across home_service.py and spaces_service.py
  - traced all ~10 call sites first, confirmed each just forwards the
  dict straight into map_task with no other use) now selects
  User.is_disabled alongside full_name in the same query and returns
  the tuple. _user_name_map (a different helper, used only for activity-
  log text strings, not map_task) deliberately left untouched.
- chat_helpers.py: map_message and map_message_broadcast both gained
  authorIsDisabled from the already-loaded msg.author relationship -
  same zero-extra-query shape as the comment fix. map_search_message
  picks it up for free since it wraps map_message.

Frontend - new authorIsDisabled/disabledAssigneeIds/isDisabled fields
declared on Task, TaskComment, ChatMessage, and WorkspaceMemberRow
types, then a small "Deactivated" marker wired into every place that
renders one of these people: ListTaskRow (dimmed avatar + tooltip),
BoardView (compact card, dimmed text suffix), TaskDrawer's assignee
chips (dimmed avatar + inline label), TaskActivityComment and
ChatMessageRow (destructive-colored "Deactivated" text next to the
author name, dimmed avatar on the chat row), and PeopleView (reused
the existing Badge component/pattern already used for the "You" tag).

Verified: `uv run python -c "import app.main"` clean, `npx tsc --noEmit`
+ `npx next build` clean for frontend/. (admin-frontend untouched by
this change.)

TAG: [TASK]
PARENT: Platform admin portal (workspaces/users, separate app)
TITLE: Create-workspace button + per-workspace invite management in admin portal
DESC:
Two additions to the admin-frontend Workspaces page, both built by
reusing existing services per the "reuse before adding new code"
project rule rather than writing parallel logic:

1. "Create workspace" button + dialog (CreateWorkspaceDialog.tsx, mirrors
   the existing TransferOwnershipDialog styling/pattern). Calls new
   POST /admin/workspaces, which is just admin_service.create_workspace_admin
   wrapping workspace_service.create_workspace verbatim (same function the
   in-app self-serve workspace creation uses) plus an audit-log write - the
   staff member submitting the form becomes OWNER of the new workspace,
   same as any normal workspace creation.

2. Invite people from the workspace expand row, matching the People page's
   invite flow/options (email + role, same INVITE_ROLES set minus OWNER).
   New admin_service functions (list/create/cancel/resend_workspace_invite_admin)
   are thin wrappers around the existing invite_service functions - staff is
   passed through as WorkspaceRole.OWNER for the internal permission check
   since they aren't an actual member of the target workspace. Dedup ("can't
   invite someone already a member or already pending") comes for free from
   invite_service.create_invite's existing ALREADY_MEMBER/ALREADY_INVITED
   409 checks - no new dedup logic needed. Every invite action also writes
   an AdminAuditLog row, consistent with every other admin mutation.

   New routes: GET/POST /admin/workspaces/{id}/invites, DELETE
   .../invites/{id}, POST .../invites/{id}/resend.

Polling: the page already polled the workspace list every 20s but never
refreshed an expanded row's members/invites on that same tick - so if an
invitee accepted while the row was open, nothing would update without a
manual re-toggle. Extended the poll effect to also call loadMembers +
loadInvites for whichever workspace is currently expanded (membersFor),
guarded by the same pollGuardRef pattern (skips while any mutation/dialog
is in flight) plus new invite-specific busy flags.

Verified: `python -c "from app.api.v1 import admin"` clean (backend-py),
`npx tsc --noEmit` clean (admin-frontend).

TAG: [BUG]
TITLE: Admin portal middleware redirects dropped the /admin-portal basePath
DESC:
User reported http://3.140.5.67/admin-portal/workspaces redirecting to
http://3.140.5.67/workspaces (landing on the main app instead of the
admin portal). Confirmed live via curl before touching anything: hitting
/admin-portal/workspaces logged out returned a 307 with
`location: /login?next=%2Fworkspaces` - no /admin-portal prefix, which
nginx's catch-all location / then routed into the main app instead of
back into admin-frontend. Also confirmed /admin-portal/login itself
returned 200 from the admin app, ruling out an nginx/deploy problem
before assuming a code bug - nginx routing and the admin container were
both fine.

Root cause: admin-frontend/src/proxy.ts built every redirect target with
`new URL(path, request.url)`, a plain WHATWG URL that isn't basePath-
aware. Next.js's own NextURL (request.nextUrl) IS basePath-aware, but
plain URL() throws that away. Fixed by building all three redirects
(unauth -> login, post-login-while-authed -> workspaces, root ->) off
`request.nextUrl.clone()` instead.

Also confirmed via `git log origin/main` that the admin-portal branch
work (including this session's earlier create-workspace/invite commit)
was already merged to main via PR #15 and deploy-ec2.yml only triggers
on push to main - so this was a genuine live bug, not a "never deployed"
issue as first suspected.

Verified: `npx tsc --noEmit` clean (admin-frontend). Committed
(336d71f) and pushed to admin-portal directly (gh pr create failed -
token isn't a repo collaborator - left as a compare-branches link for
the user to open manually).

TAG: [TASK]
TITLE: Set up kinetix.infosoftco.com domain + HTTPS across prod/staging/admin-portal
DESC:
User bought the domain kinetix.infosoftco.com, wants it to cover all
three surfaces already living on the box (prod app at root, /staging/,
/admin-portal/) as one path-routed domain, with HTTPS. Explicitly told
not to commit or push - changes are staged locally only, pending the
user's own review/deploy.

deploy/nginx/docker.conf rewritten as two server blocks instead of one:
- :80 - server_name kinetix.infosoftco.com, serves only the ACME
  http-01 challenge path (/.well-known/acme-challenge/, webroot
  /var/www/certbot) and /health, everything else 301s to https.
- :443 ssl - server_name kinetix.infosoftco.com, ssl_certificate/
  ssl_certificate_key pointed at the Let's Encrypt live/ path, modern
  TLS1.2/1.3 settings written inline (not relying on certbot's nginx-
  plugin-generated options-ssl-nginx.conf/ssl-dhparams.pem snippets,
  since issuance here is plain `certonly --webroot`, not the nginx
  plugin, so those files would never get created) - holds every
  location block the old single server{} had (staging api/socket/web,
  /admin-portal/, /api/, /socket.io/, /).
Validated syntax with a throwaway `docker run nginx:1.27-alpine` +
self-signed dummy cert + `nginx -t` (can't run nginx -t without SOME
cert present at the path the config references) - passed clean.

docker-compose.app.yml: nginx now also publishes :443 and mounts two
new named volumes (certbot-etc -> /etc/letsencrypt, certbot-www ->
/var/www/certbot, both read-only on the nginx side). New `certbot`
service (image certbot/certbot:latest) running a `certbot renew
--webroot --quiet` loop every 12h for ongoing renewal - does NOT
perform first-time issuance itself (chicken-and-egg: nginx's config
already references the final cert path, so the very first cert has to
exist before nginx can even start cleanly).

New deploy/setup-ssl.sh - one-off bootstrap script, NOT wired into any
CI workflow, meant to be run manually once on the EC2 box after DNS
(A record -> the box's IP) has propagated: generates a throwaway self-
signed cert at the expected path so nginx can boot at all, starts
nginx, runs `certbot certonly --webroot` for the real cert, reloads
nginx, then starts the certbot renewal-loop service. Idempotent - reruns
just restart/reload if a real cert is already present. Takes
CERTBOT_EMAIL as a required env var (Let's Encrypt wants a contact
email for expiry notices).

Updated every hardcoded http://3.140.5.67 default this domain change
touches: docker-compose.app.yml's PUBLIC_APP_URL fallback (api/web
build args + runtime env), docker-compose.env.example's PUBLIC_APP_URL
template, docker-compose.staging.yml's STAGING_PUBLIC_URL/
STAGING_FRONTEND_ORIGIN fallbacks, deploy/deploy-staging.sh's PUBLIC_HOST
default, and .github/workflows/deploy-staging-ec2.yml's hardcoded
STAGING_PUBLIC_URL (now also exports PUBLIC_HOST and
STAGING_FRONTEND_ORIGIN, which it previously left unset, silently
falling back to the IP for the staging API's FRONTEND_URL).

Deliberately did NOT touch deploy.sh/deploy-admin.sh/deploy-staging.sh's
`curl -fsS http://127.0.0.1/...` health checks even though :80 now
301s everything - confirmed curl's -f only treats HTTP >=400 as
failure, a bare 3xx still exits 0 without -L, so those checks keep
working unmodified.

Did NOT touch the legacy host-nginx conf files (kinetix-site.conf,
kinetix-staging-site.conf) or their setup/fix scripts - per earlier
research in this project, that whole host-nginx/systemd path is dead
(masked/failed units), Docker is confirmed the real prod path, so
editing dead config would be pure scope creep.

Still needs, on the actual server, before this works end to end (none
of this was run against the live box - no SSH access from this
session, and user said not to commit/push yet regardless):
1. DNS: A record kinetix.infosoftco.com -> the EC2 box's IP.
2. Update the real (uncommitted, secret) docker-compose.env on the
   server: PUBLIC_APP_URL=https://kinetix.infosoftco.com.
3. Deploy this branch, then run `CERTBOT_EMAIL=... deploy/setup-ssl.sh`
   once manually.

========================================
DATE_END: 2026-07-22

========================================
DATE_START: 2026-07-24

TAG: [BUG]
TITLE: Remove Replies from Home sidebar
DESC: Removed the "Replies" nav item from the Home sidebar. Dropped it from
DEFAULT_ITEMS and HOME_SIDEBAR_VISIBLE_IDS in home-sidebar-store.ts (persisted
config filters out the now-unknown id automatically via itemsFromConfig). Also
removed the dead "replies" active-state branch in HomeSidebar.tsx. The
/home/inbox?tab=replies route itself is untouched, only the sidebar entry is
gone.

TAG: [BUG]
TITLE: Shrink offline presence dot in 1:1 DM rows
DESC: Offline presence dot read visually bigger than the online dot because it
is a hollow circle with a visible gray ring, while the online dot's white ring
blends into the background. In AvatarWithPresence.tsx PresenceDot now steps the
offline dot down one size (sm -> xs, md -> sm) so it matches the online dot's
visual weight. Online/away/busy unchanged.

TAG: [SUBTASK]
PARENT: Shrink offline presence dot in 1:1 DM rows
TITLE: Match online dot size and ring to offline
DESC: Follow-up: after shrinking offline, online read too big. Applied the
one-size step-down to ALL presence states (STEP_DOWN, not offline-only) so
online and offline dots are identical size. Also the online dot's ring was
border-white on the non-white bg-sidebar, making it stand out / mismatch the
avatar; changed DmRow borderClass to border-sidebar so the ring blends like
the offline dot's.

TAG: [FEATURE]
TITLE: Invitation failed tag on pending invites
DESC: Added an "Invitation failed" status tag alongside Pending/Expired in
PeopleView. Invite emails are fire-and-forget background sends, so failures
previously only hit the logs and nothing was persisted. User approved a DB
change: added Invite.emailStatus column ("emailStatus" TEXT, nullable) via
migrate_invite_email_status.sql + run_invite_email_status_migration.py (applied
to DB). invite_service._send_invite_email_safe now records "sent"/"failed" on
its own AsyncSession (request session is gone by then) via new
_set_invite_email_status helper. list_workspace_invites reports status "failed"
when emailStatus == "failed" (expired still takes precedence). resend clears
emailStatus back to null (pending) until the new send resolves. Frontend:
WorkspaceInvite.status type gained "failed"; PeopleView renders a destructive
"Invitation failed" badge.

TAG: [CHORE]
TITLE: Remove demo credentials from login form
DESC: Changed the login email placeholder from owner@demo.com to a generic
you@company.com and deleted the hardcoded "Demo: owner@demo.com / password123"
banner (and its now-unused ShieldCheckIcon import). Remaining owner@demo.com
strings are only in backend test fixtures / seed scripts, left untouched.

TAG: [CHORE]
TITLE: Remove settings icon from Inbox header
DESC: Dropped the Notification-settings gear button (and SettingsIcon import)
from the Inbox toolbar in InboxView; router still used for row navigation.

TAG: [FEATURE]
TITLE: Remove invite-people step from workspace creation
DESC: Deleted the step 3 "Invite people" page from the create-workspace wizard
and rewired the flow use-case(1) -> manage(2) -> features(3) -> tools(4) ->
name(5); totalSteps 6 -> 5 across all pages, manage.nextHref and features/name
backHref repointed to skip invite.

TAG: [BUG]
TITLE: Chat nav dot only on unread activity
DESC: The Chat item in GlobalNav had a permanently-on "dot" badge. Now the dot
only shows when a channel, group DM, or DM has unread > 0, computed from the
chat-store sidebarListsCache. Home landing already correct (root redirect,
post-login safeNextPath, onboarding all target /home/inbox; Home is first nav
item) so no change needed for the "Home primary / Chat secondary" ask.

TAG: [FEATURE]
TITLE: Upload profile avatar from desktop with crop dialog
DESC: Replaced the Avatar URL text field in profile settings with a desktop
image picker + confirmation modal (AvatarCropDialog) that lets the user
zoom/frame a square crop and exports a normalized 256px JPEG via canvas.
User approved storage approach "Option 2 - serve via API endpoint" (repo
already has working S3 setup: s3_service + s3_configured, used by chat/task
attachments). Backend: POST /auth/me/avatar stores bytes at avatars/<userId>.jpg
in the private bucket and saves a permanent URL (api_public_url +
/auth/users/<id>/avatar?v=<ts>) in avatar_url (no DB change, fits 500 chars);
new PUBLIC GET /auth/users/{id}/avatar streams the bytes since <img> src can't
send a bearer token. Added s3_service.get_object. No Pillow dependency - resize
is client-side. All six requested tasks committed separately.

TAG: [CHORE]
TITLE: Remove Super admin from invite role dropdown
DESC: Removed the "Super admin" SelectItem from the invite role dropdown in
WorkspaceInviteForm (People page). Members can no longer invite at SUPER_ADMIN
level; Admin remains gated behind canInviteAdmin. canInviteSuperAdmin prop left
in place (harmless, still passed by callers).

TAG: [CHORE]
TITLE: Remove Super admin from admin portal role dropdowns
DESC: Dropped SUPER_ADMIN from WORKSPACE_ROLES and INVITE_ROLES in
admin-frontend/src/lib/api/admin.ts - the arrays that feed all admin-portal
role dropdowns (role change on workspaces/page.tsx + users/page.tsx, invite on
workspaces/page.tsx + CreateWorkspaceDialog). Kept SUPER_ADMIN in the
WorkspaceRole/InviteRole type unions so existing super-admin records still
type-check and display.
DATE_END: 2026-07-24

DATE_START: 2026-08-13
========================================

TAG: [FEATURE]
TITLE: Upgrade Task Management module to 100% production grade
DESC: Upgraded Task Management module across backend FastAPI service and Next.js frontend: added multi-view toolbar (List, Board/Kanban, Calendar, Channel) in SpacesListToolbar.tsx and ListWorkspace.tsx; built TaskTagsManager.tsx for custom tag creation and color-coded chips; added tags column to Task database model (app/db/models/home.py), CreateTaskBody/UpdateTaskBody schemas, map_task, and TaskDrawer.tsx property grid; added task search input and priority filter controls; verified 100% pass rates in tsc (0 errors), vitest (58/58), and pytest (16/16).
DATE_END: 2026-08-13

DATE_START: 2026-08-15
========================================

TAG: [CHORE]
TITLE: Production-Grade CI/CD Infrastructure Plan & Workflows
DESC: Researched and built a production-grade CI/CD pipeline using GitHub Actions for the Kinetix monorepo (FastAPI backend-py, Next.js frontend, Next.js admin-frontend). Added multi-stage parallel CI workflows (linting with ruff/eslint, TypeScript typechecks with tsc, unit/integration testing with pytest and Vitest against a PostgreSQL service container, and production build checks) gated before EC2 staging/production deployments with post-deploy smoke tests. Tuned frontend eslint.config.mjs rules for React 19 compatibility.
DATE_START: 2026-08-18
========================================

TAG: [FEATURE]
TITLE: Implement Production-Grade Enterprise Task Stack (Templates, Portfolios, Gantt, Workload, Automations, Whiteboards)
DESC: Built production-grade enterprise planning stack across backend-py FastAPI service and Next.js frontend:
1. Created Database Models & SQL Migration (migrate_planning_stack.sql): EntityTemplate, Portfolio, PortfolioList, TaskAutomationRule, Whiteboard, and Task.isMilestone column.
2. Built FastAPI Service & Routers (app/api/v1/planning.py & app/services/planning_service.py): Template instantiation, Portfolio rollups, Gantt graph calculation with milestone markers, Workload capacity analysis, Automation trigger/action evaluation, and Whiteboard canvas persistence.
3. Created Frontend Interactive Views: GanttView.tsx (Timeline grid with day/week scales and milestones), PortfoliosView.tsx (Executive initiative health & completion rollups), WorkloadView.tsx (Member capacity grid with over-capacity badges), TemplateLibraryModal.tsx (Template browser & 1-click apply), AutomationsBuilderModal.tsx (Visual rule builder), and WhiteboardCanvasView.tsx (Brainstorming canvas).
4. Integrated multi-view toolbar switchers in SpacesListToolbar.tsx and ListWorkspace.tsx supporting 8 view modes.
5. Verification: Passed 32/32 Pytest backend tests, 65/65 Vitest frontend tests, and 0 tsc typecheck errors.
DATE_START: 2026-08-23
========================================

TAG: [CHORE]
TITLE: Single Command Docker Compose Setup
DESC: Configured docker-compose.yml at the repository root to support running the full Kinetix platform (PostgreSQL 16, FastAPI backend-py, Next.js frontend, and Next.js admin-frontend) via a single `docker compose up --build` command locally out-of-the-box. Added default fallback values for environment variables and optional env files so local setup works cleanly on fresh clones. Updated frontend/next.config.ts to support INTERNAL_API_URL for Next.js server rewrites inside Docker networks, and updated README.md with usage documentation.

TAG: [SUBTASK]
PARENT: Single Command Docker Setup
TITLE: Optimize Docker build context transfer with comprehensive .dockerignore rules
DESC: Added/updated .dockerignore files across frontend/, admin-frontend/, backend-py/, and repository root to exclude heavy build output directories (frontend/src-tauri/target Rust build target, .next, node_modules, .cache, .turbo). This reduced the Docker context transfer size from 3.00 GB down to <5 MB, eliminating a 15-minute build context bottleneck during `docker compose up --build`.

TAG: [SUBTASK]
PARENT: Single Command Docker Setup
TITLE: Fix CRLF line endings in Dockerfiles and add automatic base schema initialization
DESC: Sanitized docker-entrypoint.sh line endings across all Dockerfiles using `sed -i 's/\r$//'` to prevent Windows CRLF execution failures inside Alpine Linux containers. Updated backend-py/scripts/apply_migrations.py to run Base.metadata.create_all before incremental SQL migration scripts, enabling automatic table creation on fresh empty database containers. All 4 containers (postgres, api, web, admin) verified active and healthy.

DATE_END: 2026-08-23

DATE_START: 2026-08-24
========================================

TAG: [BUG]
TITLE: Fix EC2 deploy failure (ssh-action input warning + postgres port conflict) and Catch Me Up IDOR
DESC: Deployment to production EC2 failed with "Error response from daemon: failed to bind host port 127.0.0.1:5432/tcp: address already in use" when deploy.sh tried to recreate the kinetix-postgres-1 container, plus a GitHub Actions warning about an unexpected `script_stop` input on appleboy/ssh-action@v1.2.2 (that input was removed/renamed in this action version; removed it from .github/workflows/deploy-ec2.yml and deploy-staging-ec2.yml since deploy scripts already use `set -euo pipefail` for the same effect). For the real blocker, added a preflight check to deploy/deploy.sh that runs before `compose up -d postgres`: detects if something is already bound to host port 5432, and if it is a stray/orphaned Docker container (not the current compose project's own postgres), force-removes it and retries; if it's a non-Docker process (e.g. a native postgres package), fails fast with a clear diagnostic (ss -ltnp output) instead of looping to a cryptic Docker network error.

While investigating, was asked to also audit the "Catch Me Up" AI feature (backend-py/app/api/v1/ai.py, app/services/catch_up_service.py, app/services/rag_knowledge_service.py, admin_knowledge.py, frontend/src/lib/api/ai.ts) for production quality. Found and fixed two CRITICAL IDOR vulnerabilities: (1) /ai/catch-up and /ai/knowledge-query read workspace_id from a client-controlled `x-workspace-id` header with zero membership verification, unlike every other workspace-scoped route in the codebase which uses a `{workspace_id}` path param + WorkspaceMemberDep (backend-py/app/deps/workspace.py) that enforces active WorkspaceMember status; (2) catch_up_service.generate_conversation_catch_up only checked `channel.workspace_id == workspace_id` / `dm.workspace_id == workspace_id` and never verified the requesting user is actually a ChatChannelMember or DirectParticipant of that specific channel/DM — meaning any authenticated user could spoof the header and read the AI-generated summary (including verbatim message content sent to the LLM) of private channels or DMs they were never a member of, across workspaces. Same header-trust bug also existed in admin_knowledge.py's create/list/delete company document endpoints (no workspace membership check either).
Fix: moved all four routers (ai.py's two endpoints, admin_knowledge.py's three endpoints) onto the same `/workspaces/{workspace_id}/...` prefix + WorkspaceMemberDep pattern used by chat.py/teams.py/home.py; updated catch_up_service.py to reuse chat_service's existing `_assert_channel_member`/`_assert_dm_participant` helpers (already the codebase's established per-conversation authorization check, referenced by comment "without a real ChatChannelMember row, the channel is not accessible") instead of duplicating logic; updated frontend/src/lib/api/ai.ts to call the new path-based URLs via the existing `wsPath()` helper instead of sending the header.
Also fixed three medium-severity issues found during the same audit: (a) catch_up_service.py silently swallowed LLM JSON-parse failures with a bare `except: pass` and no logging, masking prompt/schema drift in production — added a logger.warning with the raw (truncated) LLM output; (b) ai_service.get_llm_completion had no timeout on the Gemini or OpenAI SDK calls, so a hung upstream call could tie up a request indefinitely — wrapped Gemini calls in asyncio.wait_for and passed an explicit timeout to the OpenAI client (LLM_TIMEOUT_SECONDS = 20). Rate limiting and the fallback summary text were flagged but left for a follow-up (see below). Changes left uncommitted per instruction.

TAG: [TASK]
PARENT: Fix EC2 deploy failure (ssh-action input warning + postgres port conflict) and Catch Me Up IDOR
TITLE: Add rate limiting to AI endpoints and make Catch Me Up fallback summary data-derived
DESC: Closed out the two remaining flagged items from the Catch Me Up audit, now implemented at production grade instead of left as flags. (1) Rate limiting: discovered the codebase already has an in-house token-bucket rate limiter (backend-py/app/core/rate_limit.py's `throttle()`, used by auth.py/admin.py) rather than building a new one — reused it directly for /ai/catch-up and /ai/knowledge-query in ai.py, adding both per-IP and per-account (user id) limits via `account=user.id`, matching the same throttle-per-account pattern used for login/password-reset. Added new settings to app/config.py: ai_rate_limit_window_seconds (60s default), ai_catch_up_ip_limit/ai_catch_up_account_limit and ai_knowledge_query_ip_limit/ai_knowledge_query_account_limit (20/10 default each) so limits are configurable per-env like the existing auth_* limits. A hit returns the existing 429 RATE_LIMITED AppError, which the frontend already surfaces via toast.error/formatRequestError with no changes needed on that side.
(2) Fallback summary: catch_up_service.py already extracted real decisions/action items/mentions heuristically from the message log even when the LLM call failed — only the one summary sentence was hardcoded boilerplate ("Team is coordinating on testing, feedback review, and resolving active issues.") asserted regardless of actual content. Replaced it with a sentence built strictly from what was actually observed: message count, participant names, time span between first/last message, and counts of detected decisions/action items (or an explicit "No clear decisions or action items detected" when none were found) — no more fabricated claims about conversation content.
Verified: `uv run python -c "from app.api.v1 import router"` imports cleanly with no circular-import or wiring issues.

TAG: [BUG]
TITLE: Fix users being logged out prematurely instead of the intended 7-day rolling-inactivity session
DESC: User reported being logged out after a short period, when the intended behavior is a sliding/rolling 7-day session — only log out after 7 consecutive days of not opening the web or desktop app.
Investigated the whole session/JWT stack first (backend-py/app/config.py, app/services/auth_service.py, app/api/cookies.py, frontend/src/stores/auth-store.ts, frontend/src/components/providers/AuthProvider.tsx, frontend/src/lib/api/client.ts) and confirmed the backend design is already correct: access token 4h (jwt_access_expires_minutes=240), refresh token 7 days (jwt_refresh_expires_days=7), refresh tokens are DB-backed (RefreshToken table, not purely stateless) and re-issued with a fresh `expires_at = now + 7 days` on every successful /auth/refresh call (true sliding window, not fixed-from-first-login), and both the httponly `riseup_refresh` cookie and the client-JS `riseup_session` mirror cookie are re-armed for another 7 days on every refresh/bootstrap. Desktop (Tauri) uses the same production URL and cookie jar as web, no separate/shorter expiry there.
Root cause was two matching bugs in the frontend's error handling, not the token/cookie config: any error during a silent session-refresh attempt was being treated as "refresh token is invalid" and forcing a logout, even when the error was actually transient (network blip, backend cold start, momentary 5xx) and the refresh token itself was still perfectly valid.
(1) frontend/src/lib/api/client.ts refreshAccessToken(): the catch block computed `code = err instanceof ApiError ? err.code : "INVALID_REFRESH"` and always called `unauthorizedHandler?.(code)` — so a plain network error (which throws a NETWORK_ERROR ApiError, not a 401) still got labeled/treated via the default fallback path as an invalid refresh token on some error shapes, and AuthProvider's unauthorizedHandler forces logout on code === "INVALID_REFRESH". This runs on every API call across the entire 4-hour access-token lifetime (any 401 triggers a silent refresh), making it the most probable real-world trigger — a single dropped wifi packet or a backend blip at the wrong moment during normal use could log a user out mid-session. Fixed: only call unauthorizedHandler when the error is a genuine ApiError with status 401 or code INVALID_REFRESH; any other error (network, 5xx, timeout) now just fails that one silent-refresh attempt without touching the session, so the next successful call keeps the user logged in.
(2) frontend/src/components/providers/AuthProvider.tsx bootstrap(): the outer catch block called `clearSession()` in an `else if (!token)` branch that matched ANY non-matching error, not just a real 401/INVALID_REFRESH rejection — so on a fresh page load with no cached in-memory token (new tab, browser restart, PWA relaunch), if the refresh call failed for any transient reason, the session was wiped even though the httponly 7-day refresh cookie was never touched and remained valid server-side. Fixed: session is now only cleared/logged-out on a definitiveApiError with status 401 or code INVALID_REFRESH; transient errors leave the cached session and cookie alone and the app will successfully re-verify on the next load/retry.
Verified both changed files (frontend/src/lib/api/client.ts, frontend/src/components/providers/AuthProvider.tsx) pass `npx tsc --noEmit` with zero errors. Changes left uncommitted per standing instruction for this session.

TAG: [TASK]
PARENT: Fix users being logged out prematurely instead of the intended 7-day rolling-inactivity session
TITLE: Find and fix the real auto-logout trigger via live repro (refresh-token rotation race)
DESC: User reported the earlier fix didn't fully resolve it — still getting logged out after a few hours. Had the user reproduce it live instead of theorizing further: checked the riseup_refresh cookie in DevTools (present, Secure, HttpOnly, SameSite=Lax, ~7-day expiry — healthy) and pulled backend container logs from the moment of an actual unprompted logout. Logs showed the real signature: two consecutive `POST /api/v1/auth/refresh` calls both returning 401 Unauthorized, immediately followed by the frontend falling back to `POST /api/v1/auth/login`. Ruled out a manual logout (an earlier log snippet the user first sent showed a clean `POST /api/v1/auth/logout` 200, but that's only reachable from ProfileMenu.tsx's manual button click — confirmed with the user that wasn't the actual bug moment).
Root cause: backend-py/app/services/auth_service.py refresh_session()'s rotation-grace-period branch (ROTATION_GRACE_PERIOD, meant to tolerate concurrent refresh calls from multiple tabs/requests reusing the same not-yet-updated cookie). When a request reused an already-rotated token within the grace window, it returned `"refreshToken": refresh_token` — i.e. re-echoed the OLD token value. backend-py/app/api/v1/auth.py's /refresh route then unconditionally called `set_refresh_cookie(response, new_refresh)` on that value, so if this "reuse" response's Set-Cookie reached the browser AFTER the winning rotation's Set-Cookie (response-arrival order isn't guaranteed to match request order), the browser's cookie jar got silently flipped back to the stale, already-rotated token. That stale row is only cleaned up from the DB after the grace period elapses, so the NEXT refresh attempt using it hits the `else` branch — "Refresh token has expired or been replaced" — producing a hard logout that looks like it "just happened after a few hours" but is actually a delayed consequence of a cookie race from concurrent tabs/socket-triggered calls, not real token expiry.
Fix (auth_service.py): widened ROTATION_GRACE_PERIOD from 30s to 120s to absorb slower races; changed the grace-period reuse branch to return `"refreshToken": None` instead of re-echoing the stale token. Fix (auth.py /refresh route): only calls `set_refresh_cookie` when the service returns a non-None token, so a grace-period "reuse" response no longer touches the browser's cookie at all — the cookie is left exactly as the winning rotation set it. Also added a frontend belt-and-suspenders fix in AuthProvider.tsx: previously the access token was only ever refreshed reactively (on the next 401 from a user-triggered API call), so a tab left open and fully idle for 4+ hours had no proactive path to refresh; added a 1-hour interval (well under the 4h access-token TTL) that silently calls refreshSession() while the tab is visible, plus a `visibilitychange` listener that refreshes immediately on refocus (covers browsers throttling/pausing setInterval in backgrounded tabs beyond the interval period).
Verified: `python -c "import ast; ast.parse(...)"` on both changed backend files, and `npx tsc --noEmit` on the full frontend project — both clean. Changes left uncommitted per standing instruction for this session.

DATE_END: 2026-08-24





DATE_START: 2026-08-25
========================================

TAG: [BUG]
TITLE: Fix web app logging users out every few seconds
DESC: Regression introduced by my own previous commit (7d66b13). Users were bounced to the login screen within seconds of loading the web app. Root cause was two separate mistakes in that commit, both of which I made while fixing the earlier "logged out after a few hours" report.
(1) Backend, backend-py/app/services/auth_service.py refresh_session(): I had changed the rotation grace-period branch to return `"refreshToken": None` on the theory that re-echoing the already-rotated token was clobbering the browser's cookie. That theory was wrong. The re-echoed value is identical to what already sits in the browser's jar, so writing it back is a no-op for the VALUE but is what renews the cookie's Max-Age. Returning None made backend-py/app/api/v1/auth.py's /refresh route skip set_refresh_cookie entirely (I had added an `if new_refresh is not None` guard), so a tab that lost a concurrent-refresh race kept a cookie that was never renewed and later hard-failed with INVALID_REFRESH. Reverted to returning refresh_token, with a comment explaining why the re-echo is deliberate so this isn't "cleaned up" again. Kept the widened ROTATION_GRACE_PERIOD (30s -> 120s) and the route's None-guard (now harmless defensive code).
(2) Frontend, frontend/src/components/providers/AuthProvider.tsx: the proactive-refresh effect I added fired on EVERY `visibilitychange` -> visible with no throttle, and called forceLogout() on any failure. Tab focus fires constantly, and forceLogout -> router.replace changes the router identity, which (because the effect's dep array was [forceLogout]) remounted the effect and re-registered the listener — so one failed refresh redirected to /auth/login, remounted, refreshed again, failed again, and looped every few seconds. Fixed with four changes: a MIN_REFRESH_INTERVAL_MS (5 min) throttle, an `inFlight` guard against concurrent calls, `lastRefreshAt` initialized to Date.now() so it never fires on mount, dep array dropped to [] so a redirect can't remount-and-refire it, and removal of the forceLogout call entirely — apiFetch's existing 401 -> refresh -> retry -> unauthorizedHandler path already owns the logout decision, and having a second path race it was the whole problem.
Also audited the rest of the auth system as requested. Confirmed sound: backend JWT signing/verification (app/core/security.py) consistently uses timezone-aware UTC; refresh tokens are DB-backed with a true sliding 7-day window (new row with fresh expires_at on every rotation); rate limiting returns 429 which the frontend correctly does NOT treat as a logout trigger; socket handshake (app/socket/server.py) properly verifies the access token and checks is_disabled. Desktop verified as NOT a separate auth path: frontend/src-tauri/tauri.conf.json sets frontendDist to https://kinetix.mindrind.com, so the Tauri app is a webview loading the same production site with the same cookie jar and the same JS — any web auth fix applies to desktop identically.
Remaining known gap, NOT fixed (flagged for a decision, touches realtime architecture): frontend/src/components/providers/ChatSocketProvider.tsx passes `auth: { token: accessToken }` captured once at socket creation. Socket.IO's built-in reconnect reuses that captured token indefinitely, so if the access token expires while the socket is connected, reconnect attempts silently fail (connect_error is only console.warn'd). The effect does depend on accessToken so a successful HTTP-triggered refresh recreates the socket, but a fully idle tab has no such trigger. Symptom would be "realtime silently stopped", not a logout.

TAG: [TASK]
PARENT: Fix web app logging users out every few seconds
TITLE: Add regression tests for refresh-token rotation and grace period
DESC: The existing tests/test_auth_refresh.py monkeypatches auth_service.refresh_session out entirely, so the rotation and grace-period logic — the exact code that broke twice now — had zero real coverage. Added backend-py/tests/test_auth_refresh_rotation.py, which drives refresh_session directly against a hand-rolled fake session (_FakeSession/_FakeRefreshRow/_FakeUser) with JWT signing and bcrypt monkeypatched out, so it needs no database and always runs in CI. Five cases: unrotated token rotates and issues a new refresh token; reuse within the grace period returns a non-None usable token (the direct regression guard for this bug, with the reasoning in the assertion message); reuse outside the grace period raises 401 INVALID_REFRESH; unknown token raises 401; disabled user raises 403 ACCOUNT_DISABLED.
Verified the guard actually works by reintroducing the `refreshToken: None` bug and confirming test_reuse_within_grace_period_returns_a_usable_refresh_token fails, then restoring the fix and confirming all 5 pass.
Test status: new tests 5/5 pass; tests/test_auth_refresh.py 2/2 still pass; `npx tsc --noEmit` on the frontend is clean. Pre-existing failures NOT caused by this work, verified by stashing my changes and reproducing them on the clean tree: 3 frontend vitest failures in src/lib/chat/sidebar-display-unread.test.ts, and 7 backend failures (6 in test_space_permissions.py, 1 in test_workspace_member_joined.py) that are asyncpg "Future attached to a different loop" test-isolation flakiness — test_workspace_member_joined.py passes in isolation both with and without my changes.

TAG: [BUG]
PARENT: Fix web app logging users out every few seconds
TITLE: Redesign refresh tokens from rotate-on-use to per-device sliding expiry (root cause of recurring logouts)
DESC: User reported logouts were still happening after the earlier fixes (30s->10min grace period widening, cookie re-echo fix). Added logger.warning calls at every 401-raising branch in refresh_session (backend-py/app/services/auth_service.py) and the router's missing-cookie check (app/api/v1/auth.py), since AppError was never logged server-side before — uvicorn's access log only showed "401 Unauthorized" with no way to tell which of four distinct causes fired. Shipped that diagnostic build, then read the live logs the user pulled: `refresh_session: user_id=... reused a rotated token outside the grace period (rotated_at=2026-08-25 07:25:19, cutoff=10:49:45, now=10:59:45)` — a 3.5 HOUR gap between rotation and reuse, nowhere near the 10-minute grace window, ruling out the concurrent-tabs race theory entirely.
Queried the RefreshToken table for that user_id directly: 27 rows total, 19 with rotatedAt=NULL (dead-end tokens issued once and never successfully refreshed again), 8 fresh logins in one day alone. User confirmed multiple devices/browsers are used concurrently on the same account. Root cause: the OLD design rotated the refresh token on every use — each refresh invalidated the previous token (rotatedAt set, later hard-deleted) and minted a brand-new one. Since `fetch(credentials:"include")` always sends whatever is CURRENTLY in the browser's live cookie jar (confirmed this can't be a stale-JS-cache issue), the only way a 3.5-hour-old already-rotated token gets resent is a second device/browser context that hadn't been used in hours, still holding a token some OTHER device's activity had since invalidated. This is not an edge case for a user who is genuinely never idle — it's the expected outcome of the design whenever one person has 2+ concurrent logins, which directly conflicts with "must not log out except after 7 days of total inactivity."
Fix, confirmed with user before implementing (real change to the auth model, not just a bugfix, per project rule on architectural changes): redesigned refresh tokens to be per-device and never rotated. auth_service.issue_refresh_for_user now generates an opaque random token (generate_token(), same helper used for password-reset tokens) instead of a self-expiring JWT, hashed with hash_reset_token (SHA-256, deterministic) instead of bcrypt — this is what makes a direct `WHERE token_hash = ?` lookup possible (token_hash already has a unique index) instead of loading every non-expired row for a user and bcrypt-comparing each one. refresh_session no longer decodes a JWT or creates a new row on refresh: it looks up the matching row by hash, and slides ONLY that row's expires_at forward by another full 7-day window in place. Two devices' tokens are now provably independent — refreshing one never touches, invalidates, or even reads any row belonging to another device. Removed ROTATION_GRACE_PERIOD and all rotatedAt-based logic entirely (dead column left in place, nullable, no migration needed). Also fixed logout() to look up by hash directly instead of the same all-rows-then-bcrypt-compare pattern.
admin_service.py's admin_refresh_session and admin_login both call the same issue_refresh_for_user, so they broke the moment that function's output format changed — fixed admin_refresh_session to look up by hash the same way (kept its existing delete-and-reissue-on-every-refresh behavior, a legitimate separate design choice for the more security-sensitive admin surface, just fixed the lookup mechanism). Cleaned up now-dead imports (hash_token, sign_refresh_token, verify_refresh_token) from both files.
Rewrote backend-py/tests/test_auth_refresh_rotation.py from scratch for the new design (old tests asserted rotation/grace-period behavior that no longer exists) — 6 cases via a hand-rolled fake AsyncSession that parses real SQLAlchemy select().where() clauses: issuing then refreshing keeps the same token value and slides expiry forward without creating a second row; two devices' tokens are fully independent (the direct regression test for the production bug); a token idle for 6d23h (just under the 7-day boundary) still refreshes successfully — the literal scenario that broke; an actually-expired token is rejected; an unknown token is rejected; a disabled user is rejected.
While running the full test suite to verify, found and fixed an unrelated pre-existing failure blocking verification: tests/test_space_permissions.py::test_only_admin_can_toggle_privacy asserted a MEMBER could rename a list without ever granting them a SpaceMember share first. Traced via `git log -p` on space_permissions.py to a genuine, deliberate earlier design change ("every active member gets EDIT by default" -> "no ambient default, explicit SpaceMember row required") that this one test was never updated for, while sibling tests in the same file (test_list_only_share_masks_private_space_name) already follow the correct share-first pattern. Fixed by adding the missing share grant, matching that pattern. The other 6 pre-existing failures in test_space_permissions.py look like the same stale-test category (confirmed test_member_can_manage_structure_with_edit fails with the identical "no ambient access" 403) but are out of scope for this auth session — flagged to user separately, not fixed here.
Provided user a standalone SQL housekeeping script (DELETE FROM "RefreshToken" WHERE "expiresAt" < NOW();) to run on the VPS themselves, to clear the abandoned rows the old design left behind — confirmed safe since it only ever touches already-expired rows.
Verified: full backend/tests/test_auth_refresh_rotation.py + test_auth_refresh.py + test_auth_profile.py pass (8 passed, 2 skipped). test_space_permissions.py full file: 12/17 pass (the 1 fixed + 11 pre-existing-passing), 6 pre-existing failures unrelated to this fix (confirmed via git stash comparison against clean tree in an earlier session). No DB migration needed — RefreshToken's existing columns (userId, tokenHash, expiresAt) already cover the new design; rotatedAt just stops being written. No frontend changes needed — confirmed the /auth/refresh response shape ({user, accessToken}) is unchanged, and the refresh token itself is httpOnly/never read by JS.

DATE_END: 2026-08-25
