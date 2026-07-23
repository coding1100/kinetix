-- Track who created each Space/Folder/List, so they always keep access to
-- their own content even though there's no ambient default access anymore.
ALTER TABLE "Space"
  ADD COLUMN IF NOT EXISTS "createdById" TEXT REFERENCES "User"(id) ON DELETE SET NULL;

ALTER TABLE "Folder"
  ADD COLUMN IF NOT EXISTS "createdById" TEXT REFERENCES "User"(id) ON DELETE SET NULL;

ALTER TABLE "TaskList"
  ADD COLUMN IF NOT EXISTS "createdById" TEXT REFERENCES "User"(id) ON DELETE SET NULL;
