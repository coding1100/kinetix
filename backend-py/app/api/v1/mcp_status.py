import os
from pathlib import Path
from typing import Any

from fastapi import APIRouter, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.deps.auth import DbSession
from app.mcp.auth import resolve_mcp_context

router = APIRouter(prefix="/mcp", tags=["meta"])

BACKEND_DIR = str(Path(__file__).resolve().parents[2])


class VerifyMcpBody(BaseModel):
    token: str | None = None
    workspaceId: str | None = None


@router.get("/status")
async def get_mcp_status() -> dict[str, Any]:
    """Returns server capabilities, runtime directory for stdio configuration,

    and active transport endpoints.
    """
    tools = [
        {"name": "kinetix_get_workspace_structure", "description": "Retrieves spaces, folders, and lists tree", "category": "Workspace"},
        {"name": "kinetix_list_tasks", "description": "Lists tasks with status, assignee, and keyword filters", "category": "Tasks"},
        {"name": "kinetix_get_task", "description": "Gets comprehensive task details, subtasks, and comments", "category": "Tasks"},
        {"name": "kinetix_create_task", "description": "Creates a new task in a specific list", "category": "Tasks"},
        {"name": "kinetix_update_task", "description": "Updates task status, priority, due date, or assignees", "category": "Tasks"},
        {"name": "kinetix_delete_task", "description": "Permanently deletes a task and its subtasks", "category": "Tasks"},
        {"name": "kinetix_create_subtask", "description": "Creates a nested subtask under a parent task", "category": "Tasks"},
        {"name": "kinetix_add_task_comment", "description": "Posts a progress note or comment to a task", "category": "Tasks"},
        {"name": "kinetix_delete_task_comment", "description": "Deletes a specific comment from a task", "category": "Tasks"},
        {"name": "kinetix_list_channels", "description": "Lists all accessible workspace chat channels", "category": "Chat"},
        {"name": "kinetix_get_channel_messages", "description": "Reads recent messages in a chat channel", "category": "Chat"},
        {"name": "kinetix_post_channel_message", "description": "Posts a message to a channel by name or ID", "category": "Chat"},
        {"name": "kinetix_send_direct_message", "description": "Sends a private DM to a team member", "category": "Chat"},
        {"name": "kinetix_list_direct_conversations", "description": "Lists active personal DM threads", "category": "Chat"},
        {"name": "kinetix_get_direct_messages", "description": "Reads recent messages in a direct conversation", "category": "Chat"},
        {"name": "kinetix_create_personal_post", "description": "Publishes an update to workspace feed", "category": "Feed"},
        {"name": "kinetix_search", "description": "Cross-entity vector RAG search across tasks, chat, and docs", "category": "Search"},
    ]

    resources = [
        {"uri": "kinetix://workspace/structure", "description": "Live markdown overview of workspace hierarchy"},
        {"uri": "kinetix://tasks/{task_id}", "description": "Live markdown view of task details and subtasks"},
        {"uri": "kinetix://channels/{channel_id}/messages", "description": "Live channel chat transcript"},
        {"uri": "kinetix://dms/{conversation_id}/messages", "description": "Live direct message transcript"},
    ]

    prompts = [
        {"name": "daily_standup_report", "description": "Generates 3-part executive standup from tasks and chats"},
        {"name": "task_spec_generator", "description": "Breaks down a feature into technical specs and subtasks"},
    ]

    return {
        "status": "ready",
        "service": "Kinetix MCP Server",
        "protocolVersion": "2024-11-05",
        "backendDirectory": BACKEND_DIR,
        "transports": {
            "stdio": {
                "command": "uv",
                "args": ["--directory", BACKEND_DIR, "run", "python", "-m", "app.mcp.server"],
                "envKey": "KINETIX_API_KEY",
            },
            "sse": {
                "endpoint": "/mcp/sse",
                "method": "GET",
                "authHeader": "Authorization: Bearer <knx_pat_...>",
            },
        },
        "tools": tools,
        "toolsCount": len(tools),
        "resources": resources,
        "resourcesCount": len(resources),
        "prompts": prompts,
        "promptsCount": len(prompts),
    }


@router.post("/verify")
async def verify_mcp_connection(
    body: VerifyMcpBody,
    session: DbSession,
) -> dict[str, Any]:
    """Tests if a given token or environment resolves a valid user & workspace context."""
    if not body.token:
        return {
            "valid": False,
            "error": "No token provided.",
            "message": "Please provide a Personal Access Token ('knx_pat_...') to test.",
        }

    try:
        ctx = await resolve_mcp_context(
            session,
            api_key_or_token=body.token.strip(),
            workspace_id_override=body.workspaceId,
        )
        return {
            "valid": True,
            "user": {
                "id": ctx.user_id,
                "email": ctx.user_email,
                "name": ctx.user_name,
            },
            "workspace": {
                "id": ctx.workspace_id,
                "name": ctx.workspace_name,
                "role": ctx.role.value if hasattr(ctx.role, "value") else str(ctx.role),
            },
            "toolsCount": 17,
            "message": f"Connection verified successfully as '{ctx.user_name}' ({ctx.user_email}) in '{ctx.workspace_name}'!",
        }
    except Exception as exc:
        return {
            "valid": False,
            "error": str(exc),
            "message": "Token verification failed. Check that the token is not expired or revoked.",
        }
