import uuid
from sqlalchemy import Column, String, Text, DateTime, ForeignKey, Integer
from sqlalchemy.dialects.mysql import CHAR
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from config.database import Base


class AIInsight(Base):
    __tablename__ = "ai_insights"

    id = Column(CHAR(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    
    provider_onboarding_id = Column(
        CHAR(36),
        ForeignKey("provider_onboarding.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    summary = Column(Text, nullable=True)  # 2-4 line insight
    highlights = Column(Text, nullable=True)  # JSON string array
    risk_level = Column(String(20), nullable=False, default="medium")  # low | medium | high
    status = Column(String(20), nullable=False, default="pending")  # pending | done | failed
    
    error_message = Column(Text, nullable=True)  # if status == "failed"

    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    onboarding = relationship("ProviderOnboarding", backref="ai_insights")
