-- Run once: Folder/List privacy, mirroring Space.isPrivate.
ALTER TABLE "Folder" ADD COLUMN IF NOT EXISTS "isPrivate" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "TaskList" ADD COLUMN IF NOT EXISTS "isPrivate" BOOLEAN NOT NULL DEFAULT false;
