import uuid
from sqlalchemy import Column, String, DateTime, Date, ForeignKey, Enum as SAEnum
from sqlalchemy.dialects.mysql import CHAR
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from config.database import Base

class AppointmentRescheduleRequest(Base):
    __tablename__ = "appointment_reschedule_requests"

    id = Column(CHAR(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    appointment_id = Column(CHAR(36), ForeignKey("appointments.id", ondelete="CASCADE"), nullable=False)
    requested_by = Column(SAEnum("customer", "provider", name="reschedule_requester_enum"), nullable=False)
    proposed_date = Column(Date, nullable=False)
    proposed_time_slot = Column(String(10), nullable=False)
    status = Column(SAEnum("pending", "approved", "rejected", "expired", name="reschedule_status_enum"), nullable=False, default="pending")
    
    created_at = Column(DateTime, server_default=func.now())
    expires_at = Column(DateTime, nullable=True)

    appointment = relationship("Appointment")
