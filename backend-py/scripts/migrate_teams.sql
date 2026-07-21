-- Run once: workspace teams and membership.
DO $$ BEGIN
    CREATE TYPE "TeamRole" AS ENUM ('LEAD', 'MEMBER');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "Team" (
    "id" TEXT PRIMARY KEY,
    "workspaceId" TEXT NOT NULL REFERENCES "Workspace"("id") ON DELETE CASCADE,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#7B68EE',
    "icon" TEXT,
    "description" TEXT,
    "createdById" TEXT REFERENCES "User"("id") ON DELETE SET NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "TeamMember" (
    "id" TEXT PRIMARY KEY,
    "teamId" TEXT NOT NULL REFERENCES "Team"("id") ON DELETE CASCADE,
    "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
    "role" "TeamRole" NOT NULL DEFAULT 'MEMBER',
    "joinedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT "TeamMember_teamId_userId_key" UNIQUE ("teamId", "userId")
);

CREATE INDEX IF NOT EXISTS "Team_workspaceId_idx" ON "Team" ("workspaceId");
CREATE INDEX IF NOT EXISTS "TeamMember_teamId_idx" ON "TeamMember" ("teamId");
CREATE INDEX IF NOT EXISTS "TeamMember_userId_idx" ON "TeamMember" ("userId");
