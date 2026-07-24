-- Channel icon glyph (nullable): a fixed key into the frontend's icon
-- registry (e.g. "hash", "megaphone", "star"). NULL = default hash glyph.
ALTER TABLE "ChatChannel"
    ADD COLUMN IF NOT EXISTS "icon" VARCHAR NULL;
