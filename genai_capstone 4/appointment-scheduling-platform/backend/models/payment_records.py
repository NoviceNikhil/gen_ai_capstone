import uuid
from sqlalchemy import Column, String, Numeric, DateTime, ForeignKey
from sqlalchemy.dialects.mysql import CHAR
from sqlalchemy.sql import func

from config.database import Base


class PaymentRecord(Base):
    __tablename__ = "payment_records"

    id = Column(CHAR(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    appointment_id = Column(CHAR(36), ForeignKey("appointments.id", ondelete="CASCADE"), nullable=False, index=True)
    customer_id = Column(CHAR(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    amount = Column(Numeric(10, 2), nullable=False, default=0.0)
    status = Column(String(50), nullable=False, default="paid")  # paid, failed, refunded, partially_refunded, no_refund
    razorpay_order_id = Column(String(100), nullable=True)
    razorpay_payment_id = Column(String(100), nullable=True)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)


class RefundRecord(Base):
    __tablename__ = "refund_records"

    id = Column(CHAR(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    payment_record_id = Column(CHAR(36), ForeignKey("payment_records.id", ondelete="SET NULL"), nullable=True, index=True)
    appointment_id = Column(CHAR(36), ForeignKey("appointments.id", ondelete="CASCADE"), nullable=False, index=True)
    customer_id = Column(CHAR(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    amount = Column(Numeric(10, 2), nullable=False, default=0.0)
    penalty_deducted = Column(Numeric(10, 2), nullable=False, default=0.0)
    reason = Column(String(100), nullable=True)
    status = Column(String(50), nullable=False, default="processed")  # processed, failed
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
