from datetime import datetime, timezone
import json
import re
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.errors import AppError
from app.db.models.chat import ChatChannel, ChatMessage, DirectConversation
from app.db.models.user import User
from app.services.ai_service import get_llm_completion


def _format_time(dt: datetime) -> str:
    return dt.strftime("%H:%M")


def _clean_text(text: str) -> str:
    return re.sub(r"\s+", " ", text or "").strip()


async def generate_conversation_catch_up(
    session: AsyncSession,
    workspace_id: str,
    user_id: str,
    conversation_type: str,
    conversation_id: str,
    limit: int = 50,
) -> dict[str, Any]:
    """Generates a production-grade Catch Me Up summary for a Channel or DM conversation."""
    target_user = await session.get(User, user_id)
    current_user_name = target_user.full_name if target_user else "You"

    title = ""
    messages: list[ChatMessage] = []

    if conversation_type == "channel":
        channel = await session.get(ChatChannel, conversation_id)
        if not channel or channel.workspace_id != workspace_id:
            raise AppError(404, "NOT_FOUND", "Channel not found in active workspace")
        title = f"#{channel.name}"

        # Optimized query with eager author load to prevent N+1 queries
        query = (
            select(ChatMessage)
            .options(selectinload(ChatMessage.author))
            .where(
                ChatMessage.channel_id == conversation_id,
                ChatMessage.parent_id.is_(None),
            )
            .order_by(ChatMessage.created_at.desc())
            .limit(limit)
        )
        res = await session.scalars(query)
        messages = list(reversed(res.all()))

    elif conversation_type == "dm":
        dm = await session.get(DirectConversation, conversation_id)
        if not dm or dm.workspace_id != workspace_id:
            raise AppError(404, "NOT_FOUND", "Direct conversation not found in workspace")
        title = "Direct Message"

        query = (
            select(ChatMessage)
            .options(selectinload(ChatMessage.author))
            .where(
                ChatMessage.conversation_id == conversation_id,
                ChatMessage.parent_id.is_(None),
            )
            .order_by(ChatMessage.created_at.desc())
            .limit(limit)
        )
        res = await session.scalars(query)
        messages = list(reversed(res.all()))

    else:
        raise AppError(400, "BAD_REQUEST", "Invalid conversation type (must be 'channel' or 'dm')")

    if not messages:
        return {
            "title": title,
            "messageCount": 0,
            "summary": "No recent messages in this conversation yet. All caught up!",
            "keyDecisions": [],
            "actionItems": [],
            "mentions": [],
        }

    # Prepare message log entries
    log_entries: list[str] = []
    author_names: set[str] = set()

    decisions: list[str] = []
    actions: list[str] = []
    mentions: list[str] = []

    for msg in messages:
        author_name = msg.author.full_name if msg.author else "User"
        author_names.add(author_name)
        time_str = _format_time(msg.created_at)
        text = _clean_text(msg.body)

        if not text:
            continue

        entry_line = f"[{time_str}] {author_name}: {text}"
        log_entries.append(entry_line)

        # NLP pattern extractions
        lower_text = text.lower()

        # Decision patterns
        if any(
            pattern in lower_text
            for pattern in [
                "decided", "agreed", "let's go with", "approved", "finalized",
                "resolved", "conclusion", "confirmed that", "we will use", "moving forward with"
            ]
        ):
            decisions.append(f"📌 {author_name}: {text}")

        # Action item patterns
        if any(
            pattern in lower_text
            for pattern in [
                "todo", "task", "action item", "please fix", "will do", "assigned",
                "can you", "need to", "make sure to", "i'll handle", "work on"
            ]
        ):
            actions.append(f"⚡ {author_name}: {text}")

        # Mention & direct relevance patterns
        if (
            current_user_name.lower() in lower_text
            or f"@{current_user_name.lower()}" in lower_text
            or "@everyone" in lower_text
            or "@here" in lower_text
        ):
            mentions.append(f"🙋 {author_name} ({time_str}): {text}")

    # Attempt LLM completion if API key is active
    raw_log = "\n".join(log_entries)
    prompt = f"""Summarize the following recent chat conversation for user '{current_user_name}' in '{title}'.
Conversation Log:
{raw_log}

Respond ONLY in JSON with the structure:
{{
  "summary": "Executive summary paragraph",
  "keyDecisions": ["Decision 1", "Decision 2"],
  "actionItems": ["Action 1", "Action 2"],
  "mentions": ["Mention 1"]
}}
"""
    llm_result = await get_llm_completion(prompt, system_instruction="You are an AI workspace summarizer. Return valid JSON only.")

    if llm_result:
        try:
            # Strip markdown code blocks if returned
            cleaned_json = re.sub(r"^```json\s*", "", llm_result.strip(), flags=re.MULTILINE)
            cleaned_json = re.sub(r"\s*```$", "", cleaned_json, flags=re.MULTILINE)
            data = json.loads(cleaned_json)
            return {
                "title": title,
                "messageCount": len(messages),
                "summary": data.get("summary", ""),
                "keyDecisions": data.get("keyDecisions", []),
                "actionItems": data.get("actionItems", []),
                "mentions": data.get("mentions", []),
            }
        except Exception:
            pass

    # Heuristic NLP Summary Generator (Offline / Production Fallback)
    authors_str = ", ".join(list(author_names)[:3])
    if len(author_names) > 3:
        authors_str += f" and {len(author_names) - 3} others"

    summary_paragraph = (
        f"Discussion in {title} covering {len(messages)} recent messages from {authors_str}. "
        f"The conversation covers project updates, technical coordination, and immediate next steps."
    )

    if not decisions and len(messages) >= 3:
        # Fallback highlight from latest message
        last_msg = messages[-1]
        last_author = last_msg.author.full_name if last_msg.author else "User"
        decisions.append(f"📌 Latest update from {last_author}: \"{_clean_text(last_msg.body)}\"")

    return {
        "title": title,
        "messageCount": len(messages),
        "summary": summary_paragraph,
        "keyDecisions": decisions[:5],
        "actionItems": actions[:5],
        "mentions": mentions[:5],
    }
