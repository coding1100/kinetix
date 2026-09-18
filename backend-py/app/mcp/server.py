import json
from contextlib import asynccontextmanager
from typing import Any, Literal

from fastmcp import FastMCP
from fastmcp.exceptions import ToolError
from sqlalchemy import or_, select
from sqlalchemy.orm import selectinload

from app.core.errors import AppError
from app.db.models.chat import ChatChannel, DirectConversation
from app.db.models.home import Space, Task, TaskList
from app.db.models.user import User
from app.db.session import _get_db_semaphore, get_session_factory
from app.mcp.auth import get_mcp_db_session, resolve_mcp_context
from app.schemas.home import CreatePostBody, CreateSubtaskBody, CreateTaskBody, UpdateTaskBody
from app.schemas.spaces import CreateTaskCommentBody
from app.services import (
    chat_enhancements,
    chat_service,
    home_service,
    rag_knowledge_service,
    spaces_service,
)


@asynccontextmanager
async def _db_session():
    async with _get_db_semaphore():
        session_factory = get_session_factory()
        async with session_factory() as session:
            yield session

# Initialize FastMCP Server
mcp = FastMCP(
    name="Kinetix",
    instructions=(
        "You are connected to the Kinetix project management and workspace platform. "
        "You can inspect workspace spaces, folders, lists, and channels; manage tasks, "
        "subtasks, and comments; send messages in channels and personal direct messages (DMs); "
        "create personal posts; search cross-entity knowledge; and run automated workflows."
    ),
)


# ---------------------------------------------------------------------------
# Hierarchy & Task Tools
# ---------------------------------------------------------------------------

@mcp.tool()
async def kinetix_get_workspace_structure(
    workspace_id: str | None = None,
) -> dict[str, Any]:
    """Retrieves the hierarchical structure of spaces, folders, and lists in the workspace.

    Use this tool first to understand where tasks live and obtain the `list_id` needed
    to create or query tasks.

    Args:
        workspace_id: Optional workspace ID. Defaults to the user's active workspace.
    """
    try:
        async with get_mcp_db_session(workspace_id_override=workspace_id) as (session, ctx):
            result = await home_service.list_spaces(
                session, ctx.workspace_id, ctx.user_id, ctx.role
            )
            spaces_data = result.get("data", [])

            formatted_spaces = []
            for sp in spaces_data:
                folders = []
                for f in sp.get("folders", []):
                    lists = [
                        {"id": lst["id"], "name": lst["name"], "taskCount": lst.get("taskCount", 0)}
                        for lst in f.get("lists", [])
                    ]
                    folders.append({"id": f["id"], "name": f["name"], "lists": lists})

                standalone_lists = [
                    {"id": lst["id"], "name": lst["name"], "taskCount": lst.get("taskCount", 0)}
                    for lst in sp.get("lists", [])
                ]

                formatted_spaces.append(
                    {
                        "id": sp["id"],
                        "name": sp["name"],
                        "isPersonal": sp.get("isPersonal", False),
                        "folders": folders,
                        "lists": standalone_lists,
                    }
                )

            return {
                "workspace": {
                    "id": ctx.workspace_id,
                    "name": ctx.workspace_name,
                    "userRole": ctx.role.value,
                },
                "spaces": formatted_spaces,
            }
    except AppError as exc:
        raise ToolError(f"[{exc.code}] {exc.message}") from exc
    except Exception as exc:
        raise ToolError(f"Failed to retrieve workspace structure: {exc}") from exc


