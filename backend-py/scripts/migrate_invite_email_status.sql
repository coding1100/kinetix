-- Track invite email delivery outcome so admins see a "Failed" tag when the
-- (fire-and-forget) SMTP send raised. NULL = no email attempted.
ALTER TABLE "Invite"
  ADD COLUMN IF NOT EXISTS "emailStatus" TEXT;
