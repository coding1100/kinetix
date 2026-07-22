-- Soft-delete (archive) support for Workspace: admin "Delete" now flips a
-- flag instead of destroying the row, so it can be restored.
ALTER TABLE "Workspace"
    ADD COLUMN IF NOT EXISTS "isDeleted" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "Workspace"
    ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMPTZ;
