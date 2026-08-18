-- Chat canvas documents and live huddles
CREATE TABLE IF NOT EXISTS "ChatChannelCanvas" (
    "id" TEXT PRIMARY KEY,
    "workspaceId" TEXT NOT NULL REFERENCES "Workspace"("id") ON DELETE CASCADE,
    "channelId" TEXT NOT NULL REFERENCES "ChatChannel"("id") ON DELETE CASCADE,
    "title" TEXT NOT NULL DEFAULT 'Canvas',
    "body" TEXT NOT NULL DEFAULT '',
    "revision" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedById" TEXT REFERENCES "User"("id") ON DELETE SET NULL,
    CONSTRAINT "ChatChannelCanvas_channelId_key" UNIQUE ("channelId")
);

ALTER TABLE "ChatChannelCanvas"
    ADD COLUMN IF NOT EXISTS "revision" INTEGER NOT NULL DEFAULT 1;

CREATE TABLE IF NOT EXISTS "ChatHuddle" (
    "id" TEXT PRIMARY KEY,
    "workspaceId" TEXT NOT NULL REFERENCES "Workspace"("id") ON DELETE CASCADE,
    "channelId" TEXT NOT NULL REFERENCES "ChatChannel"("id") ON DELETE CASCADE,
    "title" TEXT NOT NULL DEFAULT 'Live huddle',
    "notes" TEXT NOT NULL DEFAULT '',
    "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
    "startedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "endedAt" TIMESTAMPTZ,
    "startedById" TEXT REFERENCES "User"("id") ON DELETE SET NULL,
    "endedById" TEXT REFERENCES "User"("id") ON DELETE SET NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "ChatHuddleParticipant" (
    "id" TEXT PRIMARY KEY,
    "huddleId" TEXT NOT NULL REFERENCES "ChatHuddle"("id") ON DELETE CASCADE,
    "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
    "joinedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "leftAt" TIMESTAMPTZ,
    "isMuted" BOOLEAN NOT NULL DEFAULT FALSE,
    CONSTRAINT "ChatHuddleParticipant_key" UNIQUE ("huddleId", "userId")
);

CREATE INDEX IF NOT EXISTS "ChatHuddle_workspace_channel_started_idx"
    ON "ChatHuddle" ("workspaceId", "channelId", "startedAt" DESC);

CREATE INDEX IF NOT EXISTS "ChatHuddleParticipant_huddle_idx"
    ON "ChatHuddleParticipant" ("huddleId");
