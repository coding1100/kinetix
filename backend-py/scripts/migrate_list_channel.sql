-- Link ChatChannel to TaskList: every list gets its own primary channel.
ALTER TABLE "ChatChannel"
  ADD COLUMN IF NOT EXISTS "listId" TEXT UNIQUE REFERENCES "TaskList"(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS "isListPrimary" BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN "ChatChannel"."isListPrimary" IS 'True only for a Lists own auto-created channel. A regular workspace channel may also carry a non-null listId (optional attach-a-list toggle at channel-create time) without being that Lists primary channel - isListPrimary is the explicit signal for this IS the lists channel vs this channel merely references a list.';
