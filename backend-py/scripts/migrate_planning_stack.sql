-- Migration: Add planning stack columns and tables

ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "isMilestone" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS "EntityTemplate" (
    "id" VARCHAR PRIMARY KEY,
    "workspaceId" VARCHAR NOT NULL REFERENCES "Workspace"("id") ON DELETE CASCADE,
    "name" VARCHAR NOT NULL,
    "description" VARCHAR,
    "scope" VARCHAR NOT NULL DEFAULT 'TASK',
    "category" VARCHAR NOT NULL DEFAULT 'General',
    "templateData" JSONB NOT NULL DEFAULT '{}'::jsonb,
    "createdById" VARCHAR REFERENCES "User"("id") ON DELETE SET NULL,
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "Portfolio" (
    "id" VARCHAR PRIMARY KEY,
    "workspaceId" VARCHAR NOT NULL REFERENCES "Workspace"("id") ON DELETE CASCADE,
    "name" VARCHAR NOT NULL,
    "description" VARCHAR,
    "color" VARCHAR NOT NULL DEFAULT '#4194F6',
    "createdById" VARCHAR REFERENCES "User"("id") ON DELETE SET NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "PortfolioList" (
    "id" VARCHAR PRIMARY KEY,
    "portfolioId" VARCHAR NOT NULL REFERENCES "Portfolio"("id") ON DELETE CASCADE,
    "listId" VARCHAR NOT NULL REFERENCES "TaskList"("id") ON DELETE CASCADE,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "TaskAutomationRule" (
    "id" VARCHAR PRIMARY KEY,
    "workspaceId" VARCHAR NOT NULL REFERENCES "Workspace"("id") ON DELETE CASCADE,
    "spaceId" VARCHAR REFERENCES "Space"("id") ON DELETE CASCADE,
    "listId" VARCHAR REFERENCES "TaskList"("id") ON DELETE CASCADE,
    "name" VARCHAR NOT NULL,
    "triggerType" VARCHAR NOT NULL,
    "triggerConfig" JSONB NOT NULL DEFAULT '{}'::jsonb,
    "actionType" VARCHAR NOT NULL,
    "actionConfig" JSONB NOT NULL DEFAULT '{}'::jsonb,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "Whiteboard" (
    "id" VARCHAR PRIMARY KEY,
    "workspaceId" VARCHAR NOT NULL REFERENCES "Workspace"("id") ON DELETE CASCADE,
    "spaceId" VARCHAR REFERENCES "Space"("id") ON DELETE CASCADE,
    "name" VARCHAR NOT NULL,
    "canvasData" JSONB NOT NULL DEFAULT '{}'::jsonb,
    "createdById" VARCHAR REFERENCES "User"("id") ON DELETE SET NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);
