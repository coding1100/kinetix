-- Optional "reports to" manager on a workspace membership
ALTER TABLE "WorkspaceMember"
  ADD COLUMN IF NOT EXISTS "managerId" TEXT REFERENCES "User"(id) ON DELETE SET NULL;
