import uuid
from sqlalchemy import (
    Column, String, Text, Boolean, Numeric, Integer,
    ForeignKey, DateTime, Date, Enum as SAEnum,
)
from sqlalchemy.dialects.mysql import CHAR
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from config.database import Base
from models.mixins import SoftDeleteMixin


class Appointment(Base, SoftDeleteMixin):
    __tablename__ = "appointments"

    id = Column(CHAR(36), primary_key=True, default=lambda: str(uuid.uuid4()))

    # ─── Participants ─────────────────────────────────────────────────────────
    customer_id = Column(CHAR(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    provider_id = Column(CHAR(36), ForeignKey("service_providers.id", ondelete="CASCADE"), nullable=False)
    category_id = Column(Integer, ForeignKey("categories.id", ondelete="SET NULL"), nullable=True)

    # ─── Scheduling ───────────────────────────────────────────────────────────
    appointment_date = Column(Date, nullable=False)
    time_slot = Column(String(10), nullable=False, comment="e.g. '10:00', '14:30'")

    # ─── FSM Status ───────────────────────────────────────────────────────────
    # pending → confirmed | cancelled
    # confirmed → completed | cancelled
    # completed / cancelled → terminal
    status = Column(
        SAEnum("pending", "confirmed", "completed", "cancelled", name="appt_status_enum"),
        nullable=False,
        default="pending",
    )

    # ─── Notes ────────────────────────────────────────────────────────────────
    notes = Column(Text, nullable=True)
    cancellation_reason = Column(Text, nullable=True)

    # ─── Payment ──────────────────────────────────────────────────────────────
    is_paid = Column(Boolean, nullable=False, default=False)
    razorpay_order_id = Column(String(100), nullable=True)
    razorpay_payment_id = Column(String(100), nullable=True)
    consultation_fee_snapshot = Column(Numeric(10, 2), nullable=True, comment="Fee at time of booking")
    penalty_fee_amount = Column(Numeric(10, 2), nullable=False, default=0.0)
    penalty_reason = Column(String(50), nullable=True, comment="late_cancel | no_show")

    # ─── Timestamps ───────────────────────────────────────────────────────────
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    # ─── Relationships ────────────────────────────────────────────────────────
    customer = relationship("User", foreign_keys=[customer_id], back_populates="appointments_as_customer")
    provider = relationship("ServiceProvider", foreign_keys=[provider_id], back_populates="appointments")
    category = relationship("Category")
    history = relationship(
        "AppointmentHistory",
        back_populates="appointment",
        cascade="all, delete-orphan",
        order_by="AppointmentHistory.created_at",
    )
    reschedule_requests = relationship(
        "AppointmentRescheduleRequest",
        back_populates="appointment",
        cascade="all, delete-orphan",
        order_by="AppointmentRescheduleRequest.created_at.desc()",
    )
    service_selections = relationship(
        "AppointmentServiceSelection",
        cascade="all, delete-orphan",
        primaryjoin="Appointment.id == foreign(AppointmentServiceSelection.appointment_id)",
    )
