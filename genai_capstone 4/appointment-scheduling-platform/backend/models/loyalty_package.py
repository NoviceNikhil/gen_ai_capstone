import uuid
from sqlalchemy import Column, String, Numeric, Integer, Boolean, DateTime, ForeignKey
from sqlalchemy.dialects.mysql import CHAR
from sqlalchemy.sql import func

from config.database import Base


class LoyaltyPackage(Base):
    __tablename__ = "loyalty_packages"

    id = Column(CHAR(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    provider_id = Column(CHAR(36), ForeignKey("service_providers.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String(160), nullable=False)
    session_count = Column(Integer, nullable=False)
    discount_percent = Column(Numeric(5, 2), nullable=False, default=0)
    package_price = Column(Numeric(10, 2), nullable=False, default=0)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())


class CustomerPackagePurchase(Base):
    __tablename__ = "customer_package_purchases"

    id = Column(CHAR(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    customer_id = Column(CHAR(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    package_id = Column(CHAR(36), ForeignKey("loyalty_packages.id", ondelete="CASCADE"), nullable=False, index=True)
    sessions_total = Column(Integer, nullable=False)
    sessions_used = Column(Integer, nullable=False, default=0)
    status = Column(String(24), nullable=False, default="active")
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
