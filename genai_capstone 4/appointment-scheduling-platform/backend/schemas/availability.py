from pydantic import BaseModel, field_validator
from typing import Optional
from datetime import date


class AvailabilityCreate(BaseModel):
    # For recurring slots: day_of_week must be set
    # For specific date slots: specific_date must be set
    day_of_week: Optional[int] = None                    # 0=Monday … 6=Sunday (null for date-specific)
    specific_date: Optional[date] = None                 # If set, one-time slot for this date
    start_time: str                                      # "09:00"
    end_time: str                                        # "17:00"
    slot_duration_minutes: int = 30

    @field_validator("day_of_week", "specific_date", mode="after")
    def validate_slot_type(cls, v):
        # At least one of day_of_week or specific_date must be set
        # This is checked at the class level in __init__
        return v

    def __init__(self, **data):
        super().__init__(**data)
        if self.day_of_week is None and self.specific_date is None:
            raise ValueError("Either day_of_week or specific_date must be provided")
        if self.day_of_week is not None and self.specific_date is not None:
            raise ValueError("Cannot set both day_of_week and specific_date")
        if self.day_of_week is not None and not (0 <= self.day_of_week <= 6):
            raise ValueError("day_of_week must be between 0 and 6")

    class Config:
        from_attributes = True


class AvailabilityUpdate(BaseModel):
    day_of_week: Optional[int] = None
    specific_date: Optional[date] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    slot_duration_minutes: Optional[int] = None
    is_active: Optional[bool] = None


class AvailableSlotQuery(BaseModel):
    """Query to get available time slots for a provider on a date"""
    provider_id: str
    date: str                           # YYYY-MM-DD


class AvailabilityResponse(BaseModel):
    """Response for availability slot"""
    id: str
    provider_id: str
    day_of_week: Optional[int] = None
    specific_date: Optional[str] = None
    start_time: str
    end_time: str
    slot_duration_minutes: int
    is_active: bool
    created_at: str
    updated_at: str

    class Config:
        from_attributes = True
