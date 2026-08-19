-- Production Grade Composite Indexes for High Performance Querying

-- 1. Task Queries (List Tasks, Due Dates, Status Filters, and Assignees)
CREATE INDEX IF NOT EXISTS "idx_tasks_list_status_due" ON "Task" ("listId", "statusId", "dueDate" ASC NULLS LAST);
CREATE INDEX IF NOT EXISTS "idx_tasks_list_created" ON "Task" ("listId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "idx_tasks_assignee_ids_gin" ON "Task" USING GIN ("assigneeIds");
CREATE INDEX IF NOT EXISTS "idx_tasks_follower_ids_gin" ON "Task" USING GIN ("followerIds");

-- 2. Chat & Message Streams (Channel & DM Message Pagination)
CREATE INDEX IF NOT EXISTS "idx_chat_message_channel_created" ON "ChatMessage" ("channelId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "idx_chat_message_dm_created" ON "ChatMessage" ("conversationId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "idx_chat_message_workspace_created" ON "ChatMessage" ("workspaceId", "createdAt" DESC);

-- 3. Workspace & Channel Membership Lookups
CREATE INDEX IF NOT EXISTS "idx_workspace_member_ws_user" ON "WorkspaceMember" ("workspaceId", "userId");
CREATE INDEX IF NOT EXISTS "idx_channel_member_channel_user" ON "ChatChannelMember" ("channelId", "userId");

-- 4. Home Inbox, Sidebar, & Lineup Performance
CREATE INDEX IF NOT EXISTS "idx_inbox_item_ws_user_unread" ON "InboxItem" ("workspaceId", "userId", "unread", "timeGroup");
CREATE INDEX IF NOT EXISTS "idx_home_sidebar_user_ws" ON "UserHomeSidebar" ("userId", "workspaceId");
CREATE INDEX IF NOT EXISTS "idx_user_lineup_ws_user_sort" ON "UserTaskLineup" ("workspaceId", "userId", "sortOrder");
