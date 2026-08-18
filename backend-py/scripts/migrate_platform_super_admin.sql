ALTER TYPE "PlatformRole" ADD VALUE IF NOT EXISTS 'SUPER_ADMIN' BEFORE 'STAFF';

UPDATE "PlatformStaff"
SET "role" = 'SUPER_ADMIN'
WHERE "userId" = (
    SELECT "userId"
    FROM "PlatformStaff"
    ORDER BY "createdAt" ASC
    LIMIT 1
)
AND NOT EXISTS (
    SELECT 1 FROM "PlatformStaff" WHERE "role" = 'SUPER_ADMIN'
);
