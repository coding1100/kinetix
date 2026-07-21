-- Subtasks (parent task) and task file attachments

ALTER TABLE "Task"
  ADD COLUMN IF NOT EXISTS "parentTaskId" TEXT
  REFERENCES "Task"("id") ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS "Task_parentTaskId_idx"
  ON "Task"("parentTaskId");

CREATE TABLE IF NOT EXISTS "TaskAttachment" (
  "id" TEXT PRIMARY KEY,
  "taskId" TEXT NOT NULL REFERENCES "Task"("id") ON DELETE CASCADE,
  "workspaceId" TEXT NOT NULL REFERENCES "Workspace"("id") ON DELETE CASCADE,
  "uploaderId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "storageKey" TEXT NOT NULL,
  "fileName" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "sizeBytes" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "TaskAttachment_taskId_idx"
  ON "TaskAttachment"("taskId");
