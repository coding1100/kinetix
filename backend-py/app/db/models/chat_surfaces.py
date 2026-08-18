import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class ChatChannelCanvas(Base):
    __tablename__ = "ChatChannelCanvas"
    __table_args__ = (
        UniqueConstraint("channelId", name="ChatChannelCanvas_channelId_key"),
    )

    id: Mapped[str] = mapped_column(
        String, primary_key=True, default=lambda: str(uuid.uuid4())
    )
    workspace_id: Mapped[str] = mapped_column(
        "workspaceId", String, ForeignKey("Workspace.id", ondelete="CASCADE")
    )
    channel_id: Mapped[str] = mapped_column(
        "channelId",
        String,
        ForeignKey("ChatChannel.id", ondelete="CASCADE"),
    )
    title: Mapped[str] = mapped_column(String, default="Canvas")
    body: Mapped[str] = mapped_column(Text, default="")
    revision: Mapped[int] = mapped_column(Integer, default=1)
    created_at: Mapped[datetime] = mapped_column(
        "createdAt", DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        "updatedAt", DateTime(timezone=True), server_default=func.now()
    )
    updated_by_id: Mapped[str | None] = mapped_column(
        "updatedById",
        String,
        ForeignKey("User.id", ondelete="SET NULL"),
        nullable=True,
    )
    channel: Mapped["ChatChannel"] = relationship()
    updated_by: Mapped["User | None"] = relationship()


class ChatHuddle(Base):
    __tablename__ = "ChatHuddle"

    id: Mapped[str] = mapped_column(
        String, primary_key=True, default=lambda: str(uuid.uuid4())
    )
    workspace_id: Mapped[str] = mapped_column(
        "workspaceId", String, ForeignKey("Workspace.id", ondelete="CASCADE")
    )
    channel_id: Mapped[str] = mapped_column(
        "channelId",
        String,
        ForeignKey("ChatChannel.id", ondelete="CASCADE"),
    )
    title: Mapped[str] = mapped_column(String, default="Live huddle")
    notes: Mapped[str] = mapped_column(Text, default="")
    is_active: Mapped[bool] = mapped_column("isActive", Boolean, default=True)
    started_at: Mapped[datetime] = mapped_column(
        "startedAt", DateTime(timezone=True), server_default=func.now()
    )
    ended_at: Mapped[datetime | None] = mapped_column(
        "endedAt", DateTime(timezone=True), nullable=True
    )
    started_by_id: Mapped[str | None] = mapped_column(
        "startedById",
        String,
        ForeignKey("User.id", ondelete="SET NULL"),
        nullable=True,
    )
    ended_by_id: Mapped[str | None] = mapped_column(
        "endedById",
        String,
        ForeignKey("User.id", ondelete="SET NULL"),
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        "createdAt", DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        "updatedAt", DateTime(timezone=True), server_default=func.now()
    )
    channel: Mapped["ChatChannel"] = relationship()
    started_by: Mapped["User | None"] = relationship(
        foreign_keys=[started_by_id]
    )
    ended_by: Mapped["User | None"] = relationship(
        foreign_keys=[ended_by_id]
    )
    participants: Mapped[list["ChatHuddleParticipant"]] = relationship(
        back_populates="huddle", cascade="all, delete-orphan"
    )


class ChatHuddleParticipant(Base):
    __tablename__ = "ChatHuddleParticipant"
    __table_args__ = (
        UniqueConstraint("huddleId", "userId", name="ChatHuddleParticipant_key"),
    )

    id: Mapped[str] = mapped_column(
        String, primary_key=True, default=lambda: str(uuid.uuid4())
    )
    huddle_id: Mapped[str] = mapped_column(
        "huddleId",
        String,
        ForeignKey("ChatHuddle.id", ondelete="CASCADE"),
    )
    user_id: Mapped[str] = mapped_column(
        "userId",
        String,
        ForeignKey("User.id", ondelete="CASCADE"),
    )
    joined_at: Mapped[datetime] = mapped_column(
        "joinedAt", DateTime(timezone=True), server_default=func.now()
    )
    left_at: Mapped[datetime | None] = mapped_column(
        "leftAt", DateTime(timezone=True), nullable=True
    )
    is_muted: Mapped[bool] = mapped_column("isMuted", Boolean, default=False)
    huddle: Mapped["ChatHuddle"] = relationship(back_populates="participants")
    user: Mapped["User"] = relationship()


from app.db.models.chat import ChatChannel  # noqa: E402
from app.db.models.user import User  # noqa: E402
