-- Add channel creator tracking for delete permissions.
ALTER TABLE "ChatChannel"
  ADD COLUMN IF NOT EXISTS "createdById" TEXT REFERENCES "User"(id) ON DELETE SET NULL;

-- Prefer first message author as creator when messages exist.
UPDATE "ChatChannel" c
SET "createdById" = first_msg."authorId"
FROM (
  SELECT DISTINCT ON (m."channelId")
    m."channelId",
    m."authorId"
  FROM "ChatMessage" m
  WHERE m."channelId" IS NOT NULL
    AND m."parentId" IS NULL
  ORDER BY m."channelId", m."createdAt" ASC
) first_msg
WHERE c.id = first_msg."channelId"
  AND c."createdById" IS NULL;

-- Remaining channels without messages: earliest joined member.
UPDATE "ChatChannel" c
SET "createdById" = earliest."userId"
FROM (
  SELECT DISTINCT ON (m."channelId")
    m."channelId",
    m."userId"
  FROM "ChatChannelMember" m
  ORDER BY m."channelId", m."joinedAt" ASC
) earliest
WHERE c.id = earliest."channelId"
  AND c."createdById" IS NULL;
