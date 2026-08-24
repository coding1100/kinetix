from datetime import datetime, timezone
import html
import json
import logging
import re
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.errors import AppError
from app.db.models.chat import ChatChannel, ChatMessage, DirectConversation
from app.db.models.user import User
from app.services.ai_service import cap_sentences, get_llm_completion, remove_em_dashes
from app.services.chat_service import _assert_channel_member, _assert_dm_participant

logger = logging.getLogger(__name__)


def _format_time(dt: datetime) -> str:
    return dt.strftime("%H:%M")


_NAME_COLON_PREFIX = re.compile(r"^\s*[A-Za-z][A-Za-z .'-]{0,40}:\s*")


def _is_near_verbatim(item: str, source_texts: list[str]) -> bool:
    """Detects an LLM output line that is really just a copy of a source
    message (optionally with a 'Name:' prefix) instead of a paraphrase."""
    body = _NAME_COLON_PREFIX.sub("", item).strip().lower()
    if len(body) < 15:
        return False
    for src in source_texts:
        if body in src or src in body:
            return True
        # Long common substring implies near-verbatim copying rather than
        # independent paraphrasing.
        shorter, longer = (body, src) if len(body) <= len(src) else (src, body)
        if len(shorter) >= 20 and shorter[:40] in longer:
            return True
    return False


