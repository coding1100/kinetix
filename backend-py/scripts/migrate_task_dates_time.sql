-- Task dates, time estimate, and time tracking
ALTER TABLE "Task"
    ADD COLUMN IF NOT EXISTS "startDate" TIMESTAMPTZ;

ALTER TABLE "Task"
    ADD COLUMN IF NOT EXISTS "timeEstimateMinutes" INTEGER;

ALTER TABLE "TaskComment"
    ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS "TaskTimeEntry" (
    "id" VARCHAR PRIMARY KEY,
    "taskId" VARCHAR NOT NULL REFERENCES "Task"(id) ON DELETE CASCADE,
    "workspaceId" VARCHAR NOT NULL REFERENCES "Workspace"(id) ON DELETE CASCADE,
    "userId" VARCHAR NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
    "startedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "endedAt" TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS "idx_TaskTimeEntry_taskId"
    ON "TaskTimeEntry" ("taskId");

CREATE INDEX IF NOT EXISTS "idx_TaskTimeEntry_userId_running"
    ON "TaskTimeEntry" ("userId")
    WHERE "endedAt" IS NULL;
