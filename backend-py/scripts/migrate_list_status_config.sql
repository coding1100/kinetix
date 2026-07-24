-- List-level status config override (jsonb, nullable): NULL means the List
-- inherits its owning Space's statusConfig. A non-null value is the List's
-- own override, same shape as Space.statusConfig.
ALTER TABLE "TaskList"
    ADD COLUMN IF NOT EXISTS "statusConfig" JSONB NULL;
