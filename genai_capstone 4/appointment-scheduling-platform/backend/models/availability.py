import uuid
from sqlalchemy import Column, String, Integer, Boolean, Time, Date, ForeignKey, DateTime, Index
from sqlalchemy.dialects.mysql import CHAR
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from config.database import Base


class Availability(Base):
    __tablename__ = "availability_slots"

    id = Column(CHAR(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    provider_id = Column(CHAR(36), ForeignKey("service_providers.id", ondelete="CASCADE"), nullable=False, index=True)

    # ─── Schedule definition ──────────────────────────────────────────────────
    # day_of_week: 0=Monday ... 6=Sunday (nullable for date-specific slots)
    day_of_week = Column(Integer, nullable=True, comment="0=Monday, 6=Sunday. Null if specific_date is set")
    
    # specific_date: for one-time slots (nullable for recurring slots)
    specific_date = Column(Date, nullable=True, comment="If set, this is a one-time slot for this date")
    
    start_time = Column(Time, nullable=False)
    end_time = Column(Time, nullable=False)
    slot_duration_minutes = Column(Integer, nullable=False, default=30)

    is_active = Column(Boolean, nullable=False, default=True)

    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    # ─── Indexes ──────────────────────────────────────────────────────────────
    __table_args__ = (
        Index("idx_provider_specific_date", "provider_id", "specific_date"),
        Index("idx_provider_day_of_week", "provider_id", "day_of_week"),
    )

    # ─── Relationships ────────────────────────────────────────────────────────
    provider = relationship("ServiceProvider", back_populates="availability_slots")