@mcp.tool()
async def kinetix_list_tasks(
    list_id: str | None = None,
    filter: Literal["today", "overdue", "assigned", "personal"] | None = None,
    search: str | None = None,
    limit: int = 50,
) -> dict[str, Any]:
    """Lists tasks visible to the user, with optional filtering by list, status/time filter, or search term.

    Args:
        list_id: Optional list ID. When provided, retrieves tasks belonging directly to this list.
        filter: Optional status filter ('today', 'overdue', 'assigned', 'personal').
        search: Optional search keyword to filter tasks by title.
        limit: Maximum number of tasks to return (default: 50).
    """
    try:
        async with _db_session() as session:
            workspace_id_override = None
            if list_id:
                task_list = await session.scalar(
                    select(TaskList)
                    .join(Space)
                    .where(TaskList.id == list_id)
                    .options(selectinload(TaskList.space))
                )
                if not task_list:
                    raise ToolError(f"[NOT_FOUND] List '{list_id}' not found")
                workspace_id_override = task_list.space.workspace_id

            ctx = await resolve_mcp_context(session, workspace_id_override=workspace_id_override)

            if list_id:
                res = await home_service.list_tasks_for_list(
                    session, ctx.workspace_id, ctx.user_id, ctx.role, list_id
                )
            else:
                res = await home_service.list_tasks(
                    session, ctx.workspace_id, ctx.user_id, ctx.role, filter_name=filter, search=search
                )

            raw_tasks = res.get("data", [])
            if limit and len(raw_tasks) > limit:
                raw_tasks = raw_tasks[:limit]

            cleaned = []
            for t in raw_tasks:
                assignees = [
                    {"id": a.get("id"), "name": a.get("name")}
                    for a in t.get("assignees", [])
                ]
                cleaned.append(
                    {
                        "id": t.get("id"),
                        "name": t.get("name"),
                        "status": t.get("status"),
                        "priority": t.get("priority"),
                        "dueDate": t.get("dueDate"),
                        "listId": t.get("listId"),
                        "listName": t.get("listName"),
                        "assignees": assignees,
                        "subtaskCount": len(t.get("subtasks", [])),
                    }
                )
            return {
                "workspaceId": ctx.workspace_id,
                "count": len(cleaned),
                "tasks": cleaned,
            }
    except AppError as exc:
        raise ToolError(f"[{exc.code}] {exc.message}") from exc
    except ToolError:
        raise
    except Exception as exc:
        raise ToolError(f"Failed to list tasks: {exc}") from exc


@mcp.tool()
async def kinetix_get_task(task_id: str) -> dict[str, Any]:
    """Retrieves full details of a specific task, including description, assignees, subtasks, checklists, and comments.

    Args:
        task_id: The unique UUID of the task.
    """
    try:
        async with _db_session() as session:
            task_row = await session.scalar(
                select(Task)
                .join(Task.task_list)
                .join(TaskList.space)
                .where(Task.id == task_id)
                .options(selectinload(Task.task_list).selectinload(TaskList.space))
            )
            if not task_row:
                raise ToolError(f"[NOT_FOUND] Task '{task_id}' not found")

            workspace_id = task_row.task_list.space.workspace_id
            ctx = await resolve_mcp_context(session, workspace_id_override=workspace_id)

            task = await home_service.get_task(
                session, ctx.workspace_id, ctx.user_id, ctx.role, task_id
            )
            return {
                "id": task.get("id"),
                "name": task.get("name"),
                "description": task.get("description"),
                "status": task.get("status"),
                "statusColor": task.get("statusColor"),
                "priority": task.get("priority"),
                "dueDate": task.get("dueDate"),
                "startDate": task.get("startDate"),
                "timeEstimateMinutes": task.get("timeEstimateMinutes"),
                "listId": task.get("listId"),
                "listName": task.get("listName"),
                "spaceId": task.get("spaceId"),
                "spaceName": task.get("spaceName"),
                "assignees": task.get("assignees", []),
                "subtasks": task.get("subtasks", []),
                "checklists": task.get("checklists", []),
                "commentsCount": len(task.get("comments", [])),
                "inLineup": task.get("inLineup", False),
            }
    except AppError as exc:
        raise ToolError(f"[{exc.code}] {exc.message}") from exc
    except ToolError:
        raise
    except Exception as exc:
        raise ToolError(f"Failed to get task '{task_id}': {exc}") from exc


@mcp.tool()
async def kinetix_create_task(
    title: str,
    list_id: str,
    description: str | None = None,
    priority: Literal["urgent", "high", "normal", "low"] = "normal",
    due_date: str | None = None,
    assignee_ids: list[str] | None = None,
) -> dict[str, Any]:
    """Creates a new task within a specific list.

    Args:
        title: Title / name of the task.
        list_id: ID of the list where the task will be placed.
        description: Optional markdown or text description.
        priority: Priority level ('urgent', 'high', 'normal', 'low'). Defaults to 'normal'.
        due_date: Optional ISO 8601 date string (e.g. '2026-10-01T17:00:00Z').
        assignee_ids: Optional list of workspace user IDs to assign.
    """
    try:
        body = CreateTaskBody(
            name=title.strip(),
            description=description.strip() if description else None,
            priority=priority.lower(),
            dueDate=due_date,
            assigneeIds=assignee_ids or [],
        )
        async with _db_session() as session:
            task_list = await session.scalar(
                select(TaskList)
                .join(Space)
                .where(TaskList.id == list_id)
                .options(selectinload(TaskList.space))
            )
            if not task_list:
                raise ToolError(f"[NOT_FOUND] List '{list_id}' not found")

            workspace_id = task_list.space.workspace_id
            ctx = await resolve_mcp_context(session, workspace_id_override=workspace_id)

            created = await home_service.create_task(
                session, ctx.workspace_id, ctx.user_id, ctx.role, list_id, body
            )
            return {
                "id": created.get("id"),
                "name": created.get("name"),
                "status": created.get("status"),
                "priority": created.get("priority"),
                "dueDate": created.get("dueDate"),
                "listId": list_id,
                "assignees": created.get("assignees", []),
                "message": f"Task '{created.get('name')}' created successfully.",
            }
    except AppError as exc:
        raise ToolError(f"[{exc.code}] {exc.message}") from exc
    except ToolError:
        raise
    except Exception as exc:
        raise ToolError(f"Failed to create task: {exc}") from exc


