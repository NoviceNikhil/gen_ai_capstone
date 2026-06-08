from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from config.database import get_db
from middleware.auth import get_current_user
from schemas.availability import AvailabilityCreate, AvailabilityUpdate
from services import availability_service
from utils.response import success_response

router = APIRouter(prefix="/api/availability", tags=["Availability"])


@router.get("")
def get_my_availability(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    slots = availability_service.get_availability(db, current_user["id"])
    return success_response({"slots": slots}, "Availability fetched")


@router.post("")
def add_availability(
    body: AvailabilityCreate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    slot = availability_service.add_availability(db, current_user["id"], body.model_dump())
    return success_response({"slot": slot}, "Availability slot added", 201)


@router.patch("/{slot_id}")
def update_availability(
    slot_id: str,
    body: AvailabilityUpdate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    slot = availability_service.update_availability(
        db, slot_id, current_user["id"], body.model_dump(exclude_none=True)
    )
    return success_response({"slot": slot}, "Availability slot updated")


@router.delete("/{slot_id}")
def delete_availability(
    slot_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    availability_service.delete_availability(db, slot_id, current_user["id"])
    return success_response(None, "Availability slot deleted")
