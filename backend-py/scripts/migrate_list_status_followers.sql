-- Run once: per-list custom statuses + task followers.
-- StatusGroup enum is created by run_list_status_followers_migration.py if missing.

CREATE TABLE IF NOT EXISTS "ListStatus" (
  id VARCHAR PRIMARY KEY,
  "listId" VARCHAR NOT NULL REFERENCES "TaskList"(id) ON DELETE CASCADE,
  name VARCHAR NOT NULL,
  color VARCHAR NOT NULL DEFAULT '#87909e',
  "statusGroup" "StatusGroup" NOT NULL DEFAULT 'NOT_STARTED',
  "legacyKey" VARCHAR,
  "sortOrder" INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS "ListStatus_listId_idx" ON "ListStatus" ("listId");

ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "statusId" VARCHAR REFERENCES "ListStatus"(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS "TaskFollower" (
  "taskId" VARCHAR NOT NULL REFERENCES "Task"(id) ON DELETE CASCADE,
  "userId" VARCHAR NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  PRIMARY KEY ("taskId", "userId")
);
