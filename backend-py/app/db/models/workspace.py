import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, String, func
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
    # Per-member overrides for Guest / Limited Member (ClickUp's "individual
    # permissions": time estimates + time tracking). Default True for
    # everyone so this is a no-op unless an admin explicitly toggles it off
    # for a Guest/Limited Member.
    can_see_time_estimate: Mapped[bool] = mapped_column(
        "canSeeTimeEstimate", Boolean, default=True, server_default="true"
    )
    can_track_time: Mapped[bool] = mapped_column(
        "canTrackTime", Boolean, default=True, server_default="true"
    )
    joined_at: Mapped[datetime] = mapped_column(
        "joinedAt", DateTime(timezone=True), server_default=func.now()
    )

    workspace: Mapped["Workspace"] = relationship(back_populates="members")
    user: Mapped["User"] = relationship(back_populates="memberships")