def _paraphrased_only(items: list[str], source_texts: list[str]) -> list[str]:
    """Drops any LLM-generated item that still reads as a verbatim/near-
    verbatim copy of a source message, so the UI never shows raw chat text
    even if the model ignores the paraphrasing instructions."""
    return [item for item in items if item and not _is_near_verbatim(item, source_texts)]


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
        member = await _assert_channel_member(session, conversation_id, user_id)
        channel = member.channel
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
        participant = await _assert_dm_participant(session, conversation_id, user_id)
        dm = participant.conversation
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
        # Fallback-only items must never read as a raw quoted log line, so
        # cap the snippet length and lead with the name in a sentence shape
        # instead of the "Name: message" transcript format.
        snippet = text if len(text) <= 100 else text[:97].rstrip() + "..."

        # Decision detection
        if any(
            p in lower_text
            for p in [
                "decided", "agreed", "let's go with", "approved", "finalized",
                "resolved", "conclusion", "confirmed", "moving forward with"
            ]
        ):
            decisions.append(f"{author_name} flagged a decision: {snippet}")

        # Action item / Issue detection
        if any(
            p in lower_text
            for p in [
                "todo", "task", "issue", "bug", "not working", "problem", "please fix",
                "will do", "assigned", "can you", "need to", "make sure to", "facing this issue"
            ]
        ):
            actions.append(f"{author_name} raised an action item: {snippet}")

        # Direct mentions & highlights
        if (
            current_user_name.lower() in lower_text
            or f"@{current_user_name.lower()}" in lower_text
            or "@everyone" in lower_text
            or "@here" in lower_text
        ):
            mentions.append(f"{author_name} mentioned you at {time_str}: {snippet}")

    raw_log = "\n".join(log_entries)
    source_texts = [strip_html_tags(msg.body).lower() for msg in messages if strip_html_tags(msg.body)]

    # Gemini Prompt for Humanized Executive Channel Status Report
    prompt = f"""You are an executive assistant writing a short status briefing for {current_user_name} about recent activity in {title}. Someone who has NOT read the chat should be able to read your briefing and understand everything important in under 15 seconds.

Chat Messages Log (raw transcript, for your reference only, NEVER copy from it):
{raw_log}

HOW TO WRITE THE BRIEFING:
- Read the whole log, understand the actual conversation, then explain it in your own words like you are briefing a manager who missed the discussion.
- Every sentence and every list item must be a NEW sentence you write, describing what happened, not a copy of any line from the log above.
- Always refer to people by their real first name from the log (e.g. "Umair", "Faraz"), and describe what they did or reported ("Faraz reported UI stability issues after login") rather than repeating their exact wording.
- Merge related messages from the same person or topic into one clean point instead of listing every message separately.
- If two people discuss the same topic, describe it as one point ("Umair asked the team to log UAT issues; Arbab reported he can't create tasks from the Task section").

STRICT FORMAT RULES:
1. No em dashes (— or –). Use hyphens (-) or colons (:).
2. No HTML tags or markdown symbols (no <div>, **, #, etc).
3. "summary": 2 to 4 sentences. This alone must let the reader understand the whole channel's current state without reading anything else.
4. "keyDecisions", "actionItems", "mentions": each entry is ONE clean sentence, 12 to 18 words, written by you. Maximum 5 entries each. Combine duplicates/near-duplicates into a single entry.
5. If there is nothing genuinely decided, or no real open issue, or no direct mention, return an empty list for that field instead of forcing a weak entry.
6. Never invent people, events, or facts not present in the log.

Respond ONLY with this JSON shape, nothing else, no markdown fences:
{{
  "summary": "2 to 4 sentence plain-English briefing of the whole conversation",
  "keyDecisions": ["One clean sentence per decision, naming who decided"],
  "actionItems": ["One clean sentence per open issue/task, naming who is involved"],
  "mentions": ["One clean sentence per direct mention of {current_user_name}, naming who and why"]
}}
"""

    llm_result = await get_llm_completion(
        prompt,
        system_instruction=(
            "You are an executive workspace briefing writer. You never copy text from the "
            "source transcript you are given; every word in your output is your own "
            "paraphrase. You write like a person summarizing a meeting for someone who "
            "missed it, not like a search engine returning matched lines. Output valid "
            "JSON only, no markdown fences. Be maximally concise and easy to skim."
        ),
    )

    if llm_result:
        try:
            cleaned_json = re.sub(r"^```json\s*", "", llm_result.strip(), flags=re.MULTILINE)
            cleaned_json = re.sub(r"\s*```$", "", cleaned_json, flags=re.MULTILINE)
            data = json.loads(cleaned_json)

            clean_summary = cap_sentences(remove_em_dashes(strip_html_tags(data.get("summary", ""))), max_sentences=4)
            clean_decisions = _paraphrased_only(
                [remove_em_dashes(strip_html_tags(d)) for d in data.get("keyDecisions", [])], source_texts
            )
            clean_actions = _paraphrased_only(
                [remove_em_dashes(strip_html_tags(a)) for a in data.get("actionItems", [])], source_texts
            )
            clean_mentions = _paraphrased_only(
                [remove_em_dashes(strip_html_tags(m)) for m in data.get("mentions", [])], source_texts
            )

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
            logger.warning(
                "Failed to parse LLM catch-up response as JSON, falling back to heuristic summary: %r",
                llm_result[:500],
            )

    # Heuristic fallback - built only from what was actually observed in the
    # message log (counts, participants, time span, detected decisions/action
    # items), never a fabricated claim about what the conversation is about.
    authors_str = ", ".join(list(author_names)[:3])
    if len(author_names) > 3:
        authors_str += f" and {len(author_names) - 3} others"

    span_str = ""
    if len(messages) > 1:
        span_str = f" between {_format_time(messages[0].created_at)} and {_format_time(messages[-1].created_at)}"

    message_word = "message" if len(messages) == 1 else "messages"
    summary_parts = [
        f"{len(messages)} {message_word} in {title} from {authors_str}{span_str}."
    ]
    if decisions:
        decision_word = "decision" if len(decisions) == 1 else "decisions"
        summary_parts.append(f"{len(decisions)} {decision_word} flagged.")
    if actions:
        action_word = "action item" if len(actions) == 1 else "action items"
        summary_parts.append(f"{len(actions)} {action_word} or open issues noted.")
    if not decisions and not actions:
        summary_parts.append("No clear decisions or action items detected in this range.")

    fallback_summary = " ".join(summary_parts)

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
