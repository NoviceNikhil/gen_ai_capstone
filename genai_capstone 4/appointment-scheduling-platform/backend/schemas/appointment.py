from pydantic import BaseModel
from typing import Optional, Dict, Any
from datetime import date


class BookAppointmentRequest(BaseModel):
    provider_id: str
    appointment_date: date
    time_slot: str          # e.g. "10:00"
    category_id: Optional[int] = None
    notes: Optional[str] = None
    offering_id: Optional[str] = None
    intake_answers: Optional[Dict[str, Any]] = None
    package_purchase_id: Optional[str] = None


class JoinWaitlistRequest(BaseModel):
    preferred_date: Optional[date] = None


class RescheduleRequest(BaseModel):
    appointment_date: date
    time_slot: str


class RescheduleRespondRequest(BaseModel):
    action: str  # 'approve' or 'reject'


class CancelRequest(BaseModel):
    cancellation_reason: Optional[str] = None


class AppointmentStatusUpdate(BaseModel):
    """Provider use — confirm, reject, complete, no_show"""
    action: str             # confirm | reject | complete | no_show
    notes: Optional[str] = None


class AppointmentFilterParams(BaseModel):
    """Query parameters for listing appointments"""
    status: Optional[str] = None
    from_date: Optional[date] = None
    to_date: Optional[date] = None
    page: int = 1
    limit: int = 10


class SubmitReviewRequest(BaseModel):
    rating: int
    comment: Optional[str] = None
