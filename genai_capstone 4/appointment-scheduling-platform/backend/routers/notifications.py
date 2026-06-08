from fastapi import APIRouter, Depends, Query
from fastapi.responses import JSONResponse
from fastapi.encoders import jsonable_encoder
from sqlalchemy.orm import Session

from config.database import get_db
from middleware.auth import get_current_user
from services import notification_service
from services.cache_service import get, set, invalidate
from utils.response import success_response, success_envelope


router = APIRouter(prefix="/api/notifications", tags=["Notifications"])


@router.get("")
def list_notifications(
    limit: int = Query(8, ge=1, le=25),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    cache_key = f"cache:notifications:{current_user['id']}:limit={limit}"
    cached = get(cache_key)
    if cached:
        return JSONResponse(status_code=200, content=cached)
    data = notification_service.get_notifications(
        db,
        user_id=current_user["id"],
        role=current_user["role"],
        limit=limit,
    )
    payload = success_envelope(jsonable_encoder(data), "Notifications fetched")
    set(cache_key, payload, ttl=20)
    return JSONResponse(status_code=200, content=payload)


@router.patch("/{appointment_id}/read")
def mark_notification_read(
    appointment_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    notification_service.mark_notification_read(
        db,
        user_id=current_user["id"],
        role=current_user["role"],
        appointment_id=appointment_id,
    )
    return success_response({}, "Notification marked as read")

# ─── NEW NOTIFICATION MODEL ENDPOINTS ────────────────────────────────────────

@router.get("/new")
def list_notifications_new(
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    unread_only: bool = Query(False),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Get notifications using the new Notification model"""
    notifications, total_count = notification_service.get_notifications_from_model(
        db,
        user_id=current_user["id"],
        limit=limit,
        offset=offset,
        unread_only=unread_only,
    )
    return success_envelope({
        "notifications": jsonable_encoder(notifications),
        "total": total_count,
        "limit": limit,
        "offset": offset,
    }, "Notifications fetched")


@router.patch("/{notification_id}/read-new")
def mark_notification_read_new(
    notification_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Mark a notification as read (new model)"""
    success = notification_service.mark_notification_read_new(
        db,
        notification_id=notification_id,
        user_id=current_user["id"],
    )
    if not success:
        return success_response({}, "Notification not found", status_code=404)
    db.commit()
    return success_response({}, "Notification marked as read")


@router.patch("/read-all-new")
def mark_all_notifications_read_new(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Mark all notifications as read (new model)"""
    notification_service.mark_all_notifications_read_new(
        db,
        user_id=current_user["id"],
    )
    db.commit()
    return success_response({}, "All notifications marked as read")


@router.delete("/{notification_id}")
def delete_notification(
    notification_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Delete a notification"""
    notification_service.delete_notification_new(
        db,
        notification_id=notification_id,
        user_id=current_user["id"],
    )
    db.commit()
    return success_response({}, "Notification deleted")