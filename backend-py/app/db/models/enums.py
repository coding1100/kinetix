import enum


class WorkspaceRole(str, enum.Enum):
    OWNER = "OWNER"
    SUPER_ADMIN = "SUPER_ADMIN"
    ADMIN = "ADMIN"
    MEMBER = "MEMBER"
    GUEST = "GUEST"
    LIMITED_MEMBER = "LIMITED_MEMBER"


class MemberStatus(str, enum.Enum):
    ACTIVE = "ACTIVE"
    INVITED = "INVITED"
    SUSPENDED = "SUSPENDED"


class PlatformRole(str, enum.Enum):
    SUPER_ADMIN = "SUPER_ADMIN"
    STAFF = "STAFF"


class WorkspaceStatus(str, enum.Enum):
    ACTIVE = "ACTIVE"
    SUSPENDED = "SUSPENDED"


class TeamRole(str, enum.Enum):
    LEAD = "LEAD"
    MEMBER = "MEMBER"


class PermissionLevel(str, enum.Enum):
    VIEW = "VIEW"
    COMMENT = "COMMENT"
    EDIT = "EDIT"


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


class TemplateScope(str, enum.Enum):
    TASK = "TASK"
    LIST = "LIST"
    FOLDER = "FOLDER"
    SPACE = "SPACE"


class AutomationTrigger(str, enum.Enum):
    STATUS_CHANGED = "STATUS_CHANGED"
    ASSIGNEE_ADDED = "ASSIGNEE_ADDED"
    DUE_DATE_ARRIVED = "DUE_DATE_ARRIVED"
    TASK_CREATED = "TASK_CREATED"


class AutomationAction(str, enum.Enum):
    CHANGE_STATUS = "CHANGE_STATUS"
    ASSIGN_USER = "ASSIGN_USER"
    ADD_TAG = "ADD_TAG"
    CREATE_COMMENT = "CREATE_COMMENT"