@mcp.tool()
async def kinetix_update_task(
    task_id: str,
    title: str | None = None,
    description: str | None = None,
    status: Literal["OPEN", "TODO", "IN_PROGRESS", "DONE"] | None = None,
    priority: Literal["urgent", "high", "normal", "low"] | None = None,
    due_date: str | None = None,
    assignee_ids: list[str] | None = None,
) -> dict[str, Any]:
    """Updates an existing task's title, description, status, priority, due date, or assignees.

    Args:
        task_id: UUID of the task to update.
        title: Optional updated title.
        description: Optional updated description text.
        status: Optional updated status ('OPEN', 'TODO', 'IN_PROGRESS', 'DONE').
        priority: Optional updated priority ('urgent', 'high', 'normal', 'low').
        due_date: Optional updated ISO 8601 date string.
        assignee_ids: Optional updated list of assignee user IDs.
    """
    try:
        async with _db_session() as session:
            task_row = await session.scalar(
                select(Task)
                .join(Task.task_list)
                .join(TaskList.space)
                .where(Task.id == task_id)
                .options(selectinload(Task.task_list).selectinload(TaskList.space))
            )
            if not task_row:
                raise ToolError(f"[NOT_FOUND] Task '{task_id}' not found")

            workspace_id = task_row.task_list.space.workspace_id
            ctx = await resolve_mcp_context(session, workspace_id_override=workspace_id)

            body = UpdateTaskBody(
                name=title.strip() if title else None,
                description=description,
                status=status,
                priority=priority.lower() if priority else None,
                dueDate=due_date,
                assigneeIds=assignee_ids,
            )

            updated = await home_service.update_task(
                session, ctx.workspace_id, ctx.user_id, ctx.role, task_id, body
            )
            return {
                "id": updated.get("id"),
                "name": updated.get("name"),
                "status": updated.get("status"),
                "priority": updated.get("priority"),
                "dueDate": updated.get("dueDate"),
                "message": f"Task '{updated.get('name')}' updated successfully.",
            }
    except AppError as exc:
        raise ToolError(f"[{exc.code}] {exc.message}") from exc
    except ToolError:
        raise
    except Exception as exc:
        raise ToolError(f"Failed to update task '{task_id}': {exc}") from exc


@mcp.tool()
async def kinetix_create_subtask(
    parent_task_id: str,
    title: str,
) -> dict[str, Any]:
    """Creates a subtask nested under a parent task.

    Args:
        parent_task_id: The UUID of the parent task.
        title: The title of the subtask.
    """
    try:
        async with _db_session() as session:
            parent = await session.scalar(
                select(Task)
                .join(Task.task_list)
                .join(TaskList.space)
                .where(Task.id == parent_task_id)
                .options(selectinload(Task.task_list).selectinload(TaskList.space))
            )
            if not parent:
                raise ToolError(f"[NOT_FOUND] Parent task '{parent_task_id}' not found")

            workspace_id = parent.task_list.space.workspace_id
            ctx = await resolve_mcp_context(session, workspace_id_override=workspace_id)

            body = CreateSubtaskBody(name=title.strip())
            created = await home_service.create_subtask(
                session, ctx.workspace_id, ctx.user_id, ctx.role, parent_task_id, body
            )
            return {
                "id": created.get("id"),
                "name": created.get("name"),
                "parentTaskId": parent_task_id,
                "message": f"Subtask '{created.get('name')}' created successfully.",
            }
    except AppError as exc:
        raise ToolError(f"[{exc.code}] {exc.message}") from exc
    except ToolError:
        raise
    except Exception as exc:
        raise ToolError(f"Failed to create subtask: {exc}") from exc


