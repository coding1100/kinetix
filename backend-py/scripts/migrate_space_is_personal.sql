-- Run once in Supabase SQL Editor: personal workspace space flag.
ALTER TABLE "Space" ADD COLUMN IF NOT EXISTS "isPersonal" BOOLEAN NOT NULL DEFAULT false;

UPDATE "Space"
SET "isPersonal" = true
WHERE name = 'Personal' AND "isPersonal" = false;
