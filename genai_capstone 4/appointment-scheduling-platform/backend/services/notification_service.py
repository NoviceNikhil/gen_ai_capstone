from sqlalchemy.orm import Session, joinedload

from models import Appointment, ServiceProvider, NotificationRead


def _appointment_message(role: str, appointment: Appointment) -> str:
    try:
        customer_name = appointment.customer.full_name if appointment.customer else "Customer"
        provider_name = appointment.provider.user.full_name if appointment.provider and appointment.provider.user else "Provider"
    except Exception:
        return "You have a new appointment update."
    date_text = str(appointment.appointment_date)
    slot_text = appointment.time_slot

    if role == "customer":
        if appointment.status == "confirmed":
            return f"Your appointment with {provider_name} on {date_text} at {slot_text} is confirmed."
        if appointment.status == "cancelled":
            return f"Your appointment with {provider_name} on {date_text} at {slot_text} was cancelled."
        if appointment.status == "completed":
            return f"Your appointment with {provider_name} on {date_text} at {slot_text} is completed."
        return f"Your booking request with {provider_name} for {date_text} at {slot_text} is pending."

    if role == "provider":
        if appointment.status == "pending":
            return f"New booking request from {customer_name} for {date_text} at {slot_text}."
        if appointment.status == "confirmed":
            return f"Appointment with {customer_name} on {date_text} at {slot_text} is confirmed."
        if appointment.status == "cancelled":
            return f"Appointment with {customer_name} on {date_text} at {slot_text} was cancelled."
        return f"Appointment with {customer_name} on {date_text} at {slot_text} is completed."

    return f"{customer_name} - {provider_name} | {date_text} {slot_text} | {appointment.status}"


def get_notifications(db: Session, user_id: str, role: str, limit: int = 8) -> dict:
    query = (
        db.query(Appointment)
        .options(
            joinedload(Appointment.customer),
            joinedload(Appointment.provider).joinedload(ServiceProvider.user),
        )
    )

    if role == "customer":
        query = query.filter(Appointment.customer_id == user_id)
    elif role == "provider":
        provider = db.query(ServiceProvider).filter(ServiceProvider.user_id == user_id).first()
        if not provider:
            return {"unread_count": 0, "items": []}
        query = query.filter(Appointment.provider_id == provider.id)

    read_appointment_ids = {
        row.appointment_id
        for row in db.query(NotificationRead).filter(NotificationRead.user_id == user_id).all()
    }

    appointments = (
        query.order_by(Appointment.updated_at.desc(), Appointment.created_at.desc())
        .all()
    )
    unread_appointments = [appointment for appointment in appointments if appointment.id not in read_appointment_ids]
    appointments = unread_appointments[:limit]

    items = [
        {
            "id": appointment.id,
            "status": appointment.status,
            "appointment_date": str(appointment.appointment_date),
            "time_slot": appointment.time_slot,
            "is_paid": appointment.is_paid,
            "created_at": str(appointment.created_at),
            "updated_at": str(appointment.updated_at),
            "message": _appointment_message(role, appointment),
        }
        for appointment in appointments
    ]

    unread_count = len(unread_appointments)
    return {"unread_count": unread_count, "items": items}


def mark_notification_read(db: Session, user_id: str, role: str, appointment_id: str) -> None:
    appointment = db.query(Appointment).filter(Appointment.id == appointment_id).first()
    if not appointment:
        return

    if role == "customer":
        if appointment.customer_id != user_id:
            return
    elif role == "provider":
        provider = db.query(ServiceProvider).filter(ServiceProvider.user_id == user_id).first()
        if not provider or appointment.provider_id != provider.id:
            return
    else:
        return

    existing = db.query(NotificationRead).filter(
        NotificationRead.user_id == user_id,
        NotificationRead.appointment_id == appointment_id,
    ).first()
    if existing:
        return

    db.add(NotificationRead(user_id=user_id, appointment_id=appointment_id))
    db.commit()


# ──────────────────────────────────────────────────────────────────────────────
# New Notification Model Functions
# ──────────────────────────────────────────────────────────────────────────────

from datetime import datetime, timedelta
from models.notification import Notification


def create_notification(
    db: Session,
    user_id: str,
    notification_type: str,
    title: str,
    message: str = None,
    related_entity_id: str = None,
    related_entity_type: str = None,
    action_url: str = None,
) -> Notification:
    """Create a new notification for a user"""
    notification = Notification(
        user_id=user_id,
        type=notification_type,
        title=title,
        message=message,
        related_entity_id=related_entity_id,
        related_entity_type=related_entity_type,
        action_url=action_url,
    )
    db.add(notification)
    db.flush()
    return notification


def get_notifications_from_model(
    db: Session,
    user_id: str,
    limit: int = 50,
    offset: int = 0,
    unread_only: bool = False,
) -> tuple:
    """Get notifications for a user from the new Notification model"""
    from models.waitlist_entry import WaitlistEntry
    from sqlalchemy.ext.hybrid import hybrid_property
    
    query = db.query(Notification).filter(Notification.user_id == user_id)
    
    if unread_only:
        query = query.filter(Notification.is_read == False)
    
    total_count = query.count()
    
    notifications = query.order_by(Notification.created_at.desc()).limit(limit).offset(offset).all()
    
    # Enrich waitlist notifications with expiration time
    enriched_notifications = []
    for notification in notifications:
        notification_data = {
            'id': notification.id,
            'user_id': notification.user_id,
            'type': notification.type,
            'title': notification.title,
            'message': notification.message,
            'related_entity_id': notification.related_entity_id,
            'related_entity_type': notification.related_entity_type,
            'is_read': notification.is_read,
            'action_url': notification.action_url,
            'created_at': notification.created_at.isoformat() if notification.created_at else None,
            'read_at': notification.read_at.isoformat() if notification.read_at else None,
            'updated_at': notification.updated_at.isoformat() if notification.updated_at else None,
        }
        
        # Add expiration time for waitlist notifications
        if notification.type == 'waitlist_lock' and notification.related_entity_type == 'waitlist_entry' and notification.related_entity_id:
            waitlist_entry = db.query(WaitlistEntry).filter(WaitlistEntry.id == notification.related_entity_id).first()
            if waitlist_entry and waitlist_entry.claim_expires_at:
                notification_data['claim_expires_at'] = waitlist_entry.claim_expires_at.isoformat() if waitlist_entry.claim_expires_at else None
        
        enriched_notifications.append(notification_data)
    
    return enriched_notifications, total_count


def mark_notification_read_new(db: Session, notification_id: str, user_id: str) -> bool:
    """Mark a notification as read (for new Notification model)"""
    notification = db.query(Notification).filter(
        Notification.id == notification_id,
        Notification.user_id == user_id,
    ).first()
    
    if notification:
        notification.is_read = True
        notification.read_at = datetime.now()
        db.add(notification)
        db.flush()
        return True
    return False


def mark_all_notifications_read_new(db: Session, user_id: str) -> int:
    """Mark all notifications as read for a user (for new Notification model)"""
    count = db.query(Notification).filter(
        Notification.user_id == user_id,
        Notification.is_read == False,
    ).update(
        {
            Notification.is_read: True,
            Notification.read_at: datetime.now(),
        },
        synchronize_session=False,
    )
    db.flush()
    return count


def delete_notification_new(db: Session, notification_id: str, user_id: str) -> bool:
    """Delete a notification (for new Notification model)"""
    deleted = db.query(Notification).filter(
        Notification.id == notification_id,
        Notification.user_id == user_id,
    ).delete(synchronize_session=False)
    db.flush()
    return deleted > 0
