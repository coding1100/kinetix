-- Run once: LineUp ordering + recents visited timestamp.
CREATE TABLE IF NOT EXISTS "UserTaskLineup" (
  id VARCHAR PRIMARY KEY,
  "workspaceId" VARCHAR NOT NULL REFERENCES "Workspace"(id) ON DELETE CASCADE,
  "userId" VARCHAR NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  "taskId" VARCHAR NOT NULL REFERENCES "Task"(id) ON DELETE CASCADE,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  UNIQUE ("userId", "taskId")
);

CREATE INDEX IF NOT EXISTS "UserTaskLineup_user_workspace_idx"
  ON "UserTaskLineup" ("userId", "workspaceId", "sortOrder");

ALTER TABLE "HomeRecent" ADD COLUMN IF NOT EXISTS "visitedAt" TIMESTAMPTZ NOT NULL DEFAULT now();
