import uuid
from sqlalchemy import Column, String, Text, DateTime, ForeignKey, Boolean
from sqlalchemy.dialects.mysql import CHAR
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from config.database import Base


class ProviderOnboarding(Base):
    __tablename__ = "provider_onboarding"

    id = Column(CHAR(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    provider_id = Column(
        CHAR(36),
        ForeignKey("service_providers.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )

    organization_name = Column(String(255), nullable=True)
    owner_name = Column(String(255), nullable=True)
    email = Column(String(255), nullable=True)
    phone = Column(String(20), nullable=True)
    address = Column(Text, nullable=True)
    identity_proof_url = Column(String(500), nullable=True)
    tax_number = Column(String(100), nullable=True)
    bank_details = Column(Text, nullable=True)
    profile_photo_url = Column(String(500), nullable=True)
    certificates_urls = Column(Text, nullable=True)  # comma-separated URLs

    submitted_for_approval = Column(Boolean, nullable=False, default=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
    created_at = Column(DateTime, server_default=func.now())

    provider = relationship("ServiceProvider", back_populates="onboarding")

