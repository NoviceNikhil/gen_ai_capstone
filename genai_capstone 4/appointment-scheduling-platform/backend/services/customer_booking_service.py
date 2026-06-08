import json
from datetime import date, datetime, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import desc
from urllib.parse import urlencode

from models import (
    ServiceProvider,
    ServiceOffering,
    ProviderIntakeForm,
    LoyaltyPackage,
    CustomerPackagePurchase,
    WaitlistEntry,
    User,
)
from utils.exceptions import not_found, conflict
from services.audit_log_service import log_event


def get_provider_booking_config(db: Session, provider_id: str) -> dict:
    provider = db.query(ServiceProvider).filter(ServiceProvider.id == provider_id).first()
    if not provider:
        raise not_found("Provider")

    offerings = db.query(ServiceOffering).filter(
        ServiceOffering.provider_id == provider.id,
        ServiceOffering.is_active == True,
        ServiceOffering.price > 0,
    ).order_by(ServiceOffering.created_at.desc()).all()

    intake_form = db.query(ProviderIntakeForm).filter(
        ProviderIntakeForm.provider_id == provider.id,
        ProviderIntakeForm.is_active == True,
    ).order_by(ProviderIntakeForm.updated_at.desc()).first()

    packages = db.query(LoyaltyPackage).filter(
        LoyaltyPackage.provider_id == provider.id,
        LoyaltyPackage.is_active == True,
    ).order_by(LoyaltyPackage.created_at.desc()).all()

    return {
        "offerings": offerings,
        "intake_form": {
            "id": intake_form.id,
            "title": intake_form.title,
            "fields": json.loads(intake_form.fields_json or "[]"),
        } if intake_form else None,
        "packages": packages,
        "policy": {
            "late_cancel_cutoff_hours": 24,
            "late_cancel_penalty_percent": 0.0,
            "no_show_fee_flat": 0.0,
        },
    }


