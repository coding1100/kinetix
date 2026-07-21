-- Add commentId column to TaskAttachment to link attachments to a specific comment
ALTER TABLE "TaskAttachment"
    ADD COLUMN IF NOT EXISTS "commentId" VARCHAR
        REFERENCES "TaskComment"(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS "idx_TaskAttachment_commentId"
    ON "TaskAttachment" ("commentId");
