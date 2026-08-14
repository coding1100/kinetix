"""What the Inbox shows, in one place.

The Inbox lists items that need something from the user. The unread badge has
to be computed from exactly this rule too - counting every InboxItem while the
list rendered only a subset is what made the badge say 6 over an empty Inbox.
"""

from sqlalchemy import or_

from app.db.models.enums import InboxItemType
from app.db.models.home import InboxItem

INBOX_PRIMARY_TYPES = (
    InboxItemType.MENTION,
    InboxItemType.ASSIGNMENT,
    InboxItemType.COMMENT,
    InboxItemType.REPLY,
    InboxItemType.REMINDER,
)

# CHAT is a catch-all: it covers message traffic, self-echo rows ("you deleted
# a channel"), follow bookkeeping and genuinely actionable access changes
# alike. Only the last group belongs in the Inbox, so CHAT is allowed through
# by activity kind rather than wholesale.
INBOX_VISIBLE_CHAT_KINDS = (
    "space_share",
    "folder_share",
    "list_share",
    "space_unshare",
    "folder_unshare",
    "list_unshare",
    "channel_access",
    "channel_access_removed",
)


def is_inbox_visible(item: InboxItem) -> bool:
    if item.type in INBOX_PRIMARY_TYPES:
        return True
    return (item.activity_kind or "") in INBOX_VISIBLE_CHAT_KINDS


def inbox_visible_clause():
    """The same rule as is_inbox_visible(), for queries and counts."""
    return or_(
        InboxItem.type.in_(INBOX_PRIMARY_TYPES),
        InboxItem.activity_kind.in_(INBOX_VISIBLE_CHAT_KINDS),
    )
