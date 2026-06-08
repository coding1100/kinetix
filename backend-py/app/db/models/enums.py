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
