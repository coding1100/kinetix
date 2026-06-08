-- Run once on Supabase SQL editor (or psql) before using chat attachments.

CREATE TABLE IF NOT EXISTS "MessageAttachment" (
  "id" TEXT PRIMARY KEY,
  "workspaceId" TEXT NOT NULL REFERENCES "Workspace"(id) ON DELETE CASCADE,
  "messageId" TEXT REFERENCES "ChatMessage"(id) ON DELETE CASCADE,
  "channelId" TEXT REFERENCES "ChatChannel"(id) ON DELETE CASCADE,
  "conversationId" TEXT REFERENCES "DirectConversation"(id) ON DELETE CASCADE,
  "uploaderId" TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  "storageKey" TEXT NOT NULL,
  "fileName" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "sizeBytes" INTEGER NOT NULL,
  "kind" TEXT NOT NULL DEFAULT 'file',
  "status" TEXT NOT NULL DEFAULT 'pending',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "MessageAttachment_messageId_idx"
  ON "MessageAttachment"("messageId");
CREATE INDEX IF NOT EXISTS "MessageAttachment_channelId_idx"
  ON "MessageAttachment"("channelId");
CREATE INDEX IF NOT EXISTS "MessageAttachment_conversationId_idx"
  ON "MessageAttachment"("conversationId");
