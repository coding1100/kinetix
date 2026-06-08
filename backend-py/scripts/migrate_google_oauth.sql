-- Run once against your Postgres DB (Supabase SQL editor or psql).
-- Enables Google OAuth tables and nullable password for OAuth-only users.

ALTER TABLE "User" ALTER COLUMN "passwordHash" DROP NOT NULL;

CREATE TABLE IF NOT EXISTS "OAuthAccount" (
  "id" TEXT PRIMARY KEY,
  "provider" TEXT NOT NULL,
  "providerUserId" TEXT NOT NULL,
  "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "OAuthAccount_provider_user_key" UNIQUE ("provider", "providerUserId")
);

CREATE TABLE IF NOT EXISTS "OAuthState" (
  "state" TEXT PRIMARY KEY,
  "codeVerifier" TEXT NOT NULL,
  "nextPath" TEXT NOT NULL DEFAULT '/home/inbox',
  "expiresAt" TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS "OAuthExchange" (
  "code" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "expiresAt" TIMESTAMPTZ NOT NULL,
  "usedAt" TIMESTAMPTZ
);
