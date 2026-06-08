import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class ChatChannel(Base):
    __tablename__ = "ChatChannel"
    __table_args__ = (
        UniqueConstraint("workspaceId", "name", name="ChatChannel_workspaceId_name_key"),
    )

    id: Mapped[str] = mapped_column(
        String, primary_key=True, default=lambda: str(uuid.uuid4())
    )
    workspace_id: Mapped[str] = mapped_column(
        "workspaceId", String, ForeignKey("Workspace.id", ondelete="CASCADE")
    )
    name: Mapped[str] = mapped_column(String)
    topic: Mapped[str | None] = mapped_column(String, nullable=True)
    space_label: Mapped[str | None] = mapped_column("spaceLabel", String, nullable=True)
    is_private: Mapped[bool] = mapped_column("isPrivate", Boolean, default=False)
    custom_icon_color: Mapped[str | None] = mapped_column(
        "customIconColor", String, nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        "createdAt", DateTime(timezone=True), server_default=func.now()
    )
    members: Mapped[list["ChatChannelMember"]] = relationship(back_populates="channel")
    messages: Mapped[list["ChatMessage"]] = relationship(back_populates="channel")


class ChatChannelMember(Base):
    __tablename__ = "ChatChannelMember"

    channel_id: Mapped[str] = mapped_column(
        "channelId",
        String,
        ForeignKey("ChatChannel.id", ondelete="CASCADE"),
        primary_key=True,
    )
    user_id: Mapped[str] = mapped_column(
        "userId",
        String,
        ForeignKey("User.id", ondelete="CASCADE"),
        primary_key=True,
    )
    starred: Mapped[bool] = mapped_column(Boolean, default=False)
    is_following: Mapped[bool] = mapped_column("isFollowing", Boolean, default=True)
    last_read_at: Mapped[datetime | None] = mapped_column(
        "lastReadAt", DateTime(timezone=True), nullable=True
    )
    joined_at: Mapped[datetime] = mapped_column(
        "joinedAt", DateTime(timezone=True), server_default=func.now()
    )
    channel: Mapped["ChatChannel"] = relationship(back_populates="members")
    user: Mapped["User"] = relationship()


class DirectConversation(Base):
    __tablename__ = "DirectConversation"

    id: Mapped[str] = mapped_column(
        String, primary_key=True, default=lambda: str(uuid.uuid4())
    )
    workspace_id: Mapped[str] = mapped_column(
        "workspaceId", String, ForeignKey("Workspace.id", ondelete="CASCADE")
    )
    is_group: Mapped[bool] = mapped_column("isGroup", Boolean, default=False)
    name: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        "createdAt", DateTime(timezone=True), server_default=func.now()
    )
    participants: Mapped[list["DirectParticipant"]] = relationship(
        back_populates="conversation"
    )
    messages: Mapped[list["ChatMessage"]] = relationship(back_populates="conversation")


class DirectParticipant(Base):
    __tablename__ = "DirectParticipant"

    conversation_id: Mapped[str] = mapped_column(
        "conversationId",
        String,
        ForeignKey("DirectConversation.id", ondelete="CASCADE"),
        primary_key=True,
    )
    user_id: Mapped[str] = mapped_column(
        "userId",
        String,
        ForeignKey("User.id", ondelete="CASCADE"),
        primary_key=True,
    )
    starred: Mapped[bool] = mapped_column(Boolean, default=False)
    last_read_at: Mapped[datetime | None] = mapped_column(
        "lastReadAt", DateTime(timezone=True), nullable=True
    )
    joined_at: Mapped[datetime] = mapped_column(
        "joinedAt", DateTime(timezone=True), server_default=func.now()
    )
    conversation: Mapped["DirectConversation"] = relationship(
        back_populates="participants"
    )
    user: Mapped["User"] = relationship()


