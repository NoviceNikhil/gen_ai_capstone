import uuid
from sqlalchemy import Column, String, Text, DateTime, ForeignKey, Boolean, Enum as SAEnum
from sqlalchemy.dialects.mysql import CHAR
from sqlalchemy.sql import func

from config.database import Base


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(CHAR(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(CHAR(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    type = Column(
        SAEnum("waitlist_lock", "appointment_reminder", "cancellation", "other", name="notification_type_enum"),
        nullable=False,
        default="other",
    )
    title = Column(String(255), nullable=False)
    message = Column(Text, nullable=True)
    related_entity_id = Column(CHAR(36), nullable=True, index=True)  # e.g., appointment_id or waitlist_entry_id
    related_entity_type = Column(String(50), nullable=True)  # e.g., "appointment", "waitlist_entry"
    is_read = Column(Boolean, default=False)
    action_url = Column(String(500), nullable=True)  # Frontend redirect URL
    created_at = Column(DateTime, server_default=func.now(), nullable=False, index=True)
    read_at = Column(DateTime, nullable=True)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
