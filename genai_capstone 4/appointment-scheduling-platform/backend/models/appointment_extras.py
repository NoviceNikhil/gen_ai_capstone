import uuid
from sqlalchemy import Column, String, Text, Numeric, Integer, DateTime, ForeignKey
from sqlalchemy.dialects.mysql import CHAR
from sqlalchemy.sql import func

from config.database import Base


from sqlalchemy.orm import relationship


class AppointmentServiceSelection(Base):
    __tablename__ = "appointment_service_selection"

    id = Column(CHAR(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    appointment_id = Column(CHAR(36), ForeignKey("appointments.id", ondelete="CASCADE"), nullable=False, index=True)
    offering_id = Column(CHAR(36), ForeignKey("service_offerings.id", ondelete="SET NULL"), nullable=True)
    service_title = Column(String(160), nullable=False)
    duration_minutes = Column(Integer, nullable=False)
    service_price_snapshot = Column(Numeric(10, 2), nullable=False)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)


class AppointmentIntakeResponse(Base):
    __tablename__ = "appointment_intake_responses"

    id = Column(CHAR(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    appointment_id = Column(CHAR(36), ForeignKey("appointments.id", ondelete="CASCADE"), nullable=False, index=True)
    form_id = Column(CHAR(36), ForeignKey("provider_intake_forms.id", ondelete="SET NULL"), nullable=True)
    response_json = Column(Text, nullable=False, default="{}")
    created_at = Column(DateTime, server_default=func.now(), nullable=False)


class CommissionLedger(Base):
    __tablename__ = "commission_ledger"

    id = Column(CHAR(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    appointment_id = Column(CHAR(36), ForeignKey("appointments.id", ondelete="CASCADE"), nullable=False, index=True, unique=True)
    gross_amount = Column(Numeric(10, 2), nullable=False, default=0)
    commission_rate = Column(Numeric(5, 4), nullable=False, default=0.1)
    platform_commission_amount = Column(Numeric(10, 2), nullable=False, default=0)
    provider_payout_amount = Column(Numeric(10, 2), nullable=False, default=0)
    
    # ─── Deferred Payment Fields ──────────────────────────────────────────
    payout_scheduled_at = Column(DateTime, nullable=True)  # When to send payment to provider (1 hour after appt)
    payout_status = Column(String(50), nullable=False, default="pending")  # pending, disbursed, failed
    payout_processed_at = Column(DateTime, nullable=True)  # When payment was actually sent
    
    created_at = Column(DateTime, server_default=func.now(), nullable=False)


class Dispute(Base):
    __tablename__ = "disputes"

    id = Column(CHAR(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    appointment_id = Column(CHAR(36), ForeignKey("appointments.id", ondelete="CASCADE"), nullable=False, index=True)
    raised_by = Column(CHAR(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    reason = Column(Text, nullable=False)
    status = Column(String(50), nullable=False, default="pending")  # pending, resolved_refunded, resolved_discharged
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    appointment = relationship("Appointment", foreign_keys=[appointment_id])
    creator = relationship("User", foreign_keys=[raised_by])

