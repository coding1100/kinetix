"""The Inbox list and the unread badge must agree on what counts."""

from app.db.models.enums import InboxItemType
from app.db.models.home import InboxItem
from app.services.inbox_visibility import is_inbox_visible


def item(item_type: InboxItemType, activity_kind: str | None) -> InboxItem:
    return InboxItem(type=item_type, activity_kind=activity_kind)


def test_primary_types_are_always_visible():
    assert is_inbox_visible(item(InboxItemType.MENTION, "mention"))
    assert is_inbox_visible(item(InboxItemType.MENTION, "task_mention"))
    assert is_inbox_visible(item(InboxItemType.ASSIGNMENT, "task_assigned"))
    assert is_inbox_visible(item(InboxItemType.COMMENT, "task_comment"))
    assert is_inbox_visible(item(InboxItemType.REPLY, "thread_reply"))
    assert is_inbox_visible(item(InboxItemType.REMINDER, "invite_accepted"))
    assert is_inbox_visible(item(InboxItemType.ASSIGNMENT, None))


def test_access_changes_are_visible_despite_being_typed_chat():
    assert is_inbox_visible(item(InboxItemType.CHAT, "space_share"))
    assert is_inbox_visible(item(InboxItemType.CHAT, "folder_share"))
    assert is_inbox_visible(item(InboxItemType.CHAT, "list_share"))
    assert is_inbox_visible(item(InboxItemType.CHAT, "list_unshare"))
    assert is_inbox_visible(item(InboxItemType.CHAT, "channel_access"))
    assert is_inbox_visible(item(InboxItemType.CHAT, "channel_access_removed"))


def test_message_traffic_is_hidden():
    assert not is_inbox_visible(item(InboxItemType.CHAT, "dm_message"))
    assert not is_inbox_visible(item(InboxItemType.CHAT, "channel_message"))


def test_self_echo_and_bookkeeping_are_hidden():
    assert not is_inbox_visible(item(InboxItemType.CHAT, "channel_access_actor"))
    assert not is_inbox_visible(item(InboxItemType.CHAT, "channel_deleted_actor"))
    assert not is_inbox_visible(item(InboxItemType.CHAT, "channel_follow"))
    assert not is_inbox_visible(item(InboxItemType.CHAT, "channel_unfollow"))
    assert not is_inbox_visible(item(InboxItemType.CHAT, "task_followed"))


def test_high_volume_informational_chat_stays_out():
    # 993 rows of this in the dev database - it is a feed event, not an Inbox item.
    assert not is_inbox_visible(item(InboxItemType.CHAT, "channel_deleted"))
    assert not is_inbox_visible(item(InboxItemType.CHAT, None))
