import uuid
from sqlalchemy import (
    Column, String, Integer, Boolean, Text, Enum as SAEnum,
    ForeignKey, DateTime,
)
from sqlalchemy.dialects.mysql import CHAR
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from config.database import Base


class Organization(Base):
    __tablename__ = "organizations"

    id = Column(CHAR(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String(200), nullable=False, unique=True)
    description = Column(Text, nullable=True)
    location = Column(String(300), nullable=True)
    logo_url = Column(String(500), nullable=True)
    
    # ─── Admin/Contact Information ────────────────────────────────────────────
    admin_user_id = Column(CHAR(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    contact_email = Column(String(255), nullable=True)
    contact_phone = Column(String(20), nullable=True)
    
    # ─── Status & Approval ────────────────────────────────────────────────────
    is_active = Column(Boolean, nullable=False, default=True)
    is_approved = Column(Boolean, nullable=False, default=False)
    approval_status = Column(
        SAEnum("pending", "approved", "rejected", name="org_approval_status_enum"),
        nullable=False,
        default="pending",
    )

    # ─── Onboarding ───────────────────────────────────────────────────────────
    onboarding_completed = Column(Boolean, nullable=False, default=False)
    org_type = Column(String(100), nullable=True, comment="Type of organisation e.g. Hospital, Salon, Startup")
    address = Column(Text, nullable=True)
    state = Column(String(100), nullable=True)
    city = Column(String(100), nullable=True)
    pincode = Column(String(10), nullable=True)
    num_employees = Column(Integer, nullable=True)
    tax_number = Column(String(100), nullable=True)
    bank_details = Column(Text, nullable=True)
    identity_doc_url = Column(String(500), nullable=True)

    # ─── Metadata ─────────────────────────────────────────────────────────────
    metadata_json = Column(Text, nullable=True, comment="Additional JSON metadata (office count, departments, etc.)")
    
    # ─── Timestamps ───────────────────────────────────────────────────────────
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    # ─── Relationships ────────────────────────────────────────────────────────
    admin = relationship("User", foreign_keys=[admin_user_id])
    providers = relationship("ServiceProvider", back_populates="organization")
    requests = relationship("OrganizationRequest", back_populates="organization", cascade="all, delete-orphan")


class OrganizationRequest(Base):
    __tablename__ = "organization_requests"

    id = Column(CHAR(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    organization_id = Column(CHAR(36), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    
    # ─── Request Metadata ─────────────────────────────────────────────────────
    request_type = Column(
        SAEnum("create", "update", name="org_request_type_enum"),
        nullable=False,
        default="create",
    )
    status = Column(
        SAEnum("pending", "approved", "rejected", name="org_request_status_enum"),
        nullable=False,
        default="pending",
    )
    
    # ─── Request Details ──────────────────────────────────────────────────────
    requested_by = Column(CHAR(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    approved_by = Column(CHAR(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    
    requested_changes = Column(Text, nullable=True, comment="JSON of proposed changes")
    approval_notes = Column(Text, nullable=True, comment="Admin notes for approval/rejection")
    
    # ─── Timestamps ───────────────────────────────────────────────────────────
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    # ─── Relationships ────────────────────────────────────────────────────────
    organization = relationship("Organization", back_populates="requests")
    requester = relationship("User", foreign_keys=[requested_by])
    approver = relationship("User", foreign_keys=[approved_by])


class OrganizationJoinRequest(Base):
    __tablename__ = "organization_join_requests"

    id = Column(CHAR(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    organization_id = Column(CHAR(36), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    provider_id = Column(CHAR(36), ForeignKey("service_providers.id", ondelete="CASCADE"), nullable=False)
    
    status = Column(
        SAEnum("pending", "approved", "rejected", name="org_join_request_status_enum"),
        nullable=False,
        default="pending",
    )
    
    approved_by = Column(CHAR(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    approval_notes = Column(Text, nullable=True)
    
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
    
    organization = relationship("Organization")
    provider = relationship("ServiceProvider")
    approver = relationship("User", foreign_keys=[approved_by])