def join_waitlist_v1(db: Session, provider_id: str, customer_id: str, preferred_date: date | None):
    """Legacy version - kept for backward compatibility"""
    provider = db.query(ServiceProvider).filter(ServiceProvider.id == provider_id).first()
    if not provider:
        raise not_found("Provider")

    existing = db.query(WaitlistEntry).filter(
        WaitlistEntry.provider_id == provider_id,
        WaitlistEntry.customer_id == customer_id,
        WaitlistEntry.status.in_(["waiting", "notified"]),
    ).first()
    if existing:
        raise conflict("You are already on this provider's waitlist")

    entry = WaitlistEntry(
        provider_id=provider_id,
        customer_id=customer_id,
        preferred_date=preferred_date,
        status="waiting",
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    log_event(
        event_type="waitlist_joined",
        actor_id=customer_id,
        metadata={"provider_id": provider_id, "preferred_date": str(preferred_date) if preferred_date else None},
    )
    return entry


def purchase_package(db: Session, customer_id: str, package_id: str):
    package = db.query(LoyaltyPackage).filter(
        LoyaltyPackage.id == package_id,
        LoyaltyPackage.is_active == True,
    ).first()
    if not package:
        raise not_found("Loyalty package")

    purchase = CustomerPackagePurchase(
        customer_id=customer_id,
        package_id=package.id,
        sessions_total=package.session_count,
        sessions_used=0,
        status="active",
    )
    db.add(purchase)
    db.commit()
    db.refresh(purchase)
    log_event(
        event_type="package_purchased",
        actor_id=customer_id,
        metadata={"package_id": package_id, "purchase_id": purchase.id, "sessions_total": purchase.sessions_total},
    )
    return purchase


def get_customer_packages(db: Session, customer_id: str):
    purchases = db.query(CustomerPackagePurchase).filter(
        CustomerPackagePurchase.customer_id == customer_id
    ).order_by(CustomerPackagePurchase.created_at.desc()).all()
    return purchases


def get_customer_waitlist(db: Session, customer_id: str):
    """Get all waitlist entries for current customer"""
    entries = db.query(WaitlistEntry).filter(
        WaitlistEntry.customer_id == customer_id,
        WaitlistEntry.status.in_(["waiting", "notified"]),
    ).order_by(desc(WaitlistEntry.created_at)).all()
    
    # Enrich with provider details
    entries_with_provider = []
    for entry in entries:
        provider = db.query(ServiceProvider).filter(ServiceProvider.id == entry.provider_id).first()
        provider_user = db.query(User).filter(User.id == provider.user_id).first() if provider else None
        entries_with_provider.append({
            "id": entry.id,
            "provider_id": entry.provider_id,
            "provider": {
                "id": provider.id,
                "name": provider_user.full_name if provider_user else "Unknown",
                "specialization": provider.specialization,
                "location": provider.location,
            } if provider else None,
            "preferred_date": entry.preferred_date,
            "status": entry.status,
            "has_open_lock": entry.status == "notified",
            "claim_expires_at": entry.claim_expires_at,
            "created_at": entry.created_at,
            "notified_at": entry.notified_at,
        })
    
    return entries_with_provider


def leave_waitlist(db: Session, customer_id: str, waitlist_entry_id: str):
    """Remove customer from waitlist"""
    entry = db.query(WaitlistEntry).filter(
        WaitlistEntry.id == waitlist_entry_id,
        WaitlistEntry.customer_id == customer_id,
    ).first()
    
    if not entry:
        raise not_found("Waitlist entry")
    
    if entry.status not in ["waiting", "notified"]:
        raise conflict("Cannot remove from this waitlist entry - invalid status")
    
    entry.status = "cancelled"
    db.commit()
    
    log_event(
        event_type="waitlist_left",
        actor_id=customer_id,
        metadata={"provider_id": entry.provider_id, "entry_id": entry.id},
    )
    
    return {"message": "Removed from waitlist"}


def release_lock(db: Session, customer_id: str, waitlist_entry_id: str):
    """Release the open lock and pass to next customer in queue"""
    from services.notification_service import create_notification
    
    entry = db.query(WaitlistEntry).filter(
        WaitlistEntry.id == waitlist_entry_id,
        WaitlistEntry.customer_id == customer_id,
    ).first()
    
    if not entry:
        raise not_found("Waitlist entry")
    
    if entry.status != "notified":
        raise conflict("This entry does not have an open lock")
    
    # Mark current as fulfilled
    entry.status = "fulfilled"
    db.commit()
    
    # Find next customer in waiting queue for the same provider
    next_entry = db.query(WaitlistEntry).filter(
        WaitlistEntry.provider_id == entry.provider_id,
        WaitlistEntry.customer_id != customer_id,
        WaitlistEntry.status == "waiting",
    ).order_by(WaitlistEntry.created_at).first()
    
    if next_entry:
        # Notify the next customer
        next_entry.status = "notified"
        next_entry.notified_at = datetime.utcnow()
        next_entry.claim_expires_at = datetime.utcnow() + timedelta(minutes=30)  # 30-minute claim window
        db.commit()
        
        # Create in-app notification for next customer
        try:
            provider = db.query(ServiceProvider).filter(ServiceProvider.id == entry.provider_id).first()
            provider_name = provider.user.full_name if provider and provider.user else "Provider"
            action_url = (
                f"/customer/providers/{entry.provider_id}?"
                + urlencode(
                    {
                        "fromWaitlist": "true",
                        "waitlistDate": str(entry.preferred_date) if entry.preferred_date else "",
                        "waitlistEntryId": next_entry.id,
                    }
                )
            )
            
            create_notification(
                db=db,
                user_id=next_entry.customer_id,
                notification_type="waitlist_lock",
                title="Slot Available!",
                message=f"A slot just opened up with {provider_name}. You have 30 minutes to claim it.",
                related_entity_id=next_entry.id,
                related_entity_type="waitlist_entry",
                action_url=action_url,
            )
            db.flush()
        except Exception as e:
            print(f"Failed to create notification for next customer: {str(e)}")
        
        # Log that the next customer was notified
        provider = db.query(ServiceProvider).filter(ServiceProvider.id == entry.provider_id).first()
        provider_user = db.query(User).filter(User.id == provider.user_id).first() if provider else None
        
        log_event(
            event_type="waitlist_slot_released",
            actor_id=customer_id,
            metadata={
                "provider_id": entry.provider_id,
                "released_by": customer_id,
                "notified_customer": next_entry.customer_id,
                "provider_name": provider_user.full_name if provider_user else None,
            },
        )
    else:
        log_event(
            event_type="waitlist_lock_released",
            actor_id=customer_id,
            metadata={"provider_id": entry.provider_id, "no_next_customer": True},
        )
    db.commit()
    return {"message": "Lock released", "next_customer_notified": next_entry is not None}


def fulfill_waitlist_entry(db: Session, waitlist_entry_id: str, customer_id: str):
    """Mark a waitlist entry as fulfilled after booking an appointment"""
    from datetime import datetime
    from services.notification_service import create_notification
    
    entry = db.query(WaitlistEntry).filter(
        WaitlistEntry.id == waitlist_entry_id,
        WaitlistEntry.customer_id == customer_id,
    ).first()
    
    if not entry:
        raise not_found("Waitlist entry")
    
    # Must be in notified status to claim
    if entry.status != "notified":
        raise conflict("Waitlist entry is not available to claim. It may have already been claimed or expired.")
    
    # Check if lock has expired
    if entry.claim_expires_at and entry.claim_expires_at < datetime.now():
        raise conflict("Your 30-minute lock window has expired. Please check your notifications for the next opportunity.")
    
    # Mark this entry as fulfilled
    entry.status = "fulfilled"
    db.add(entry)
    db.flush()
    
    # Mark other waiting/notified entries for same provider from this customer as cancelled
    db.query(WaitlistEntry).filter(
        WaitlistEntry.provider_id == entry.provider_id,
        WaitlistEntry.customer_id == customer_id,
        WaitlistEntry.status.in_(["waiting", "notified"]),
        WaitlistEntry.id != entry.id,
    ).update({"status": "cancelled"}, synchronize_session=False)
    db.flush()
    
    # Find and notify the next waiting customer for this provider
    next_entry = db.query(WaitlistEntry).filter(
        WaitlistEntry.provider_id == entry.provider_id,
        WaitlistEntry.status == "waiting",
    ).order_by(WaitlistEntry.created_at).first()
    
    if next_entry:
        # Notify next customer
        next_entry.status = "notified"
        next_entry.notified_at = datetime.utcnow()
        next_entry.claim_expires_at = datetime.utcnow() + timedelta(minutes=30)
        db.add(next_entry)
        db.flush()
        
        # Create in-app notification for next customer
        try:
            provider = db.query(ServiceProvider).filter(ServiceProvider.id == entry.provider_id).first()
            provider_name = provider.user.full_name if provider and provider.user else "Provider"
            action_url = (
                f"/customer/providers/{entry.provider_id}?"
                + urlencode(
                    {
                        "fromWaitlist": "true",
                        "waitlistDate": str(entry.preferred_date) if entry.preferred_date else "",
                        "waitlistEntryId": next_entry.id,
                    }
                )
            )
            
            create_notification(
                db=db,
                user_id=next_entry.customer_id,
                notification_type="waitlist_lock",
                title="Slot Available!",
                message=f"A slot just opened up with {provider_name}. You have 30 minutes to claim it.",
                related_entity_id=next_entry.id,
                related_entity_type="waitlist_entry",
                action_url=action_url,
            )
            db.flush()
        except Exception as e:
            print(f"Failed to create notification for next customer: {str(e)}")
        
        log_event(
            event_type="waitlist_next_notified",
            actor_id=customer_id,
            metadata={
                "provider_id": entry.provider_id,
                "claimed_by": customer_id,
                "notified_customer": next_entry.customer_id,
            },
        )
    db.commit()
    
    log_event(
        event_type="waitlist_fulfilled",
        actor_id=customer_id,
        metadata={"provider_id": entry.provider_id, "entry_id": entry.id},
    )
    
    return {"message": "Waitlist entry fulfilled"}


def join_waitlist(
    db: Session,
    customer_id: str,
    provider_id: str,
    preferred_date: date = None,
) -> dict:
    """Add customer to waitlist for a provider and return queue position"""
    from datetime import datetime as dt
    from services.notification_service import create_notification
    
    # Check if customer is already on this waitlist
    existing = db.query(WaitlistEntry).filter(
        WaitlistEntry.customer_id == customer_id,
        WaitlistEntry.provider_id == provider_id,
        WaitlistEntry.status.in_(["waiting", "notified"]),
    ).first()
    
    if existing:
        raise conflict("You are already on the waitlist for this provider")
    
    # Create new waitlist entry
    entry = WaitlistEntry(
        customer_id=customer_id,
        provider_id=provider_id,
        preferred_date=preferred_date,
        status="waiting",
    )
    db.add(entry)
    db.flush()
    
    # Calculate queue position (count how many are waiting ahead or same status)
    queue_position = db.query(WaitlistEntry).filter(
        WaitlistEntry.provider_id == provider_id,
        WaitlistEntry.status == "waiting",
        WaitlistEntry.created_at <= entry.created_at,
    ).count()

    # In-app notification: confirm waitlist join
    try:
        provider = (
            db.query(ServiceProvider)
            .filter(ServiceProvider.id == provider_id)
            .first()
        )
        provider_name = provider.user.full_name if provider and provider.user else "Provider"
        title = "Waitlist Joined"
        date_text = str(preferred_date) if preferred_date else "any available date"
        create_notification(
            db=db,
            user_id=customer_id,
            notification_type="other",
            title=title,
            message=f"You’ve joined the waitlist for {provider_name} ({date_text}). We’ll notify you when a slot opens.",
            related_entity_id=entry.id,
            related_entity_type="waitlist_entry",
            action_url="/customer/waitlist",
        )
        db.flush()
    except Exception:
        pass

    db.commit()
    
    log_event(
        event_type="waitlist_joined",
        actor_id=customer_id,
        metadata={"provider_id": provider_id, "entry_id": entry.id, "queue_position": queue_position},
    )
    
    # Return entry data with queue position
    return {
        "id": entry.id,
        "provider_id": entry.provider_id,
        "customer_id": entry.customer_id,
        "preferred_date": str(entry.preferred_date) if entry.preferred_date else None,
        "status": entry.status,
        "created_at": entry.created_at.isoformat() if entry.created_at else None,
        "queue_position": queue_position,
    }


def release_waitlist_lock(db: Session, entry_id: str, customer_id: str) -> None:
    """Release a waitlist lock and pass to next customer"""
    from datetime import datetime as dt
    from services.availability_service import assign_lock_to_next_waitlist_customer
    from services.notification_service import create_notification
    
    entry = db.query(WaitlistEntry).filter(
        WaitlistEntry.id == entry_id,
        WaitlistEntry.customer_id == customer_id,
    ).first()
    
    if not entry:
        raise not_found("Waitlist entry")
    
    if entry.status != "notified":
        raise conflict("Can only release a lock from a notified (locked) entry")
    
    # Check if lock hasn't expired yet
    if entry.claim_expires_at and entry.claim_expires_at < dt.now():
        raise conflict("Lock has already expired")
    
    # Get provider and appointment date info
    provider = db.query(ServiceProvider).filter(ServiceProvider.id == entry.provider_id).first()
    appointment_date = entry.preferred_date or date.today()
    
    # Revert this entry to waiting (move to back of queue)
    entry.status = "waiting"
    entry.notified_at = None
    entry.claim_expires_at = None
    db.add(entry)
    db.flush()
    
    # Create notification for this customer
    try:
        create_notification(
            db=db,
            user_id=customer_id,
            notification_type="other",
            title="Lock Released",
            message="You've released the lock for this slot. It's now available for other customers on the waitlist.",
            related_entity_type="waitlist_entry",
        )
        db.flush()
    except Exception as e:
        print(f"Failed to create notification: {str(e)}")
    
    # Assign lock to next waiting customer
    if provider:
        assign_lock_to_next_waitlist_customer(db, entry.provider_id, appointment_date)
    
    db.commit()
    
    log_event(
        event_type="waitlist_lock_released",
        actor_id=customer_id,
        metadata={"provider_id": entry.provider_id, "entry_id": entry.id},
    )
