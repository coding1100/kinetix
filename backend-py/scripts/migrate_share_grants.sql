-- Share Space/Folder/List: pending-email support on SpaceMember, plus new
-- FolderMember/ListMember tables mirroring SpaceMember's shape.
--
-- status/permissionLevel reuse the native "MemberStatus"/"PermissionLevel"
-- Postgres enum types already created for WorkspaceMember/SpaceMember - not
-- plain TEXT - since the SQLAlchemy models declare Enum(..., name="...")
-- columns, which bind values with an explicit ::"TypeName" cast.

ALTER TABLE "SpaceMember" ALTER COLUMN "userId" DROP NOT NULL;
ALTER TABLE "SpaceMember" ADD COLUMN IF NOT EXISTS "email" TEXT;
ALTER TABLE "SpaceMember" ADD COLUMN IF NOT EXISTS "status" "MemberStatus" NOT NULL DEFAULT 'ACTIVE';

CREATE UNIQUE INDEX IF NOT EXISTS "SpaceMember_spaceId_email_key"
    ON "SpaceMember" ("spaceId", "email")
    WHERE "email" IS NOT NULL;

CREATE TABLE IF NOT EXISTS "FolderMember" (
    "id" TEXT PRIMARY KEY,
    "folderId" TEXT NOT NULL REFERENCES "Folder"("id") ON DELETE CASCADE,
    "userId" TEXT REFERENCES "User"("id") ON DELETE CASCADE,
    "email" TEXT,
    "status" "MemberStatus" NOT NULL DEFAULT 'ACTIVE',
    "permissionLevel" "PermissionLevel" NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT "FolderMember_folderId_userId_key" UNIQUE ("folderId", "userId")
);

CREATE UNIQUE INDEX IF NOT EXISTS "FolderMember_folderId_email_key"
    ON "FolderMember" ("folderId", "email")
    WHERE "email" IS NOT NULL;

CREATE TABLE IF NOT EXISTS "ListMember" (
    "id" TEXT PRIMARY KEY,
    "listId" TEXT NOT NULL REFERENCES "TaskList"("id") ON DELETE CASCADE,
    "userId" TEXT REFERENCES "User"("id") ON DELETE CASCADE,
    "email" TEXT,
    "status" "MemberStatus" NOT NULL DEFAULT 'ACTIVE',
    "permissionLevel" "PermissionLevel" NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT "ListMember_listId_userId_key" UNIQUE ("listId", "userId")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ListMember_listId_email_key"
    ON "ListMember" ("listId", "email")
    WHERE "email" IS NOT NULL;
