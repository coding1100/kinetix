import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class User(Base):
    __tablename__ = "User"

    id: Mapped[str] = mapped_column(
        String, primary_key=True, default=lambda: str(uuid.uuid4())
    )
    email: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    password_hash: Mapped[str | None] = mapped_column(
        "passwordHash", String, nullable=True
    )
    full_name: Mapped[str] = mapped_column("fullName", String, nullable=False)
    avatar_url: Mapped[str | None] = mapped_column("avatarUrl", String, nullable=True)
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

    memberships: Mapped[list["WorkspaceMember"]] = relationship(back_populates="user")
    refresh_tokens: Mapped[list["RefreshToken"]] = relationship(back_populates="user")
    oauth_accounts: Mapped[list["OAuthAccount"]] = relationship(
        "OAuthAccount", back_populates="user"
    )


class RefreshToken(Base):
    __tablename__ = "RefreshToken"

    id: Mapped[str] = mapped_column(
        String, primary_key=True, default=lambda: str(uuid.uuid4())
    )
    user_id: Mapped[str] = mapped_column(
        "userId", String, ForeignKey("User.id", ondelete="CASCADE")
    )
    token_hash: Mapped[str] = mapped_column("tokenHash", String, unique=True, nullable=False)
    expires_at: Mapped[datetime] = mapped_column("expiresAt", DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(
        "createdAt", DateTime(timezone=True), server_default=func.now()
    )

    user: Mapped["User"] = relationship(back_populates="refresh_tokens")


class PasswordResetToken(Base):
    __tablename__ = "PasswordResetToken"

    id: Mapped[str] = mapped_column(
        String, primary_key=True, default=lambda: str(uuid.uuid4())
    )
    user_id: Mapped[str] = mapped_column(
        "userId", String, ForeignKey("User.id", ondelete="CASCADE")
    )
    token_hash: Mapped[str] = mapped_column("tokenHash", String, unique=True, nullable=False)
    expires_at: Mapped[datetime] = mapped_column("expiresAt", DateTime(timezone=True))
    used_at: Mapped[datetime | None] = mapped_column(
        "usedAt", DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        "createdAt", DateTime(timezone=True), server_default=func.now()
    )

    user: Mapped["User"] = relationship()
