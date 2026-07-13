-- Run once: Space privacy + per-user permission overrides (ClickUp-style).
DO $$ BEGIN
    CREATE TYPE "PermissionLevel" AS ENUM ('VIEW', 'COMMENT', 'EDIT');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "Space" ADD COLUMN IF NOT EXISTS "isPrivate" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS "SpaceMember" (
    "id" TEXT PRIMARY KEY,
    "spaceId" TEXT NOT NULL REFERENCES "Space"("id") ON DELETE CASCADE,
    "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
    "permissionLevel" "PermissionLevel" NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT "SpaceMember_spaceId_userId_key" UNIQUE ("spaceId", "userId")
);

CREATE INDEX IF NOT EXISTS "SpaceMember_spaceId_idx" ON "SpaceMember" ("spaceId");
CREATE INDEX IF NOT EXISTS "SpaceMember_userId_idx" ON "SpaceMember" ("userId");
