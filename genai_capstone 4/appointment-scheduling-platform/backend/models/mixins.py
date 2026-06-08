from sqlalchemy import Column, DateTime
from datetime import datetime

class SoftDeleteMixin:
    deleted_at = Column(DateTime, nullable=True, default=None)

    def soft_delete(self):
        self.deleted_at = datetime.utcnow()

    def restore(self):
        self.deleted_at = None
