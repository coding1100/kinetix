SELECT count(*) AS users FROM "User";
SELECT count(*) AS workspaces FROM "Workspace";
SELECT count(*) AS messages FROM "ChatMessage";
SELECT "email" FROM "User" ORDER BY "createdAt" DESC LIMIT 5;
