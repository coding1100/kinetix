-- Create the checklist schema idempotently. Never drop the item table here:
-- installations that already use this schema may contain production data.

CREATE TABLE IF NOT EXISTS "TaskChecklist" (
  id VARCHAR PRIMARY KEY,
  "taskId" VARCHAR NOT NULL REFERENCES "Task"(id) ON DELETE CASCADE,
  name VARCHAR NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "TaskChecklist_taskId_idx" ON "TaskChecklist" ("taskId");

CREATE TABLE IF NOT EXISTS "TaskChecklistItem" (
  id VARCHAR PRIMARY KEY,
  "checklistId" VARCHAR NOT NULL REFERENCES "TaskChecklist"(id) ON DELETE CASCADE,
  text VARCHAR NOT NULL,
  "isChecked" BOOLEAN NOT NULL DEFAULT false,
  "assigneeId" VARCHAR REFERENCES "User"(id) ON DELETE SET NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "TaskChecklistItem_checklistId_idx" ON "TaskChecklistItem" ("checklistId");
