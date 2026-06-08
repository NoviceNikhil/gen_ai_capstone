import uuid
from sqlalchemy import Column, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.dialects.mysql import CHAR
from sqlalchemy.sql import func
from config.database import Base


class NotificationRead(Base):
    __tablename__ = "notification_reads"
    __table_args__ = (
        UniqueConstraint("user_id", "appointment_id", name="uq_notification_read_user_appointment"),
    )

    id = Column(CHAR(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(CHAR(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    appointment_id = Column(CHAR(36), ForeignKey("appointments.id", ondelete="CASCADE"), nullable=False, index=True)
    read_at = Column(DateTime, server_default=func.now(), nullable=False)