@mcp.tool()
async def kinetix_add_task_comment(
    task_id: str,
    content: str,
) -> dict[str, Any]:
    """Posts a new comment on a task.

    Args:
        task_id: The UUID of the task.
        content: The text/markdown content of the comment.
    """
    try:
        async with _db_session() as session:
            task = await session.scalar(
                select(Task)
                .join(Task.task_list)
                .join(TaskList.space)
                .where(Task.id == task_id)
                .options(selectinload(Task.task_list).selectinload(TaskList.space))
            )
            if not task:
                raise ToolError(f"[NOT_FOUND] Task '{task_id}' not found")

            workspace_id = task.task_list.space.workspace_id
            ctx = await resolve_mcp_context(session, workspace_id_override=workspace_id)

            body = CreateTaskCommentBody(body=content.strip())
            res = await spaces_service.add_task_comment(
                session, ctx.workspace_id, ctx.user_id, ctx.role, task_id, body
            )
            return {
                "taskId": task_id,
                "content": content.strip(),
                "commentsCount": len(res.get("comments", [])),
                "message": "Comment added successfully.",
            }
    except AppError as exc:
        raise ToolError(f"[{exc.code}] {exc.message}") from exc
    except ToolError:
        raise
    except Exception as exc:
        raise ToolError(f"Failed to add comment to task '{task_id}': {exc}") from exc


@mcp.tool()
async def kinetix_delete_task(task_id: str) -> dict[str, Any]:
    """Permanently deletes a task and its subtasks from the workspace.

    Args:
        task_id: The UUID of the task to delete.
    """
    try:
        async with _db_session() as session:
            task_row = await session.scalar(
                select(Task)
                .join(Task.task_list)
                .join(TaskList.space)
                .where(Task.id == task_id)
                .options(selectinload(Task.task_list).selectinload(TaskList.space))
            )
            if not task_row:
                raise ToolError(f"[NOT_FOUND] Task '{task_id}' not found")

            workspace_id = task_row.task_list.space.workspace_id
            ctx = await resolve_mcp_context(session, workspace_id_override=workspace_id)

            await home_service.delete_task(
                session, ctx.workspace_id, ctx.user_id, ctx.role, task_id
            )
            return {
                "id": task_id,
                "message": f"Task '{task_row.name}' deleted successfully.",
            }
    except AppError as exc:
        raise ToolError(f"[{exc.code}] {exc.message}") from exc
    except ToolError:
        raise
    except Exception as exc:
        raise ToolError(f"Failed to delete task '{task_id}': {exc}") from exc


@mcp.tool()
async def kinetix_delete_task_comment(
    task_id: str,
    comment_id: str,
) -> dict[str, Any]:
    """Deletes a specific comment from a task.

    Args:
        task_id: The UUID of the task.
        comment_id: The UUID of the comment to delete.
    """
    try:
        async with _db_session() as session:
            task = await session.scalar(
                select(Task)
                .join(Task.task_list)
                .join(TaskList.space)
                .where(Task.id == task_id)
                .options(selectinload(Task.task_list).selectinload(TaskList.space))
            )
            if not task:
                raise ToolError(f"[NOT_FOUND] Task '{task_id}' not found")

            workspace_id = task.task_list.space.workspace_id
            ctx = await resolve_mcp_context(session, workspace_id_override=workspace_id)

            await spaces_service.delete_task_comment(
                session, ctx.workspace_id, ctx.user_id, task_id, comment_id, role=ctx.role
            )
            return {
                "taskId": task_id,
                "commentId": comment_id,
                "message": "Task comment deleted successfully.",
            }
    except AppError as exc:
        raise ToolError(f"[{exc.code}] {exc.message}") from exc
    except ToolError:
        raise
    except Exception as exc:
        raise ToolError(f"Failed to delete comment '{comment_id}': {exc}") from exc


# ---------------------------------------------------------------------------
# Chat & Channel Messaging Tools
# ---------------------------------------------------------------------------

@mcp.tool()
async def kinetix_list_channels(
    workspace_id: str | None = None,
) -> dict[str, Any]:
    """Lists all chat channels in the workspace that the user is a member of.

    Args:
        workspace_id: Optional workspace ID. Defaults to the user's active workspace.
    """
    try:
        async with get_mcp_db_session(workspace_id_override=workspace_id) as (session, ctx):
            res = await chat_service.list_channels(session, ctx.workspace_id, ctx.user_id)
            channels = res.get("data", [])
            return {
                "workspaceId": ctx.workspace_id,
                "count": len(channels),
                "channels": [
                    {
                        "id": c.get("id"),
                        "name": c.get("name"),
                        "topic": c.get("topic"),
                        "isPrivate": c.get("isPrivate", False),
                        "memberCount": c.get("memberCount", 0),
                        "unreadCount": c.get("unreadCount", 0),
                    }
                    for c in channels
                ],
            }
    except AppError as exc:
        raise ToolError(f"[{exc.code}] {exc.message}") from exc
    except Exception as exc:
        raise ToolError(f"Failed to list channels: {exc}") from exc


