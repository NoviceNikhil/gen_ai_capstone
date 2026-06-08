from sqlalchemy import Column, Integer, String, Boolean, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from sqlalchemy import DateTime
from config.database import Base
from models.mixins import SoftDeleteMixin


class Category(Base, SoftDeleteMixin):
    __tablename__ = "categories"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(100), unique=True, nullable=False)
    description = Column(Text, nullable=True)
    icon = Column(String(50), nullable=True, comment="Lucide icon name e.g. stethoscope, scissors")
    is_active = Column(Boolean, nullable=False, default=True)

    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    # ─── Relationships ────────────────────────────────────────────────────────
    providers = relationship("ServiceProvider", back_populates="category")
