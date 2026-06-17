-- Add parentCommentId for threaded task comment replies
ALTER TABLE "TaskComment"
    ADD COLUMN IF NOT EXISTS "parentCommentId" VARCHAR
        REFERENCES "TaskComment"(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS "idx_TaskComment_parentCommentId"
    ON "TaskComment" ("parentCommentId");