class ChatMessage(Base):
    __tablename__ = "ChatMessage"

    id: Mapped[str] = mapped_column(
        String, primary_key=True, default=lambda: str(uuid.uuid4())
    )
    workspace_id: Mapped[str] = mapped_column(
        "workspaceId", String, ForeignKey("Workspace.id", ondelete="CASCADE")
    )
    channel_id: Mapped[str | None] = mapped_column(
        "channelId",
        String,
        ForeignKey("ChatChannel.id", ondelete="CASCADE"),
        nullable=True,
    )
    conversation_id: Mapped[str | None] = mapped_column(
        "conversationId",
        String,
        ForeignKey("DirectConversation.id", ondelete="CASCADE"),
        nullable=True,
    )
    parent_id: Mapped[str | None] = mapped_column(
        "parentId",
        String,
        ForeignKey("ChatMessage.id", ondelete="CASCADE"),
        nullable=True,
    )
    author_id: Mapped[str] = mapped_column(
        "authorId", String, ForeignKey("User.id", ondelete="CASCADE")
    )
    body: Mapped[str] = mapped_column(String)
    created_at: Mapped[datetime] = mapped_column(
        "createdAt", DateTime(timezone=True), server_default=func.now()
    )
    channel: Mapped["ChatChannel | None"] = relationship(back_populates="messages")
    conversation: Mapped["DirectConversation | None"] = relationship(
        back_populates="messages"
    )
    parent: Mapped["ChatMessage | None"] = relationship(
        "ChatMessage",
        remote_side="ChatMessage.id",
        back_populates="replies",
        foreign_keys=[parent_id],
    )
    replies: Mapped[list["ChatMessage"]] = relationship(
        "ChatMessage",
        back_populates="parent",
        foreign_keys=[parent_id],
    )
    author: Mapped["User"] = relationship()
    reactions: Mapped[list["MessageReaction"]] = relationship(back_populates="message")
    attachments: Mapped[list["MessageAttachment"]] = relationship(
        back_populates="message"
    )


class MessageAttachment(Base):
    __tablename__ = "MessageAttachment"

    id: Mapped[str] = mapped_column(
        String, primary_key=True, default=lambda: str(uuid.uuid4())
    )
    workspace_id: Mapped[str] = mapped_column(
        "workspaceId", String, ForeignKey("Workspace.id", ondelete="CASCADE")
    )
    message_id: Mapped[str | None] = mapped_column(
        "messageId",
        String,
        ForeignKey("ChatMessage.id", ondelete="CASCADE"),
        nullable=True,
    )
    channel_id: Mapped[str | None] = mapped_column(
        "channelId",
        String,
        ForeignKey("ChatChannel.id", ondelete="CASCADE"),
        nullable=True,
    )
    conversation_id: Mapped[str | None] = mapped_column(
        "conversationId",
        String,
        ForeignKey("DirectConversation.id", ondelete="CASCADE"),
        nullable=True,
    )
    uploader_id: Mapped[str] = mapped_column(
        "uploaderId", String, ForeignKey("User.id", ondelete="CASCADE")
    )
    storage_key: Mapped[str] = mapped_column("storageKey", String)
    file_name: Mapped[str] = mapped_column("fileName", String)
    mime_type: Mapped[str] = mapped_column("mimeType", String)
    size_bytes: Mapped[int] = mapped_column("sizeBytes")
    kind: Mapped[str] = mapped_column(String, default="file")
    status: Mapped[str] = mapped_column(String, default="pending")
    created_at: Mapped[datetime] = mapped_column(
        "createdAt", DateTime(timezone=True), server_default=func.now()
    )
    message: Mapped["ChatMessage | None"] = relationship(back_populates="attachments")
    uploader: Mapped["User"] = relationship()


class MessageReaction(Base):
    __tablename__ = "MessageReaction"
    __table_args__ = (
        UniqueConstraint(
            "messageId",
            "userId",
            "emoji",
            name="MessageReaction_messageId_userId_emoji_key",
        ),
    )

    id: Mapped[str] = mapped_column(
        String, primary_key=True, default=lambda: str(uuid.uuid4())
    )
    message_id: Mapped[str] = mapped_column(
        "messageId", String, ForeignKey("ChatMessage.id", ondelete="CASCADE")
    )
    user_id: Mapped[str] = mapped_column(
        "userId", String, ForeignKey("User.id", ondelete="CASCADE")
    )
    emoji: Mapped[str] = mapped_column(String)
    message: Mapped["ChatMessage"] = relationship(back_populates="reactions")
    user: Mapped["User"] = relationship()


from app.db.models.user import User  # noqa: E402
