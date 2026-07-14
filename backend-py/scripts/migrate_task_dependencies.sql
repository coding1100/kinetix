-- Run once: task-to-task dependencies (blocking / blocked_by / linked).

CREATE TABLE IF NOT EXISTS "TaskDependency" (
  id VARCHAR PRIMARY KEY,
  "taskId" VARCHAR NOT NULL REFERENCES "Task"(id) ON DELETE CASCADE,
  "relatedTaskId" VARCHAR NOT NULL REFERENCES "Task"(id) ON DELETE CASCADE,
  "dependencyType" VARCHAR NOT NULL CHECK ("dependencyType" IN ('blocking', 'blocked_by', 'linked')),
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "TaskDependency_taskId_idx" ON "TaskDependency" ("taskId");
CREATE INDEX IF NOT EXISTS "TaskDependency_relatedTaskId_idx" ON "TaskDependency" ("relatedTaskId");
