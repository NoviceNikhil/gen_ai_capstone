import uuid
from sqlalchemy import (
    Column, String, Text, Enum as SAEnum,
    ForeignKey, DateTime,
)
from sqlalchemy.dialects.mysql import CHAR
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from config.database import Base


class ProviderApprovalRequest(Base):
    __tablename__ = "provider_approval_requests"

    id = Column(CHAR(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    provider_id = Column(CHAR(36), ForeignKey("service_providers.id", ondelete="CASCADE"), nullable=False, unique=True)
    
    # ─── Status ───────────────────────────────────────────────────────────────
    status = Column(
        SAEnum("pending", "approved", "rejected", name="provider_approval_request_status_enum"),
        nullable=False,
        default="pending",
    )
    
    # ─── Approval Details ────────────────────────────────────────────────────
    approved_by = Column(CHAR(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    approval_notes = Column(Text, nullable=True, comment="Admin notes for approval/rejection")
    
    # ─── Timestamps ───────────────────────────────────────────────────────────
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
    approved_at = Column(DateTime, nullable=True)

    # ─── Relationships ────────────────────────────────────────────────────────
    provider = relationship("ServiceProvider", foreign_keys=[provider_id])
    approver = relationship("User", foreign_keys=[approved_by])
