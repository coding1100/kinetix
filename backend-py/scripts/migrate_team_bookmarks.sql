CREATE TABLE IF NOT EXISTS "TeamBookmark" (
    "id" TEXT PRIMARY KEY,
    "teamId" TEXT NOT NULL REFERENCES "Team"("id") ON DELETE CASCADE,
    "title" VARCHAR(120) NOT NULL,
    "url" TEXT NOT NULL,
    "createdById" TEXT REFERENCES "User"("id") ON DELETE SET NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "TeamBookmark_teamId_createdAt_idx"
    ON "TeamBookmark" ("teamId", "createdAt" DESC);
