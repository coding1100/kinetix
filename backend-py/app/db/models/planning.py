import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import (
    Boolean,
    DateTime,
    Enum,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.db.models.enums import AutomationAction, AutomationTrigger, TemplateScope


class EntityTemplate(Base):
    """Reusable template for Tasks, Lists, Folders, and Spaces."""

    __tablename__ = "EntityTemplate"

    id: Mapped[str] = mapped_column(
        String, primary_key=True, default=lambda: str(uuid.uuid4())
    )
    workspace_id: Mapped[str] = mapped_column(
        "workspaceId", String, ForeignKey("Workspace.id", ondelete="CASCADE")
    )
    name: Mapped[str] = mapped_column(String)
    description: Mapped[str | None] = mapped_column(String, nullable=True)
    scope: Mapped[TemplateScope] = mapped_column(
        Enum(TemplateScope, name="TemplateScope", native_enum=False), default=TemplateScope.TASK
    )

    category: Mapped[str] = mapped_column(String, default="General")
    template_data: Mapped[dict[str, Any]] = mapped_column(
        "templateData", JSONB, nullable=False, default=dict
    )
    created_by_id: Mapped[str | None] = mapped_column(
        "createdById", String, ForeignKey("User.id", ondelete="SET NULL"), nullable=True
    )
    is_public: Mapped[bool] = mapped_column(
        "isPublic", Boolean, default=True, server_default="true"
    )
    created_at: Mapped[datetime] = mapped_column(
        "createdAt", DateTime(timezone=True), server_default=func.now()
    )

    created_by: Mapped["User | None"] = relationship()


class Portfolio(Base):
    """Portfolio grouping multiple Task Lists and Spaces into a high-level executive dashboard."""

    __tablename__ = "Portfolio"

    id: Mapped[str] = mapped_column(
        String, primary_key=True, default=lambda: str(uuid.uuid4())
    )
    workspace_id: Mapped[str] = mapped_column(
        "workspaceId", String, ForeignKey("Workspace.id", ondelete="CASCADE")
    )
    name: Mapped[str] = mapped_column(String)
    description: Mapped[str | None] = mapped_column(String, nullable=True)
    color: Mapped[str] = mapped_column(String, default="#4194F6")
    created_by_id: Mapped[str | None] = mapped_column(
        "createdById", String, ForeignKey("User.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        "createdAt", DateTime(timezone=True), server_default=func.now()
    )

    created_by: Mapped["User | None"] = relationship()
    lists: Mapped[list["PortfolioList"]] = relationship(
        back_populates="portfolio", cascade="all, delete-orphan"
    )


class PortfolioList(Base):
    """Mapping table linking a Portfolio to a TaskList."""

    __tablename__ = "PortfolioList"

    id: Mapped[str] = mapped_column(
        String, primary_key=True, default=lambda: str(uuid.uuid4())
    )
    portfolio_id: Mapped[str] = mapped_column(
        "portfolioId", String, ForeignKey("Portfolio.id", ondelete="CASCADE")
    )
    list_id: Mapped[str] = mapped_column(
        "listId", String, ForeignKey("TaskList.id", ondelete="CASCADE")
    )
    created_at: Mapped[datetime] = mapped_column(
        "createdAt", DateTime(timezone=True), server_default=func.now()
    )

    portfolio: Mapped["Portfolio"] = relationship(back_populates="lists")
    task_list: Mapped["TaskList"] = relationship()


class TaskAutomationRule(Base):
    """Automation engine rule linking a Trigger to an Action."""

    __tablename__ = "TaskAutomationRule"

    id: Mapped[str] = mapped_column(
        String, primary_key=True, default=lambda: str(uuid.uuid4())
    )
    workspace_id: Mapped[str] = mapped_column(
        "workspaceId", String, ForeignKey("Workspace.id", ondelete="CASCADE")
    )
    space_id: Mapped[str | None] = mapped_column(
        "spaceId", String, ForeignKey("Space.id", ondelete="CASCADE"), nullable=True
    )
    list_id: Mapped[str | None] = mapped_column(
        "listId", String, ForeignKey("TaskList.id", ondelete="CASCADE"), nullable=True
    )
    name: Mapped[str] = mapped_column(String)
    trigger_type: Mapped[AutomationTrigger] = mapped_column(
        "triggerType", Enum(AutomationTrigger, name="AutomationTrigger")
    )
    trigger_config: Mapped[dict[str, Any]] = mapped_column(
        "triggerConfig", JSONB, nullable=False, default=dict
    )
    action_type: Mapped[AutomationAction] = mapped_column(
        "actionType", Enum(AutomationAction, name="AutomationAction")
    )
    action_config: Mapped[dict[str, Any]] = mapped_column(
        "actionConfig", JSONB, nullable=False, default=dict
    )
    is_active: Mapped[bool] = mapped_column(
        "isActive", Boolean, default=True, server_default="true"
    )
    created_at: Mapped[datetime] = mapped_column(
        "createdAt", DateTime(timezone=True), server_default=func.now()
    )


class Whiteboard(Base):
    """Visual Whiteboard diagram canvas persistence."""

    __tablename__ = "Whiteboard"

    id: Mapped[str] = mapped_column(
        String, primary_key=True, default=lambda: str(uuid.uuid4())
    )
    workspace_id: Mapped[str] = mapped_column(
        "workspaceId", String, ForeignKey("Workspace.id", ondelete="CASCADE")
    )
    space_id: Mapped[str | None] = mapped_column(
        "spaceId", String, ForeignKey("Space.id", ondelete="CASCADE"), nullable=True
    )
    name: Mapped[str] = mapped_column(String)
    canvas_data: Mapped[dict[str, Any]] = mapped_column(
        "canvasData", JSONB, nullable=False, default=dict
    )
    created_by_id: Mapped[str | None] = mapped_column(
        "createdById", String, ForeignKey("User.id", ondelete="SET NULL"), nullable=True
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

    created_by: Mapped["User | None"] = relationship()


from app.db.models.home import Space, TaskList  # noqa: E402
from app.db.models.user import User  # noqa: E402
