-- Thread last-reply summary: speed up per-parent last-reply lookups
CREATE INDEX IF NOT EXISTS "ChatMessage_parent_created_idx"
  ON "ChatMessage" ("parentId", "createdAt" DESC);
