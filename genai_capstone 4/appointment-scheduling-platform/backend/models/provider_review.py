import uuid
from sqlalchemy import Column, Integer, Text, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.dialects.mysql import CHAR
from sqlalchemy.sql import func

from config.database import Base


class ProviderReview(Base):
    __tablename__ = "provider_reviews"
    __table_args__ = (
        UniqueConstraint("appointment_id", name="uq_provider_review_appointment"),
    )

    id = Column(CHAR(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    appointment_id = Column(CHAR(36), ForeignKey("appointments.id", ondelete="CASCADE"), nullable=False, index=True)
    provider_id = Column(CHAR(36), ForeignKey("service_providers.id", ondelete="CASCADE"), nullable=False, index=True)
    customer_id = Column(CHAR(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    rating = Column(Integer, nullable=False)
    comment = Column(Text, nullable=True)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
