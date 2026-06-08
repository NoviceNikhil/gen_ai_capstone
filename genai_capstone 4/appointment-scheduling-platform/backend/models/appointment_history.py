import uuid
from sqlalchemy import Column, String, Text, ForeignKey, DateTime, Enum as SAEnum
from sqlalchemy.dialects.mysql import CHAR
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from config.database import Base


class AppointmentHistory(Base):
    __tablename__ = "appointment_history"

    id = Column(CHAR(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    appointment_id = Column(
        CHAR(36), ForeignKey("appointments.id", ondelete="CASCADE"), nullable=False
    )

    previous_status = Column(
        SAEnum("pending", "confirmed", "completed", "cancelled", name="hist_prev_status"),
        nullable=False,
    )
    new_status = Column(
        SAEnum("pending", "confirmed", "completed", "cancelled", name="hist_new_status"),
        nullable=False,
    )

    # Who triggered the status change: customer_id, provider_id, or "system"
    changed_by = Column(String(100), nullable=True)
    notes = Column(Text, nullable=True)

    created_at = Column(DateTime, server_default=func.now())

    # ─── Relationships ────────────────────────────────────────────────────────
    appointment = relationship("Appointment", back_populates="history")
