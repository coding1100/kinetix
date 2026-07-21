-- Add SUPER_ADMIN to workspace role enum (ClickUp-style delegated admin).
DO $$ BEGIN
    ALTER TYPE "WorkspaceRole" ADD VALUE IF NOT EXISTS 'SUPER_ADMIN';
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;
