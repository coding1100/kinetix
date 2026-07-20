-- Run once: append-only task activity log, stored inline on Task as JSONB.
-- Each element: {id, activityKind, title, preview, source, createdAt, actorId, actorName}.
-- View-only, chronological audit trail shown in the task Activity panel -
-- not the per-user notification/unread system (InboxItem), which is unchanged.
ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "activity" JSONB NOT NULL DEFAULT '[]'::jsonb;
