import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.db.models.enums import MemberStatus, WorkspaceRole


class Workspace(Base):
    __tablename__ = "Workspace"

    id: Mapped[str] = mapped_column(
        String, primary_key=True, default=lambda: str(uuid.uuid4())
    )
    name: Mapped[str] = mapped_column(String, nullable=False)
    slug: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        "createdAt",
        DateTime(timezone=True),
        server_default=func.now(),
        default=func.now(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        "updatedAt",
        DateTime(timezone=True),
        server_default=func.now(),
        default=func.now(),
        onupdate=func.now(),
    )

    members: Mapped[list["WorkspaceMember"]] = relationship(back_populates="workspace")
    invites: Mapped[list["Invite"]] = relationship(back_populates="workspace")
    teams: Mapped[list["Team"]] = relationship(back_populates="workspace")


class WorkspaceMember(Base):
    __tablename__ = "WorkspaceMember"

    id: Mapped[str] = mapped_column(
        String, primary_key=True, default=lambda: str(uuid.uuid4())
    )
    workspace_id: Mapped[str] = mapped_column(
        "workspaceId", String, ForeignKey("Workspace.id", ondelete="CASCADE")
    )
    user_id: Mapped[str] = mapped_column(
        "userId", String, ForeignKey("User.id", ondelete="CASCADE")
    )
    role: Mapped[WorkspaceRole] = mapped_column(
        Enum(WorkspaceRole, name="WorkspaceRole"), default=WorkspaceRole.MEMBER
    )
    status: Mapped[MemberStatus] = mapped_column(
        Enum(MemberStatus, name="MemberStatus"), default=MemberStatus.ACTIVE
    )
    joined_at: Mapped[datetime] = mapped_column(
        "joinedAt", DateTime(timezone=True), server_default=func.now()
    )

    workspace: Mapped["Workspace"] = relationship(back_populates="members")
    user: Mapped["User"] = relationship(back_populates="memberships")
