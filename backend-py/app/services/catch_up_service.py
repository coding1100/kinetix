from datetime import datetime, timezone
import html
import json
import re
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.errors import AppError
from app.db.models.chat import ChatChannel, ChatMessage, DirectConversation
from app.db.models.user import User
from app.services.ai_service import get_llm_completion, remove_em_dashes


def _format_time(dt: datetime) -> str:
    return dt.strftime("%H:%M")


def strip_html_tags(text: str) -> str:
    """Strips all HTML tags and unescapes entities to produce clean plain text."""
    if not text:
        return ""
    # Replace block tags with a space
    cleaned = re.sub(r"<(br|div|p|li|tr|h[1-6])[^>]*\/?>", " ", text, flags=re.IGNORECASE)
    # Remove remaining tags
    cleaned = re.sub(r"<[^>]+>", "", cleaned)
    # Unescape HTML entities (&nbsp;, &lt;, &gt;, &amp;, &quot;)
    cleaned = html.unescape(cleaned)
    # Remove em dashes and extra spaces
    cleaned = remove_em_dashes(cleaned)
    return re.sub(r"\s+", " ", cleaned).strip()


async def generate_conversation_catch_up(
    session: AsyncSession,
    workspace_id: str,
    user_id: str,
    conversation_type: str,
    conversation_id: str,
    limit: int = 50,
) -> dict[str, Any]:
    """Generates an executive, humanized Catch Me Up status summary for a Channel or DM."""
    target_user = await session.get(User, user_id)
    current_user_name = target_user.full_name if target_user else "You"

    title = ""
    messages: list[ChatMessage] = []

    if conversation_type == "channel":
        channel = await session.get(ChatChannel, conversation_id)
        if not channel or channel.workspace_id != workspace_id:
            raise AppError(404, "NOT_FOUND", "Channel not found in active workspace")
        title = f"#{channel.name}"

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
            "title": remove_em_dashes(title),
            "messageCount": 0,
            "summary": "No recent activity in this conversation. All caught up!",
            "keyDecisions": [],
            "actionItems": [],
            "mentions": [],
        }

    # Prepare cleaned message logs
    log_entries: list[str] = []
    author_names: set[str] = set()

    decisions: list[str] = []
    actions: list[str] = []
    mentions: list[str] = []

    for msg in messages:
        author_name = msg.author.full_name if msg.author else "User"
        author_names.add(author_name)
        time_str = _format_time(msg.created_at)
        text = strip_html_tags(msg.body)

        if not text:
            continue

        entry_line = f"[{time_str}] {author_name}: {text}"
        log_entries.append(entry_line)

        lower_text = text.lower()

        # Decision detection
        if any(
            p in lower_text
            for p in [
                "decided", "agreed", "let's go with", "approved", "finalized",
                "resolved", "conclusion", "confirmed", "moving forward with"
            ]
        ):
            decisions.append(f"{author_name}: {text}")

        # Action item / Issue detection
        if any(
            p in lower_text
            for p in [
                "todo", "task", "issue", "bug", "not working", "problem", "please fix",
                "will do", "assigned", "can you", "need to", "make sure to", "facing this issue"
            ]
        ):
            actions.append(f"{author_name}: {text}")

        # Direct mentions & highlights
        if (
            current_user_name.lower() in lower_text
            or f"@{current_user_name.lower()}" in lower_text
            or "@everyone" in lower_text
            or "@here" in lower_text
        ):
            mentions.append(f"{author_name} ({time_str}): {text}")

    raw_log = "\n".join(log_entries)

    # Gemini Prompt for Humanized Executive Channel Status Report
    prompt = f"""You are an executive AI assistant creating a clear, humanized status update for {current_user_name} on recent activity in {title}.

RULES:
1. DO NOT use em dashes (— or –). Use normal hyphens (-) or colons (:).
2. DO NOT include any HTML tags like <div>, <br>, <b>, or CSS styles in your output.
3. Tone: Direct, humanized, concise, and to-the-point.
4. Executive Summary: Explain clearly: (a) what is currently happening, (b) what has been done or resolved, and (c) the overall current status of this channel/project.

Chat Messages Log:
{raw_log}

Respond ONLY in valid JSON format:
{{
  "summary": "Clear executive status summary answering what is happening, what is done, and overall status",
  "keyDecisions": ["Decision 1", "Decision 2"],
  "actionItems": ["Action/Issue 1", "Action/Issue 2"],
  "mentions": ["Mention 1"]
}}
"""

    llm_result = await get_llm_completion(prompt, system_instruction="You are a humanized workspace status summarizer. Output valid JSON only.")

    if llm_result:
        try:
            cleaned_json = re.sub(r"^```json\s*", "", llm_result.strip(), flags=re.MULTILINE)
            cleaned_json = re.sub(r"\s*```$", "", cleaned_json, flags=re.MULTILINE)
            data = json.loads(cleaned_json)

            clean_summary = remove_em_dashes(strip_html_tags(data.get("summary", "")))
            clean_decisions = [remove_em_dashes(strip_html_tags(d)) for d in data.get("keyDecisions", [])]
            clean_actions = [remove_em_dashes(strip_html_tags(a)) for a in data.get("actionItems", [])]
            clean_mentions = [remove_em_dashes(strip_html_tags(m)) for m in data.get("mentions", [])]

            if clean_summary:
                return {
                    "title": remove_em_dashes(title),
                    "messageCount": len(messages),
                    "summary": clean_summary,
                    "keyDecisions": clean_decisions[:5],
                    "actionItems": clean_actions[:5],
                    "mentions": clean_mentions[:5],
                }
        except Exception:
            pass

    # Heuristic Fallback
    authors_str = ", ".join(list(author_names)[:3])
    if len(author_names) > 3:
        authors_str += f" and {len(author_names) - 3} others"

    fallback_summary = (
        f"Active status in {title}: {len(messages)} recent updates logged by {authors_str}. "
        f"Team is coordinating on testing, feedback review, and resolving active issues."
    )

    clean_decisions = [remove_em_dashes(strip_html_tags(d)) for d in decisions]
    clean_actions = [remove_em_dashes(strip_html_tags(a)) for a in actions]
    clean_mentions = [remove_em_dashes(strip_html_tags(m)) for m in mentions]

    return {
        "title": remove_em_dashes(title),
        "messageCount": len(messages),
        "summary": remove_em_dashes(fallback_summary),
        "keyDecisions": clean_decisions[:5],
        "actionItems": clean_actions[:5],
        "mentions": clean_mentions[:5],
    }
