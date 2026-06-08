-- Delete a user and related rows (run in Supabase SQL Editor).
-- Replace the email below if needed.

DO $$
DECLARE
  uid TEXT;
  target_email TEXT := 'htrajpoot3998@gmail.com';
BEGIN
  SELECT id INTO uid FROM "User" WHERE lower(email) = lower(target_email);
  IF uid IS NULL THEN
    RAISE NOTICE 'No user with email %', target_email;
    RETURN;
  END IF;

  DELETE FROM "Invite" WHERE "invitedById" = uid;
  DELETE FROM "Invite" WHERE lower(email) = lower(target_email);
  DELETE FROM "WorkspaceMember" WHERE "userId" = uid;
  DELETE FROM "RefreshToken" WHERE "userId" = uid;
  DELETE FROM "OAuthAccount" WHERE "userId" = uid;
  DELETE FROM "OAuthExchange" WHERE "userId" = uid;
  DELETE FROM "PasswordResetToken" WHERE "userId" = uid;
  DELETE FROM "ChatChannelMember" WHERE "userId" = uid;
  DELETE FROM "DirectParticipant" WHERE "userId" = uid;
  DELETE FROM "MessageReaction" WHERE "userId" = uid;
  -- Messages authored by user may still exist; remove or reassign if needed:
  DELETE FROM "ChatMessage" WHERE "authorId" = uid;

  DELETE FROM "User" WHERE id = uid;
  RAISE NOTICE 'Deleted user % (%)', target_email, uid;
END $$;
