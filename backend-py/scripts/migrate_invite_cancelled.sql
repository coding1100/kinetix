-- Soft-delete invites on cancel so the invitee can be told "canceled" specifically.
ALTER TABLE "Invite"
  ADD COLUMN IF NOT EXISTS "cancelledAt" TIMESTAMPTZ;
