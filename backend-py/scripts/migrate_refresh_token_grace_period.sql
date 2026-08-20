-- Add rotatedAt to RefreshToken table for 30-second token rotation grace period
ALTER TABLE "RefreshToken" ADD COLUMN IF NOT EXISTS "rotatedAt" TIMESTAMPTZ;
