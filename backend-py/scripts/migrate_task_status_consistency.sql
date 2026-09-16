-- Reconcile and heal task status IDs to ensure every task points to a valid
-- ListStatus belonging strictly to its own list.

DO $$
DECLARE
    r RECORD;
    target_status_id TEXT;
    target_status_color TEXT;
    target_status_legacy TEXT;
    target_status_group TEXT;
BEGIN
    FOR r IN
        SELECT 
            t.id AS task_id,
            t.name AS task_name,
            t."listId" AS list_id,
            t.status::text AS task_status,
            t."statusId" AS old_status_id,
            old_s.name AS old_status_name,
            old_s."statusGroup"::text AS old_status_group
        FROM "Task" t
        LEFT JOIN "ListStatus" old_s ON t."statusId" = old_s.id
        WHERE t."statusId" IS NULL 
           OR t."statusId" NOT IN (SELECT id FROM "ListStatus" WHERE "listId" = t."listId")
    LOOP
        target_status_id := NULL;

        -- 1. Try matching by old status name in the task's list
        IF r.old_status_name IS NOT NULL THEN
            SELECT id, color, "legacyKey", "statusGroup"::text
            INTO target_status_id, target_status_color, target_status_legacy, target_status_group
            FROM "ListStatus"
            WHERE "listId" = r.list_id AND LOWER(TRIM(name)) = LOWER(TRIM(r.old_status_name))
            ORDER BY "sortOrder" ASC
            LIMIT 1;
        END IF;

        -- 2. Try matching by legacyKey == task_status
        IF target_status_id IS NULL AND r.task_status IS NOT NULL THEN
            SELECT id, color, "legacyKey", "statusGroup"::text
            INTO target_status_id, target_status_color, target_status_legacy, target_status_group
            FROM "ListStatus"
            WHERE "listId" = r.list_id AND LOWER(TRIM("legacyKey")) = LOWER(TRIM(r.task_status))
            ORDER BY "sortOrder" ASC
            LIMIT 1;
        END IF;

        -- 3. Try matching by old statusGroup
        IF target_status_id IS NULL AND r.old_status_group IS NOT NULL THEN
            SELECT id, color, "legacyKey", "statusGroup"::text
            INTO target_status_id, target_status_color, target_status_legacy, target_status_group
            FROM "ListStatus"
            WHERE "listId" = r.list_id AND "statusGroup"::text = r.old_status_group
            ORDER BY "sortOrder" ASC
            LIMIT 1;
        END IF;

        -- 4. Try matching by fallback group according to task_status
        IF target_status_id IS NULL THEN
            SELECT id, color, "legacyKey", "statusGroup"::text
            INTO target_status_id, target_status_color, target_status_legacy, target_status_group
            FROM "ListStatus"
            WHERE "listId" = r.list_id AND "statusGroup"::text = (
                CASE 
                    WHEN r.task_status = 'DONE' THEN 'DONE'
                    WHEN r.task_status = 'IN_PROGRESS' THEN 'ACTIVE'
                    ELSE 'NOT_STARTED'
                END
            )
            ORDER BY "sortOrder" ASC
            LIMIT 1;
        END IF;

        -- 5. Fallback to first status in list
        IF target_status_id IS NULL THEN
            SELECT id, color, "legacyKey", "statusGroup"::text
            INTO target_status_id, target_status_color, target_status_legacy, target_status_group
            FROM "ListStatus"
            WHERE "listId" = r.list_id
            ORDER BY "sortOrder" ASC
            LIMIT 1;
        END IF;

        -- Update task with target status
        IF target_status_id IS NOT NULL THEN
            UPDATE "Task"
            SET 
                "statusId" = target_status_id,
                "statusColor" = COALESCE(target_status_color, "statusColor", '#87909e'),
                status = (
                    CASE 
                        WHEN target_status_legacy IS NOT NULL THEN target_status_legacy::"TaskStatus"
                        WHEN target_status_group IN ('DONE', 'CLOSED') THEN 'DONE'::"TaskStatus"
                        WHEN target_status_group = 'ACTIVE' THEN 'IN_PROGRESS'::"TaskStatus"
                        ELSE 'TODO'::"TaskStatus"
                    END
                )
            WHERE id = r.task_id;
        END IF;
    END LOOP;
END $$;
