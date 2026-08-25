-- Task.tags column, matching the ORM model (app/db/models/home.py):
-- Mapped[list[str]] = mapped_column(ARRAY(String), default=list, server_default="{}")
ALTER TABLE "Task"
    ADD COLUMN IF NOT EXISTS "tags" TEXT[] NOT NULL DEFAULT '{}'::text[];
