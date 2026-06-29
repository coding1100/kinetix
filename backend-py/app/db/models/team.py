import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.db.models.enums import TeamRole


class Team(Base):
    __tablename__ = "Team"

    id: Mapped[str] = mapped_column(
        String, primary_key=True, default=lambda: str(uuid.uuid4())
    )
    workspace_id: Mapped[str] = mapped_column(
        "workspaceId", String, ForeignKey("Workspace.id", ondelete="CASCADE")
    )
    name: Mapped[str] = mapped_column(String, nullable=False)
    color: Mapped[str] = mapped_column(String, default="#7B68EE")
    icon: Mapped[str | None] = mapped_column(String, nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_by_id: Mapped[str] = mapped_column(
        "createdById", String, ForeignKey("User.id", ondelete="SET NULL"), nullable=True
    )
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

    workspace: Mapped["Workspace"] = relationship(back_populates="teams")
    created_by: Mapped["User | None"] = relationship(foreign_keys=[created_by_id])
    members: Mapped[list["TeamMember"]] = relationship(
        back_populates="team",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )


class TeamMember(Base):
    __tablename__ = "TeamMember"
    __table_args__ = (
        UniqueConstraint("teamId", "userId", name="TeamMember_teamId_userId_key"),
    )

    id: Mapped[str] = mapped_column(
        String, primary_key=True, default=lambda: str(uuid.uuid4())
    )
    team_id: Mapped[str] = mapped_column(
        "teamId", String, ForeignKey("Team.id", ondelete="CASCADE")
    )
    user_id: Mapped[str] = mapped_column(
        "userId", String, ForeignKey("User.id", ondelete="CASCADE")
    )
    role: Mapped[TeamRole] = mapped_column(
        Enum(TeamRole, name="TeamRole"), default=TeamRole.MEMBER
    )
    joined_at: Mapped[datetime] = mapped_column(
        "joinedAt", DateTime(timezone=True), server_default=func.now()
    )

    team: Mapped["Team"] = relationship(back_populates="members")
    user: Mapped["User"] = relationship()