@mcp.tool()
async def kinetix_get_channel_messages(
    channel_id: str,
    limit: int = 30,
) -> dict[str, Any]:
    """Retrieves recent messages from a specific chat channel.

    Args:
        channel_id: The UUID of the channel.
        limit: Number of recent messages to return (default: 30, max: 100).
    """
    try:
        async with _db_session() as session:
            channel = await session.get(ChatChannel, channel_id)
            if not channel:
                raise ToolError(f"[NOT_FOUND] Channel '{channel_id}' not found")

            ctx = await resolve_mcp_context(session, workspace_id_override=channel.workspace_id)
            res = await chat_service.list_channel_messages(
                session, ctx.workspace_id, ctx.user_id, channel_id, limit=min(limit, 100)
            )
            messages = res.get("data", [])
            return {
                "channelId": channel_id,
                "count": len(messages),
                "messages": [
                    {
                        "id": m.get("id"),
                        "author": m.get("authorName") or m.get("author", {}).get("name", "Unknown"),
                        "content": m.get("body"),
                        "createdAt": m.get("createdAt"),
                    }
                    for m in messages
                ],
            }
    except AppError as exc:
        raise ToolError(f"[{exc.code}] {exc.message}") from exc
    except ToolError:
        raise
    except Exception as exc:
        raise ToolError(f"Failed to get channel messages: {exc}") from exc


@mcp.tool()
async def kinetix_post_channel_message(
    content: str,
    channel_id: str | None = None,
    channel_name: str | None = None,
    workspace_id: str | None = None,
) -> dict[str, Any]:
    """Posts a new message to a specific chat channel by its ID or channel name.

    Args:
        content: The message text to post.
        channel_id: Optional UUID of the channel.
        channel_name: Optional name of the channel (e.g. 'general' or '#announcements').
        workspace_id: Optional workspace UUID override.
    """
    if not channel_id and not channel_name:
        raise ToolError("Either 'channel_id' or 'channel_name' must be provided.")

    try:
        async with _db_session() as session:
            channel: ChatChannel | None = None
            if channel_id:
                channel = await session.get(ChatChannel, channel_id)
                if not channel:
                    raise ToolError(f"[NOT_FOUND] Channel '{channel_id}' not found.")
                ctx = await resolve_mcp_context(session, workspace_id_override=channel.workspace_id)
            else:
                clean_name = channel_name.lstrip("#").strip()
                ctx = await resolve_mcp_context(session, workspace_id_override=workspace_id)
                query = select(ChatChannel).where(
                    ChatChannel.name == clean_name,
                    ChatChannel.workspace_id == ctx.workspace_id,
                )
                channel = await session.scalar(query)
                if not channel:
                    raise ToolError(
                        f"[NOT_FOUND] Channel '#{clean_name}' not found in workspace '{ctx.workspace_name}'."
                    )
            msg = await chat_service.send_channel_message(
                session, ctx.workspace_id, ctx.user_id, channel.id, body=content.strip()
            )
            return {
                "id": msg.get("id"),
                "channelId": channel.id,
                "channelName": channel.name,
                "content": msg.get("body"),
                "createdAt": msg.get("createdAt"),
                "message": f"Message posted successfully to #{channel.name}.",
            }
    except AppError as exc:
        raise ToolError(f"[{exc.code}] {exc.message}") from exc
    except ToolError:
        raise
    except Exception as exc:
        raise ToolError(f"Failed to post channel message: {exc}") from exc


# ---------------------------------------------------------------------------
# Personal Direct Messaging (DMs) & Personal Posts Tools
# ---------------------------------------------------------------------------

