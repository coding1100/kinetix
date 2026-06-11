-- Chat enhancements: pins, notification prefs, DM hide, message pins
ALTER TABLE "ChatChannelMember"
  ADD COLUMN IF NOT EXISTS "pinnedAt" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "notificationLevel" TEXT NOT NULL DEFAULT 'MENTIONS';

ALTER TABLE "DirectParticipant"
  ADD COLUMN IF NOT EXISTS "isHidden" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "ChatMessage"
  ADD COLUMN IF NOT EXISTS "pinnedAt" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "pinnedById" TEXT REFERENCES "User"(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS "ChatMessage_workspace_created_idx"
  ON "ChatMessage" ("workspaceId", "createdAt" DESC);
