import uuid
from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.dialects.mysql import CHAR
from sqlalchemy.sql import func

from config.database import Base


class ProviderCalendarConnection(Base):
    __tablename__ = "provider_calendar_connections"

    id = Column(CHAR(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    provider_id = Column(
        CHAR(36),
        ForeignKey("service_providers.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )

    provider = Column(String(30), nullable=False, default="google")
    email = Column(String(255), nullable=True)

    access_token = Column(Text, nullable=True)
    refresh_token = Column(Text, nullable=True)
    token_expiry = Column(DateTime, nullable=True)
    scope = Column(Text, nullable=True)

    is_connected = Column(Boolean, nullable=False, default=False)
    last_sync_at = Column(DateTime, nullable=True)
    sync_status = Column(String(40), nullable=False, default="disconnected")

    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

