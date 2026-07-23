# Project instructions

## Architectural boundaries (mandatory)

- Any change that would shift architectural direction: ask user first.
- Any change to a DB table, or creating a new table: ask user first. Critical decision, never take lightly.
- Only write new code if nothing existing covers it. Reuse existing code where possible. If adding a conditional to an existing function does the job, do that — don't create a new function just for the sake of it.
- APIs follow CRUD. Updating a resource: use a general PUT/PATCH, don't spin up a resource-specific endpoint. Listing: build one generalized List API that accepts query params, not many narrow List APIs. Only add new endpoints when no existing one can be extended.
- New methods/functions/APIs are fine when needed — but only after confirming nothing existing already does the job.

## Daily report logging (mandatory)

After finishing any response that involved real work (writing/editing code,
running commands, debugging, planning a feature, answering a "how do I run
X" question, etc.), append an entry to [daily-report.md](daily-report.md) at
the repo root. Read the "Format rules" section in that file for the exact
block syntax (`TAG:` / `PARENT:` / `TITLE:` / `DESC:`) before writing.

Skip logging only for pure meta chit-chat that produced no action (e.g.
"thanks", "ok").

### Steps, every time

1. Get today's date.
2. Open daily-report.md. If a `DATE_START: <today>` block already exists,
   append the new entry just before that day's `DATE_END:` line. Never
   create a second `DATE_START`/`DATE_END` pair for the same date — one
   block per day, entries accumulate inside it. This is what makes the
   process idempotent: re-running/continuing work on the same day edits the
   existing block, it never duplicates it.
3. Pick the tag for what just happened:
   - New business functionality being built -> `[FEATURE]`
   - A bug being fixed -> `[BUG]`
   - Dev-only work with no business requirement behind it (running
     something, a one-off script, tooling/setup, environment questions)
     -> `[CHORE]`
   - If this message is a continuation/step of a `[FEATURE]` or `[BUG]`
     already logged today (or on a prior day, but PARENT only needs the
     title, not the date) -> `[TASK]` with `PARENT: <that feature/bug title>`
   - If this message is a smaller step inside a `[TASK]` already logged
     -> `[SUBTASK]` with `PARENT: <that task title>`
   - A `[TASK]` may also stand alone (no PARENT) if it's a real step of
     work but no parent feature/bug exists yet.
4. Before writing, check whether this message is truly a new entry or just
   a continuation of the most recently logged entry today (e.g. user is
   iterating on the same feature across several messages). If it's the same
   piece of work still being refined, prefer adding a `[SUBTASK]`/`[TASK]`
   under the existing parent over creating a disconnected new top-level
   entry — this is how the log shows evolution of a feature/bug across a
   session instead of one entry per chat message.
5. Write TITLE as a short name for what was done. Write DESC as a summary
   of what was discussed/built, detailed enough to restore full context
   later without re-reading the conversation.
6. Do not touch entries for other dates. Do not rewrite history, only
   append.