@mcp.tool()
async def kinetix_send_direct_message(
    content: str,
    recipient_email_or_id: str | None = None,
    conversation_id: str | None = None,
    workspace_id: str | None = None,
) -> dict[str, Any]:
    """Sends a private direct message (DM) to a team member or inside an existing DM conversation.

    Args:
        content: The message text to send.
        recipient_email_or_id: The recipient's email address or user UUID.
        conversation_id: Optional direct conversation UUID if replying in an existing DM thread.
        workspace_id: Optional workspace UUID override.
    """
    if not recipient_email_or_id and not conversation_id:
        raise ToolError("Either 'recipient_email_or_id' or 'conversation_id' must be specified.")

    try:
        async with _db_session() as session:
            target_conv_id = conversation_id
            workspace_override = workspace_id

            if not target_conv_id:
                # Resolve recipient user
                clean_target = recipient_email_or_id.strip()
                recipient = await session.scalar(
                    select(User).where(
                        or_(User.email == clean_target, User.id == clean_target)
                    )
                )
                if not recipient:
                    raise ToolError(f"[NOT_FOUND] Recipient '{recipient_email_or_id}' not found.")

                ctx = await resolve_mcp_context(session, workspace_id_override=workspace_id)
                dm = await chat_service.create_or_get_dm(
                    session, ctx.workspace_id, ctx.user_id, user_ids=[recipient.id], name=None
                )
                target_conv_id = dm["id"]
                workspace_override = ctx.workspace_id
            else:
                conv = await session.get(DirectConversation, target_conv_id)
                if not conv:
                    raise ToolError(f"[NOT_FOUND] Conversation '{conversation_id}' not found.")
                workspace_override = conv.workspace_id

            ctx = await resolve_mcp_context(session, workspace_id_override=workspace_override)
            msg = await chat_service.send_dm_message(
                session, ctx.workspace_id, ctx.user_id, target_conv_id, body=content.strip()
            )
            return {
                "id": msg.get("id"),
                "conversationId": target_conv_id,
                "content": msg.get("body"),
                "createdAt": msg.get("createdAt"),
                "message": "Direct message sent successfully.",
            }
    except AppError as exc:
        raise ToolError(f"[{exc.code}] {exc.message}") from exc
    except ToolError:
        raise
    except Exception as exc:
        raise ToolError(f"Failed to send direct message: {exc}") from exc


@mcp.tool()
async def kinetix_list_direct_conversations(
    workspace_id: str | None = None,
) -> dict[str, Any]:
    """Lists all active personal direct message (DM) conversations for the user.

    Args:
        workspace_id: Optional workspace ID. Defaults to the user's active workspace.
    """
    try:
        async with get_mcp_db_session(workspace_id_override=workspace_id) as (session, ctx):
            res = await chat_service.list_dms(session, ctx.workspace_id, ctx.user_id)
            dms = res.get("data", [])
            return {
                "workspaceId": ctx.workspace_id,
                "count": len(dms),
                "conversations": [
                    {
                        "id": d.get("id"),
                        "name": d.get("name") or "Direct Message",
                        "otherUserId": d.get("otherUserId"),
                        "lastMessage": d.get("lastMessage"),
                        "lastAt": d.get("lastAt"),
                        "unreadCount": d.get("unread", 0),
                    }
                    for d in dms
                ],
            }
    except AppError as exc:
        raise ToolError(f"[{exc.code}] {exc.message}") from exc
    except Exception as exc:
        raise ToolError(f"Failed to list direct conversations: {exc}") from exc


@mcp.tool()
async def kinetix_get_direct_messages(
    conversation_id: str,
    limit: int = 30,
) -> dict[str, Any]:
    """Retrieves recent messages from a personal direct message (DM) conversation.

    Args:
        conversation_id: The UUID of the DM conversation.
        limit: Number of recent messages to return (default: 30, max: 100).
    """
    try:
        async with _db_session() as session:
            conv = await session.get(DirectConversation, conversation_id)
            if not conv:
                raise ToolError(f"[NOT_FOUND] Conversation '{conversation_id}' not found.")

            ctx = await resolve_mcp_context(session, workspace_id_override=conv.workspace_id)
            res = await chat_service.list_dm_messages(
                session, ctx.workspace_id, ctx.user_id, conversation_id, limit=min(limit, 100)
            )
            messages = res.get("data", [])
            return {
                "conversationId": conversation_id,
                "count": len(messages),
                "messages": [
                    {
                        "id": m.get("id"),
                        "author": m.get("authorName") or m.get("author", {}).get("name", "Unknown"),
                        "content": m.get("body"),
                        "createdAt": m.get("createdAt"),
                    }
                    for m in messages
                ],
            }
    except AppError as exc:
        raise ToolError(f"[{exc.code}] {exc.message}") from exc
    except ToolError:
        raise
    except Exception as exc:
        raise ToolError(f"Failed to get direct messages: {exc}") from exc


