import uuid
from datetime import datetime, timezone

from sqlalchemy import JSON, Column, DateTime, ForeignKey, String, Text
from sqlalchemy.orm import relationship

from app.db.base import Base


def _uuid() -> str:
    return str(uuid.uuid4())


def _now() -> datetime:
    return datetime.now(timezone.utc)


class CompanyDocument(Base):
    __tablename__ = "company_documents"

    id = Column(String, primary_key=True, default=_uuid)
    workspace_id = Column(
        String, ForeignKey("Workspace.id", ondelete="CASCADE"), nullable=False, index=True
    )
    title = Column(String(255), nullable=False)
    category = Column(String(100), nullable=False, default="General")
    file_path = Column(String(500), nullable=True)
    file_type = Column(String(50), nullable=False, default="text")
    created_by_id = Column(
        String, ForeignKey("User.id", ondelete="SET NULL"), nullable=True
    )
    created_at = Column(DateTime(timezone=True), nullable=False, default=_now)
    updated_at = Column(
        DateTime(timezone=True), nullable=False, default=_now, onupdate=_now
    )

    chunks = relationship(
        "CompanyDocumentChunk", back_populates="document", cascade="all, delete-orphan"
    )


class CompanyDocumentChunk(Base):
    __tablename__ = "company_document_chunks"

    id = Column(String, primary_key=True, default=_uuid)
    document_id = Column(
        String, ForeignKey("company_documents.id", ondelete="CASCADE"), nullable=False, index=True
    )
    chunk_index = Column(JSON, nullable=False)
    content = Column(Text, nullable=False)
    embedding = Column(JSON, nullable=True)
    metadata_json = Column(JSON, nullable=True)

    document = relationship("CompanyDocument", back_populates="chunks")
