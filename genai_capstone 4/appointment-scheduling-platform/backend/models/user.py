import uuid
from sqlalchemy import Column, String, Boolean, DateTime, Enum as SAEnum
from sqlalchemy.dialects.mysql import CHAR
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from config.database import Base
from models.mixins import SoftDeleteMixin


class User(Base, SoftDeleteMixin):
    __tablename__ = "users"

    id = Column(CHAR(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    full_name = Column(String(150), nullable=False)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=True)
    phone = Column(String(20), nullable=True)
    auth_provider = Column(String(50), nullable=False, default="local")
    oauth_id = Column(String(255), nullable=True, unique=True)
    role = Column(
        SAEnum("customer", "provider", "admin", "organization", name="user_role_enum"),
        nullable=False,
        default="customer",
    )
    is_active = Column(Boolean, nullable=False, default=False)  # requires OTP verify

    # ─── OTP fields ──────────────────────────────────────────────────────────
    otp_hash = Column(String(255), nullable=True)
    otp_expiry = Column(DateTime, nullable=True)

    # ─── Timestamps ──────────────────────────────────────────────────────────
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    # ─── Relationships ────────────────────────────────────────────────────────
    provider_profile = relationship(
        "ServiceProvider", back_populates="user", uselist=False, cascade="all, delete-orphan"
    )
    appointments_as_customer = relationship(
        "Appointment", foreign_keys="Appointment.customer_id", back_populates="customer"
    )
