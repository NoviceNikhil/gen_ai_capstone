import uuid
import enum
from sqlalchemy import (
    Column, String, Integer, Boolean, Text, Numeric,
    ForeignKey, DateTime, Enum as SQLEnum
)
from sqlalchemy.dialects.mysql import CHAR
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from config.database import Base


class IndianState(str, enum.Enum):
    KARNATAKA = "Karnataka"
    MAHARASHTRA = "Maharashtra"
    TAMIL_NADU = "Tamil Nadu"
    TELANGANA = "Telangana"
    DELHI = "Delhi"
    GUJARAT = "Gujarat"
    RAJASTHAN = "Rajasthan"
    WEST_BENGAL = "West Bengal"
    KERALA = "Kerala"


class IndianCity(str, enum.Enum):
    BENGALURU = "Bengaluru"
    MUMBAI = "Mumbai"
    KOCHI = "Kochi"
    PUNE = "Pune"
    HYDERABAD = "Hyderabad"
    DELHI = "Delhi"
    AHMEDABAD = "Ahmedabad"
    CHENNAI = "Chennai"
    JAIPUR = "Jaipur"
    KOLKATA = "Kolkata"
    SURAT = "Surat"


class ServiceProvider(Base):
    __tablename__ = "service_providers"

    id = Column(CHAR(36), primary_key=True, default=lambda: str(uuid.uuid4()))

    # ─── FK to User ──────────────────────────────────────────────────────────
    user_id = Column(CHAR(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True)
    category_id = Column(Integer, ForeignKey("categories.id", ondelete="SET NULL"), nullable=True)
    organization_id = Column(CHAR(36), ForeignKey("organizations.id", ondelete="SET NULL"), nullable=True)

    # ─── Professional details ─────────────────────────────────────────────────
    specialization = Column(String(200), nullable=False)
    experience_years = Column(Integer, nullable=True, default=0)
    profile_description = Column(Text, nullable=True)
    location = Column(String(200), nullable=True)
    profile_photo_url = Column(String(500), nullable=True)

    # ─── Indian Location & Compliance Details ─────────────────────────────────
    state = Column(SQLEnum(IndianState), nullable=True)
    city = Column(SQLEnum(IndianCity), nullable=True)
    pincode = Column(String(10), nullable=True)
    organization_name = Column(String(255), nullable=True)
    owner_name = Column(String(255), nullable=True)
    address = Column(Text, nullable=True)
    tax_number = Column(String(100), nullable=True)
    bank_details = Column(Text, nullable=True)
    identity_proof_url = Column(String(500), nullable=True)
    certificates_urls = Column(Text, nullable=True)

    # ─── Rating ───────────────────────────────────────────────────────────────
    avg_rating = Column(Numeric(3, 2), nullable=False, default=0.0)
    total_reviews = Column(Integer, nullable=False, default=0)

    # ─── Consultation fee ─────────────────────────────────────────────────────
    consultation_fee = Column(Numeric(10, 2), nullable=True, default=199.0)

    # ─── Status ───────────────────────────────────────────────────────────────
    is_verified = Column(Boolean, nullable=False, default=False)
    is_accepting_appointments = Column(Boolean, nullable=False, default=True)
    approval_status = Column(
        SQLEnum("pending", "approved", "rejected", name="provider_approval_status_enum"),
        nullable=False,
        default="pending",
        comment="Provider visibility approval status by admin"
    )

    # ─── Timestamps ───────────────────────────────────────────────────────────
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    # ─── Relationships ────────────────────────────────────────────────────────
    user = relationship("User", back_populates="provider_profile")
    category = relationship("Category", back_populates="providers")
    organization = relationship("Organization", back_populates="providers")
    onboarding = relationship(
        "ProviderOnboarding",
        back_populates="provider",
        uselist=False,
        cascade="all, delete-orphan",
    )
    availability_slots = relationship("Availability", back_populates="provider", cascade="all, delete-orphan")
    appointments = relationship(
        "Appointment", foreign_keys="Appointment.provider_id", back_populates="provider"
    )
