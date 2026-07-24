import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.db.models.enums import WorkspaceRole


class Invite(Base):
    __tablename__ = "Invite"

    id: Mapped[str] = mapped_column(
        String, primary_key=True, default=lambda: str(uuid.uuid4())
    )
    workspace_id: Mapped[str] = mapped_column(
        "workspaceId", String, ForeignKey("Workspace.id", ondelete="CASCADE")
    )
    email: Mapped[str] = mapped_column(String, nullable=False)
    role: Mapped[WorkspaceRole] = mapped_column(
        Enum(WorkspaceRole, name="WorkspaceRole"), default=WorkspaceRole.MEMBER
    )
    token: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    expires_at: Mapped[datetime] = mapped_column("expiresAt", DateTime(timezone=True))
    accepted_at: Mapped[datetime | None] = mapped_column(
        "acceptedAt", DateTime(timezone=True), nullable=True
    )
    cancelled_at: Mapped[datetime | None] = mapped_column(
        "cancelledAt", DateTime(timezone=True), nullable=True
    )
    invited_by_id: Mapped[str] = mapped_column(
        "invitedById", String, ForeignKey("User.id", ondelete="CASCADE")
    )
    created_at: Mapped[datetime] = mapped_column(
        "createdAt", DateTime(timezone=True), server_default=func.now()
    )
    # Delivery outcome of the (fire-and-forget) invite email: "sent" when the
    # background send succeeded, "failed" when it raised. NULL when no email was
    # attempted (SMTP not configured). Surfaced to admins as an "Failed" tag.
    email_status: Mapped[str | None] = mapped_column(
        "emailStatus", String, nullable=True
    )

    workspace: Mapped["Workspace"] = relationship(back_populates="invites")
    inviter: Mapped["User"] = relationship(foreign_keys=[invited_by_id])
