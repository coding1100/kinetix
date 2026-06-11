-- Point createdById at first message author when available.
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
  AND (c."createdById" IS NULL OR c."createdById" <> first_msg."authorId");

-- Empty channels: earliest member who is following (creator at channel birth).
UPDATE "ChatChannel" c
SET "createdById" = pick."userId"
FROM (
  SELECT DISTINCT ON (m."channelId")
    m."channelId",
    m."userId"
  FROM "ChatChannelMember" m
  WHERE m."isFollowing" = true
    AND NOT EXISTS (
      SELECT 1
      FROM "ChatMessage" msg
      WHERE msg."channelId" = m."channelId"
        AND msg."parentId" IS NULL
    )
  ORDER BY m."channelId", m."joinedAt" ASC
) pick
WHERE c.id = pick."channelId";

-- Still missing creator: earliest joined member.
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