@mcp.tool()
async def kinetix_create_personal_post(
    content: str,
    channel: str = "general",
) -> dict[str, Any]:
    """Creates a post in the workspace home feed or personal space.

    Args:
        content: The text content of the post.
        channel: Channel tag or category (default: 'general').
    """
    try:
        async with get_mcp_db_session() as (session, ctx):
            body = CreatePostBody(channel=channel.strip(), content=content.strip())
            post = await home_service.create_post(session, ctx.workspace_id, ctx.user_id, body)
            return {
                "id": post.get("id"),
                "author": post.get("author"),
                "channel": post.get("channel"),
                "content": post.get("content"),
                "createdAt": post.get("createdAt"),
                "message": "Personal post published successfully.",
            }
    except AppError as exc:
        raise ToolError(f"[{exc.code}] {exc.message}") from exc
    except Exception as exc:
        raise ToolError(f"Failed to create personal post: {exc}") from exc


# ---------------------------------------------------------------------------
# Cross-Entity Knowledge & Search Tool
# ---------------------------------------------------------------------------

@mcp.tool()
async def kinetix_search(
    query: str,
    scope: Literal["all", "tasks", "messages", "docs"] = "all",
) -> dict[str, Any]:
    """Searches across workspace tasks, chat messages, and official company documentation.

    Args:
        query: Search term or question.
        scope: Where to search ('all', 'tasks', 'messages', 'docs'). Defaults to 'all'.
    """
    try:
        async with get_mcp_db_session() as (session, ctx):
            results: dict[str, Any] = {"query": query, "scope": scope}

            if scope in ("all", "tasks"):
                task_res = await home_service.list_tasks(
                    session, ctx.workspace_id, ctx.user_id, ctx.role, filter_name=None, search=query
                )
                raw_tasks = task_res.get("data", [])[:10]
                results["tasks"] = [
                    {
                        "id": t.get("id"),
                        "name": t.get("name"),
                        "status": t.get("status"),
                        "priority": t.get("priority"),
                        "listName": t.get("listName"),
                    }
                    for t in raw_tasks
                ]

            if scope in ("all", "messages"):
                try:
                    msg_res = await chat_enhancements.search_workspace_messages(
                        session, ctx.workspace_id, ctx.user_id, query
                    )
                    raw_msgs = msg_res.get("data", [])[:10]
                    results["messages"] = [
                        {
                            "id": m.get("id"),
                            "author": m.get("authorName"),
                            "channel": m.get("channelName"),
                            "content": m.get("body"),
                            "createdAt": m.get("createdAt"),
                        }
                        for m in raw_msgs
                    ]
                except Exception:
                    results["messages"] = []

            if scope in ("all", "docs"):
                try:
                    doc_res = await rag_knowledge_service.query_company_knowledge_base(
                        session, ctx.workspace_id, ctx.user_id, query
                    )
                    results["docs"] = {
                        "answer": doc_res.get("answer"),
                        "citations": doc_res.get("citations", []),
                        "actionChips": doc_res.get("actionChips", []),
                    }
                except Exception as exc:
                    results["docs"] = {"answer": None, "error": str(exc)}

            return results
    except AppError as exc:
        raise ToolError(f"[{exc.code}] {exc.message}") from exc
    except Exception as exc:
        raise ToolError(f"Search failed: {exc}") from exc


# ---------------------------------------------------------------------------
# Dynamic Resources
# ---------------------------------------------------------------------------

@mcp.resource("kinetix://workspace/structure")
async def get_workspace_structure_resource() -> str:
    """Live markdown overview of visible spaces, folders, and lists in the workspace."""
    structure = await kinetix_get_workspace_structure()
    ws = structure["workspace"]
    lines = [f"# Workspace: {ws['name']} ({ws['id']})", ""]

    spaces = structure.get("spaces", [])
    if not spaces:
        lines.append("*No spaces created yet.*")
    else:
        for sp in spaces:
            badge = " [Personal]" if sp.get("isPersonal") else ""
            lines.append(f"## Space: {sp['name']}{badge} (ID: `{sp['id']}`)")

            for f in sp.get("folders", []):
                lines.append(f"  📁 **Folder: {f['name']}** (ID: `{f['id']}`)")
                for lst in f.get("lists", []):
                    lines.append(f"    - 📋 {lst['name']} (ID: `{lst['id']}`) [{lst['taskCount']} tasks]")

            for lst in sp.get("lists", []):
                lines.append(f"  - 📋 **List: {lst['name']}** (ID: `{lst['id']}`) [{lst['taskCount']} tasks]")

            lines.append("")

    return "\n".join(lines)


