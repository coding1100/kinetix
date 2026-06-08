-- Run once in Supabase SQL Editor so deleting a User removes invites they sent.
-- Fixes: Invite_invitedById_fkey blocks User delete

ALTER TABLE "Invite" DROP CONSTRAINT IF EXISTS "Invite_invitedById_fkey";

ALTER TABLE "Invite"
  ADD CONSTRAINT "Invite_invitedById_fkey"
  FOREIGN KEY ("invitedById") REFERENCES "User"("id") ON DELETE CASCADE;
