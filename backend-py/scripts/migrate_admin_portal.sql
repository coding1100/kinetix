-- Platform admin portal: staff role, workspace suspension, user disable, audit log.

DO $$ BEGIN
    CREATE TYPE "PlatformRole" AS ENUM ('STAFF');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "PlatformStaff" (
    "id" TEXT PRIMARY KEY,
    "userId" TEXT NOT NULL UNIQUE REFERENCES "User"("id") ON DELETE CASCADE,
    "role" "PlatformRole" NOT NULL DEFAULT 'STAFF',
    "grantedBy" TEXT REFERENCES "User"("id") ON DELETE SET NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$ BEGIN
    CREATE TYPE "WorkspaceStatus" AS ENUM ('ACTIVE', 'SUSPENDED');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "Workspace"
    ADD COLUMN IF NOT EXISTS "status" "WorkspaceStatus" NOT NULL DEFAULT 'ACTIVE';

ALTER TABLE "User"
    ADD COLUMN IF NOT EXISTS "isDisabled" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS "AdminAuditLog" (
    "id" TEXT PRIMARY KEY,
    "actorUserId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
    "action" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "AdminAuditLog_targetType_targetId_idx"
    ON "AdminAuditLog" ("targetType", "targetId");