@mcp.resource("kinetix://tasks/{task_id}")
async def get_task_resource(task_id: str) -> str:
    """Live markdown view of a specific task and its metadata."""
    t = await kinetix_get_task(task_id=task_id)
    lines = [
        f"# Task: {t['name']}",
        f"- **ID**: `{t['id']}`",
        f"- **Status**: {t.get('status')} | **Priority**: {t.get('priority')}",
        f"- **Location**: {t.get('spaceName')} > {t.get('listName')}",
        f"- **Due Date**: {t.get('dueDate') or 'None'}",
        "",
        "## Description",
        t.get("description") or "*No description provided.*",
        "",
    ]
    if t.get("subtasks"):
        lines.append("## Subtasks")
        for sub in t["subtasks"]:
            status_box = "[x]" if sub.get("status") == "DONE" else "[ ]"
            lines.append(f"- {status_box} {sub.get('name')} (ID: `{sub.get('id')}`)")
        lines.append("")

    return "\n".join(lines)


@mcp.resource("kinetix://channels/{channel_id}/messages")
async def get_channel_messages_resource(channel_id: str) -> str:
    """Live markdown transcript of recent messages in a channel."""
    res = await kinetix_get_channel_messages(channel_id=channel_id, limit=30)
    messages = res.get("messages", [])
    lines = [f"# Channel Messages: `{channel_id}`", ""]
    if not messages:
        lines.append("*No messages in this channel yet.*")
    else:
        for m in messages:
            lines.append(f"**{m['author']}** ({m.get('createdAt', '')}):")
            lines.append(f"> {m['content']}")
            lines.append("")
    return "\n".join(lines)


@mcp.resource("kinetix://dms/{conversation_id}/messages")
async def get_dm_messages_resource(conversation_id: str) -> str:
    """Live markdown transcript of recent messages in a personal direct message conversation."""
    res = await kinetix_get_direct_messages(conversation_id=conversation_id, limit=30)
    messages = res.get("messages", [])
    lines = [f"# Direct Conversation: `{conversation_id}`", ""]
    if not messages:
        lines.append("*No messages in this conversation yet.*")
    else:
        for m in messages:
            lines.append(f"**{m['author']}** ({m.get('createdAt', '')}):")
            lines.append(f"> {m['content']}")
            lines.append("")
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Predefined Prompts
# ---------------------------------------------------------------------------

@mcp.prompt()
def daily_standup_report() -> str:
    """Generates an executive standup update based on tasks due today, recent completions, and blockers."""
    return (
        "Please generate an executive daily standup report for my active Kinetix workspace:\n"
        "1. Call `kinetix_list_tasks` with filter='today' and filter='overdue' to identify current focus items.\n"
        "2. Review recent discussions in key channels using `kinetix_list_channels` and `kinetix_get_channel_messages`.\n"
        "3. Check direct conversations for pending items using `kinetix_list_direct_conversations`.\n"
        "4. Format the standup into 3 concise sections:\n"
        "   - **Done / Recently Completed**\n"
        "   - **Today's Priorities**\n"
        "   - **Blockers / Needs Review**"
    )


@mcp.prompt()
def task_spec_generator(task_title: str) -> str:
    """Creates a comprehensive technical specification and subtask breakdown for a feature or task."""
    return (
        f"Please create a detailed engineering specification for the task '{task_title}':\n"
        "1. Write an architectural summary and define strict acceptance criteria.\n"
        "2. Break down the task into 3-5 subtasks with recommended priorities.\n"
        "3. Outline verification steps and automated test coverage needed."
    )


# ---------------------------------------------------------------------------
# Server Entrypoint
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import argparse
    import os

    parser = argparse.ArgumentParser(description="Kinetix FastMCP Server")
    parser.add_argument(
        "--transport",
        choices=["stdio", "sse"],
        default=os.getenv("MCP_TRANSPORT", "stdio"),
        help="Transport type ('stdio' for desktop IDEs, 'sse' for HTTP/browser agents)",
    )
    parser.add_argument(
        "--host",
        default=os.getenv("MCP_HOST", "0.0.0.0"),
        help="Host interface for SSE server (default: 0.0.0.0)",
    )
    parser.add_argument(
        "--port",
        type=int,
        default=int(os.getenv("MCP_PORT", "8000")),
        help="Port for SSE server (default: 8000)",
    )
    args, _ = parser.parse_known_args()

    if args.transport == "sse":
        mcp.run(transport="sse", host=args.host, port=args.port)
    else:
        mcp.run(transport="stdio")
