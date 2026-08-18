-- Run once: fold TaskAssignee / TaskFollower join tables into array
-- columns directly on Task. Both are unpayloaded (taskId, userId) rows
-- always read alongside their task and rarely written, so a join table
-- bought normalization we weren't using and cost an extra round trip on
-- every task list/board render.

ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "assigneeIds" TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "followerIds" TEXT[] NOT NULL DEFAULT '{}';

DO $$
BEGIN
  IF to_regclass('"TaskAssignee"') IS NOT NULL THEN
    EXECUTE $backfill$
      UPDATE "Task" t SET "assigneeIds" = sub.ids
      FROM (
        SELECT "taskId", array_agg("userId") AS ids
        FROM "TaskAssignee"
        GROUP BY "taskId"
      ) sub
      WHERE sub."taskId" = t.id
    $backfill$;
  END IF;

  IF to_regclass('"TaskFollower"') IS NOT NULL THEN
    EXECUTE $backfill$
      UPDATE "Task" t SET "followerIds" = sub.ids
      FROM (
        SELECT "taskId", array_agg("userId") AS ids
        FROM "TaskFollower"
        GROUP BY "taskId"
      ) sub
      WHERE sub."taskId" = t.id
    $backfill$;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "Task_assigneeIds_idx" ON "Task" USING GIN ("assigneeIds");
CREATE INDEX IF NOT EXISTS "Task_followerIds_idx" ON "Task" USING GIN ("followerIds");

DROP TABLE IF EXISTS "TaskAssignee";
DROP TABLE IF EXISTS "TaskFollower";
