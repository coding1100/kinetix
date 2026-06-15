import enum


class WorkspaceRole(str, enum.Enum):
    OWNER = "OWNER"
    ADMIN = "ADMIN"
    MEMBER = "MEMBER"
    GUEST = "GUEST"
    LIMITED_MEMBER = "LIMITED_MEMBER"


class MemberStatus(str, enum.Enum):
    ACTIVE = "ACTIVE"
    INVITED = "INVITED"
    SUSPENDED = "SUSPENDED"


class TaskStatus(str, enum.Enum):
    OPEN = "OPEN"
    TODO = "TODO"
    IN_PROGRESS = "IN_PROGRESS"
    DONE = "DONE"


class StatusGroup(str, enum.Enum):
    NOT_STARTED = "NOT_STARTED"
    ACTIVE = "ACTIVE"
    DONE = "DONE"
    CLOSED = "CLOSED"


class TaskPriority(str, enum.Enum):
    URGENT = "URGENT"
    HIGH = "HIGH"
    NORMAL = "NORMAL"
    LOW = "LOW"


class InboxBucket(str, enum.Enum):
    ALL = "ALL"
    LATER = "LATER"


class InboxTimeGroup(str, enum.Enum):
    TODAY = "TODAY"
    EARLIER = "EARLIER"


class ChannelNotificationLevel(str, enum.Enum):
    ALL = "ALL"
    MENTIONS = "MENTIONS"
    NONE = "NONE"


class InboxItemType(str, enum.Enum):
    COMMENT = "COMMENT"
    MENTION = "MENTION"
    ASSIGNMENT = "ASSIGNMENT"
    CHAT = "CHAT"
    REMINDER = "REMINDER"
    REPLY = "REPLY"
    REACTION = "REACTION"
    DRAFT = "DRAFT"
    SENT = "SENT"
    SCHEDULED = "SCHEDULED"
