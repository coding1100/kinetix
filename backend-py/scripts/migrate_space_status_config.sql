-- Space-level default status config (jsonb): each Space now owns its own
-- default status set that new Lists in that space seed their ListStatus
-- rows from, instead of one hardcoded global default.
ALTER TABLE "Space"
    ADD COLUMN IF NOT EXISTS "statusConfig" JSONB NOT NULL DEFAULT
    '[{"legacyKey": "OPEN", "name": "BACKLOG", "color": "#7A7F87", "statusGroup": "NOT_STARTED", "sortOrder": 0}, {"legacyKey": "TODO", "name": "TODO", "color": "#87909E", "statusGroup": "NOT_STARTED", "sortOrder": 1}, {"legacyKey": "IN_PROGRESS", "name": "IN PROGRESS", "color": "#4194F6", "statusGroup": "ACTIVE", "sortOrder": 2}, {"legacyKey": "IN_PROGRESS", "name": "READY FOR REVIEW", "color": "#F57C00", "statusGroup": "ACTIVE", "sortOrder": 3}, {"legacyKey": "DONE", "name": "DONE", "color": "#0F766E", "statusGroup": "DONE", "sortOrder": 4}]'::jsonb;
