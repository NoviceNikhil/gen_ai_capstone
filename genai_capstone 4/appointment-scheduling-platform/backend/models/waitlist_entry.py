import uuid
from sqlalchemy import Column, String, Date, DateTime, ForeignKey, Enum as SAEnum
from sqlalchemy.dialects.mysql import CHAR
from sqlalchemy.sql import func

from config.database import Base


class WaitlistEntry(Base):
    __tablename__ = "waitlist_entries"

    id = Column(CHAR(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    provider_id = Column(CHAR(36), ForeignKey("service_providers.id", ondelete="CASCADE"), nullable=False, index=True)
    customer_id = Column(CHAR(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    preferred_date = Column(Date, nullable=True)
    status = Column(
        SAEnum("waiting", "notified", "fulfilled", "cancelled", name="waitlist_status_enum"),
        nullable=False,
        default="waiting",
    )
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    notified_at = Column(DateTime, nullable=True)
    claim_expires_at = Column(DateTime, nullable=True)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
