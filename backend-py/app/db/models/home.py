import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import (
    Boolean,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    String,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.db.models.enums import (
    InboxBucket,
    InboxItemType,
    InboxTimeGroup,
    StatusGroup,
    TaskPriority,
    TaskStatus,
)


class Space(Base):
    __tablename__ = "Space"

    id: Mapped[str] = mapped_column(
        String, primary_key=True, default=lambda: str(uuid.uuid4())
    )
    workspace_id: Mapped[str] = mapped_column(
        "workspaceId", String, ForeignKey("Workspace.id", ondelete="CASCADE")
    )
    name: Mapped[str] = mapped_column(String)
    color: Mapped[str] = mapped_column(String, default="#7B68EE")
    description: Mapped[str | None] = mapped_column(String, nullable=True)
    is_personal: Mapped[bool] = mapped_column(
        "isPersonal", Boolean, default=False, server_default="false"
    )
    created_at: Mapped[datetime] = mapped_column(
        "createdAt", DateTime(timezone=True), server_default=func.now()
    )
    folders: Mapped[list["Folder"]] = relationship(back_populates="space")
    lists: Mapped[list["TaskList"]] = relationship(back_populates="space")


class Folder(Base):
    __tablename__ = "Folder"

    id: Mapped[str] = mapped_column(
        String, primary_key=True, default=lambda: str(uuid.uuid4())
    )
    space_id: Mapped[str] = mapped_column(
        "spaceId", String, ForeignKey("Space.id", ondelete="CASCADE")
    )
    name: Mapped[str] = mapped_column(String)
    sort_order: Mapped[int] = mapped_column("sortOrder", Integer, default=0)
    space: Mapped["Space"] = relationship(back_populates="folders")
    lists: Mapped[list["TaskList"]] = relationship(back_populates="folder")


class TaskList(Base):
    __tablename__ = "TaskList"

    id: Mapped[str] = mapped_column(
        String, primary_key=True, default=lambda: str(uuid.uuid4())
    )
    space_id: Mapped[str] = mapped_column(
        "spaceId", String, ForeignKey("Space.id", ondelete="CASCADE")
    )
    folder_id: Mapped[str | None] = mapped_column(
        "folderId", String, ForeignKey("Folder.id", ondelete="SET NULL"), nullable=True
    )
    name: Mapped[str] = mapped_column(String)
    sort_order: Mapped[int] = mapped_column("sortOrder", Integer, default=0)
    space: Mapped["Space"] = relationship(back_populates="lists")
    folder: Mapped["Folder | None"] = relationship(back_populates="lists")
    tasks: Mapped[list["Task"]] = relationship(back_populates="task_list")
    statuses: Mapped[list["ListStatus"]] = relationship(back_populates="task_list")


class ListStatus(Base):
    __tablename__ = "ListStatus"

    id: Mapped[str] = mapped_column(
        String, primary_key=True, default=lambda: str(uuid.uuid4())
    )
    list_id: Mapped[str] = mapped_column(
        "listId", String, ForeignKey("TaskList.id", ondelete="CASCADE")
    )
    name: Mapped[str] = mapped_column(String)
    color: Mapped[str] = mapped_column(String, default="#87909e")
    status_group: Mapped[StatusGroup] = mapped_column(
        "statusGroup", Enum(StatusGroup, name="StatusGroup"), default=StatusGroup.NOT_STARTED
    )
    legacy_key: Mapped[str | None] = mapped_column("legacyKey", String, nullable=True)
    sort_order: Mapped[int] = mapped_column("sortOrder", Integer, default=0)
    task_list: Mapped["TaskList"] = relationship(back_populates="statuses")
    tasks: Mapped[list["Task"]] = relationship(back_populates="list_status")


class Task(Base):
    __tablename__ = "Task"

    id: Mapped[str] = mapped_column(
        String, primary_key=True, default=lambda: str(uuid.uuid4())
    )
    list_id: Mapped[str] = mapped_column(
        "listId", String, ForeignKey("TaskList.id", ondelete="CASCADE")
    )
    name: Mapped[str] = mapped_column(String)
    description: Mapped[str | None] = mapped_column(String, nullable=True)
    status: Mapped[TaskStatus] = mapped_column(
        Enum(TaskStatus, name="TaskStatus"), default=TaskStatus.TODO
    )
    status_id: Mapped[str | None] = mapped_column(
        "statusId", String, ForeignKey("ListStatus.id", ondelete="SET NULL"), nullable=True
    )
    status_color: Mapped[str] = mapped_column("statusColor", String, default="#87909e")
    priority: Mapped[TaskPriority | None] = mapped_column(
        Enum(TaskPriority, name="TaskPriority"), nullable=True
    )
    due_date: Mapped[datetime | None] = mapped_column(
        "dueDate", DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        "createdAt", DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        "updatedAt",
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )
    task_list: Mapped["TaskList"] = relationship(back_populates="tasks")
    list_status: Mapped["ListStatus | None"] = relationship(back_populates="tasks")
    assignees: Mapped[list["TaskAssignee"]] = relationship(
        back_populates="task", cascade="all, delete-orphan"
    )
    comments: Mapped[list["TaskComment"]] = relationship(
        back_populates="task", cascade="all, delete-orphan"
    )
    followers: Mapped[list["TaskFollower"]] = relationship(
        back_populates="task", cascade="all, delete-orphan"
    )


class TaskFollower(Base):
    __tablename__ = "TaskFollower"

    task_id: Mapped[str] = mapped_column(
        "taskId", String, ForeignKey("Task.id", ondelete="CASCADE"), primary_key=True
    )
    user_id: Mapped[str] = mapped_column(
        "userId", String, ForeignKey("User.id", ondelete="CASCADE"), primary_key=True
    )
    task: Mapped["Task"] = relationship(back_populates="followers")
    user: Mapped["User"] = relationship()


class TaskAssignee(Base):
    __tablename__ = "TaskAssignee"

    task_id: Mapped[str] = mapped_column(
        "taskId", String, ForeignKey("Task.id", ondelete="CASCADE"), primary_key=True
    )
    user_id: Mapped[str] = mapped_column(
        "userId", String, ForeignKey("User.id", ondelete="CASCADE"), primary_key=True
    )
    task: Mapped["Task"] = relationship(back_populates="assignees")
    user: Mapped["User"] = relationship()


class TaskComment(Base):
    __tablename__ = "TaskComment"

    id: Mapped[str] = mapped_column(
        String, primary_key=True, default=lambda: str(uuid.uuid4())
    )
    task_id: Mapped[str] = mapped_column(
        "taskId", String, ForeignKey("Task.id", ondelete="CASCADE")
    )
    user_id: Mapped[str] = mapped_column(
        "userId", String, ForeignKey("User.id", ondelete="CASCADE")
    )
    body: Mapped[str] = mapped_column(String)
    created_at: Mapped[datetime] = mapped_column(
        "createdAt", DateTime(timezone=True), server_default=func.now()
    )
    task: Mapped["Task"] = relationship(back_populates="comments")
    user: Mapped["User"] = relationship()


class AssignedComment(Base):
    __tablename__ = "AssignedComment"

    id: Mapped[str] = mapped_column(
        String, primary_key=True, default=lambda: str(uuid.uuid4())
    )
    workspace_id: Mapped[str] = mapped_column(
        "workspaceId", String, ForeignKey("Workspace.id", ondelete="CASCADE")
    )
    task_id: Mapped[str] = mapped_column(
        "taskId", String, ForeignKey("Task.id", ondelete="CASCADE")
    )
    assignee_id: Mapped[str] = mapped_column(
        "assigneeId", String, ForeignKey("User.id", ondelete="CASCADE")
    )
    author_name: Mapped[str] = mapped_column("authorName", String)
    body: Mapped[str] = mapped_column(String)
    due_label: Mapped[str | None] = mapped_column("dueLabel", String, nullable=True)
    resolved_at: Mapped[datetime | None] = mapped_column(
        "resolvedAt", DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        "createdAt", DateTime(timezone=True), server_default=func.now()
    )
    task: Mapped["Task"] = relationship()


class InboxItem(Base):
    __tablename__ = "InboxItem"

    id: Mapped[str] = mapped_column(
        String, primary_key=True, default=lambda: str(uuid.uuid4())
    )
    workspace_id: Mapped[str] = mapped_column(
        "workspaceId", String, ForeignKey("Workspace.id", ondelete="CASCADE")
    )
    user_id: Mapped[str] = mapped_column(
        "userId", String, ForeignKey("User.id", ondelete="CASCADE")
    )
    type: Mapped[InboxItemType] = mapped_column(Enum(InboxItemType, name="InboxItemType"))
    title: Mapped[str] = mapped_column(String)
    preview: Mapped[str] = mapped_column(String)
    source: Mapped[str] = mapped_column(String)
    unread: Mapped[bool] = mapped_column(Boolean, default=True)
    bucket: Mapped[InboxBucket] = mapped_column(
        Enum(InboxBucket, name="InboxBucket"), default=InboxBucket.ALL
    )
    time_group: Mapped[InboxTimeGroup] = mapped_column(
        "timeGroup", Enum(InboxTimeGroup, name="InboxTimeGroup"), default=InboxTimeGroup.TODAY
    )
    href: Mapped[str | None] = mapped_column(String, nullable=True)
    activity_kind: Mapped[str | None] = mapped_column("activityKind", String, nullable=True)
    sent_at_label: Mapped[str | None] = mapped_column("sentAtLabel", String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        "createdAt", DateTime(timezone=True), server_default=func.now()
    )


class Post(Base):
    __tablename__ = "Post"

    id: Mapped[str] = mapped_column(
        String, primary_key=True, default=lambda: str(uuid.uuid4())
    )
    workspace_id: Mapped[str] = mapped_column(
        "workspaceId", String, ForeignKey("Workspace.id", ondelete="CASCADE")
    )
    author_id: Mapped[str] = mapped_column(
        "authorId", String, ForeignKey("User.id", ondelete="CASCADE")
    )
    channel: Mapped[str] = mapped_column(String)
    content: Mapped[str] = mapped_column(Text)
    reactions: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(
        "createdAt", DateTime(timezone=True), server_default=func.now()
    )
    author: Mapped["User"] = relationship()


class HomeReminder(Base):
    __tablename__ = "HomeReminder"

    id: Mapped[str] = mapped_column(
        String, primary_key=True, default=lambda: str(uuid.uuid4())
    )
    workspace_id: Mapped[str] = mapped_column(
        "workspaceId", String, ForeignKey("Workspace.id", ondelete="CASCADE")
    )
    user_id: Mapped[str] = mapped_column(
        "userId", String, ForeignKey("User.id", ondelete="CASCADE")
    )
    title: Mapped[str] = mapped_column(String)
    due_label: Mapped[str] = mapped_column("dueLabel", String)
    due_at: Mapped[datetime | None] = mapped_column(
        "dueAt", DateTime(timezone=True), nullable=True
    )


class HomeFavorite(Base):
    __tablename__ = "HomeFavorite"

    id: Mapped[str] = mapped_column(
        String, primary_key=True, default=lambda: str(uuid.uuid4())
    )
    workspace_id: Mapped[str] = mapped_column(
        "workspaceId", String, ForeignKey("Workspace.id", ondelete="CASCADE")
    )
    user_id: Mapped[str] = mapped_column(
        "userId", String, ForeignKey("User.id", ondelete="CASCADE")
    )
    name: Mapped[str] = mapped_column(String)
    item_type: Mapped[str] = mapped_column("itemType", String)
    href: Mapped[str] = mapped_column(String)


class HomeRecent(Base):
    __tablename__ = "HomeRecent"

    id: Mapped[str] = mapped_column(
        String, primary_key=True, default=lambda: str(uuid.uuid4())
    )
    workspace_id: Mapped[str] = mapped_column(
        "workspaceId", String, ForeignKey("Workspace.id", ondelete="CASCADE")
    )
    user_id: Mapped[str] = mapped_column(
        "userId", String, ForeignKey("User.id", ondelete="CASCADE")
    )
    name: Mapped[str] = mapped_column(String)
    item_type: Mapped[str] = mapped_column("itemType", String)
    space: Mapped[str] = mapped_column(String)
    href: Mapped[str] = mapped_column(String)
    visited_at: Mapped[datetime] = mapped_column(
        "visitedAt", DateTime(timezone=True), server_default=func.now()
    )


class UserTaskLineup(Base):
    __tablename__ = "UserTaskLineup"

    id: Mapped[str] = mapped_column(
        String, primary_key=True, default=lambda: str(uuid.uuid4())
    )
    workspace_id: Mapped[str] = mapped_column(
        "workspaceId", String, ForeignKey("Workspace.id", ondelete="CASCADE")
    )
    user_id: Mapped[str] = mapped_column(
        "userId", String, ForeignKey("User.id", ondelete="CASCADE")
    )
    task_id: Mapped[str] = mapped_column(
        "taskId", String, ForeignKey("Task.id", ondelete="CASCADE")
    )
    sort_order: Mapped[int] = mapped_column("sortOrder", Integer, default=0)
    task: Mapped["Task"] = relationship()


class UserHomeSidebar(Base):
    __tablename__ = "UserHomeSidebar"

    id: Mapped[str] = mapped_column(
        String, primary_key=True, default=lambda: str(uuid.uuid4())
    )
    user_id: Mapped[str] = mapped_column(
        "userId", String, ForeignKey("User.id", ondelete="CASCADE")
    )
    workspace_id: Mapped[str] = mapped_column(
        "workspaceId", String, ForeignKey("Workspace.id", ondelete="CASCADE")
    )
    config: Mapped[dict[str, Any]] = mapped_column(JSON)
    updated_at: Mapped[datetime] = mapped_column(
        "updatedAt",
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )


from app.db.models.user import User  # noqa: E402
