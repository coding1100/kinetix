-- Run once: per-member time estimate / time tracking visibility toggle
-- (ClickUp's "individual permissions" for Guest / Limited Member).
ALTER TABLE "WorkspaceMember" ADD COLUMN IF NOT EXISTS "canSeeTimeEstimate" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "WorkspaceMember" ADD COLUMN IF NOT EXISTS "canTrackTime" BOOLEAN NOT NULL DEFAULT true;
