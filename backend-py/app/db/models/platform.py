import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, String, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.db.models.enums import PlatformRole


class PlatformStaff(Base):
    __tablename__ = "PlatformStaff"

    id: Mapped[str] = mapped_column(
        String, primary_key=True, default=lambda: str(uuid.uuid4())
    )
    user_id: Mapped[str] = mapped_column(
        "userId", String, ForeignKey("User.id", ondelete="CASCADE"), unique=True
    )
    role: Mapped[PlatformRole] = mapped_column(
        Enum(PlatformRole, name="PlatformRole"), default=PlatformRole.STAFF
    )
    granted_by: Mapped[str | None] = mapped_column(
        "grantedBy", String, ForeignKey("User.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        "createdAt", DateTime(timezone=True), server_default=func.now()
    )

    user: Mapped["User"] = relationship(foreign_keys=[user_id])


class AdminAuditLog(Base):
    __tablename__ = "AdminAuditLog"

    id: Mapped[str] = mapped_column(
        String, primary_key=True, default=lambda: str(uuid.uuid4())
    )
    actor_user_id: Mapped[str] = mapped_column(
        "actorUserId", String, ForeignKey("User.id", ondelete="CASCADE")
    )
    action: Mapped[str] = mapped_column(String, nullable=False)
    target_type: Mapped[str] = mapped_column("targetType", String, nullable=False)
    target_id: Mapped[str] = mapped_column("targetId", String, nullable=False)
    metadata_json: Mapped[dict | None] = mapped_column("metadata", JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        "createdAt", DateTime(timezone=True), server_default=func.now()
    )

    actor: Mapped["User"] = relationship(foreign_keys=[actor_user_id])
