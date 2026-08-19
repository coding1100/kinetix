-- Update password for inam@mindrind.net to Inam12345@
UPDATE "User"
SET "passwordHash" = '$2b$12$TkSddE7XthrsftnTQxmVeuj0mZUsp2QKBQ2GHK/LDN3qca78PiiYW'
WHERE LOWER("email") = 'inam@mindrind.net';
