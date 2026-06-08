import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class OAuthAccount(Base):
    __tablename__ = "OAuthAccount"
    __table_args__ = (
        UniqueConstraint("provider", "providerUserId", name="OAuthAccount_provider_user_key"),
    )

    id: Mapped[str] = mapped_column(
        String, primary_key=True, default=lambda: str(uuid.uuid4())
    )
    provider: Mapped[str] = mapped_column(String)
    provider_user_id: Mapped[str] = mapped_column("providerUserId", String)
    user_id: Mapped[str] = mapped_column(
        "userId", String, ForeignKey("User.id", ondelete="CASCADE")
    )
    created_at: Mapped[datetime] = mapped_column(
        "createdAt", DateTime(timezone=True), server_default=func.now()
    )
    user: Mapped["User"] = relationship("User", back_populates="oauth_accounts")


class OAuthState(Base):
    """Short-lived PKCE + redirect state for Google OAuth."""

    __tablename__ = "OAuthState"

    state: Mapped[str] = mapped_column(String, primary_key=True)
    code_verifier: Mapped[str] = mapped_column("codeVerifier", String)
    next_path: Mapped[str] = mapped_column("nextPath", String, default="/home/inbox")
    expires_at: Mapped[datetime] = mapped_column("expiresAt", DateTime(timezone=True))


class OAuthExchange(Base):
    """One-time code exchanged by the frontend for JWT + refresh cookie."""

    __tablename__ = "OAuthExchange"

    code: Mapped[str] = mapped_column(String, primary_key=True)
    user_id: Mapped[str] = mapped_column(
        "userId", String, ForeignKey("User.id", ondelete="CASCADE")
    )
    expires_at: Mapped[datetime] = mapped_column("expiresAt", DateTime(timezone=True))
    used_at: Mapped[datetime | None] = mapped_column(
        "usedAt", DateTime(timezone=True), nullable=True
    )


from app.db.models.user import User  # noqa: E402
