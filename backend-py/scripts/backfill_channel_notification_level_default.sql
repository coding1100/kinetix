-- Channel notification default changed from MENTIONS to ALL (plain channel
-- messages now notify every member by default, not just @mentions).
-- Existing ChatChannelMember rows were written with the old MENTIONS
-- default before any user had a chance to actually choose it - flip them to
-- match the new default. Anyone who explicitly chose MENTIONS or NONE via
-- the channel notification-settings UI would have that same value here, so
-- this can't be perfectly distinguished from a real user choice, but MENTIONS
-- was never offered as an explicit choice before this change shipped, so
-- every existing row is the old forced default, not a real preference.
UPDATE "ChatChannelMember"
SET "notificationLevel" = 'ALL'
WHERE "notificationLevel" = 'MENTIONS';
