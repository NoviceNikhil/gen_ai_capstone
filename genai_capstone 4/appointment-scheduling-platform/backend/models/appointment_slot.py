import uuid
from sqlalchemy import Column, String, Date, Boolean, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.dialects.mysql import CHAR
from sqlalchemy.sql import func

from config.database import Base
from models.mixins import SoftDeleteMixin


class AppointmentSlot(Base, SoftDeleteMixin):
    __tablename__ = "appointment_slots"
    __table_args__ = (
        UniqueConstraint("provider_id", "slot_date", "time_slot", name="uq_provider_slot_date_time"),
    )

    id = Column(CHAR(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    provider_id = Column(CHAR(36), ForeignKey("service_providers.id", ondelete="CASCADE"), nullable=False, index=True)
    slot_date = Column(Date, nullable=False, index=True)
    time_slot = Column(String(10), nullable=False)
    is_booked = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
