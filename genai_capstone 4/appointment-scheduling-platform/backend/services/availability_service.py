from datetime import date, time, datetime, timedelta
from typing import List, Optional
from sqlalchemy.orm import Session, joinedload
import threading
from urllib.parse import urlencode

from models.availability import Availability
from models.appointment import Appointment
from models.appointment_slot import AppointmentSlot
from models.service_provider import ServiceProvider
from models.waitlist_entry import WaitlistEntry
from models.user import User
from utils.exceptions import not_found, bad_request, conflict
from utils.email import send_waitlist_slot_email


def add_availability(db: Session, user_id: str, data: dict) -> Availability:
    provider = db.query(ServiceProvider).filter(ServiceProvider.user_id == user_id).first()
    if not provider:
        raise not_found("Provider profile")

    # Parse times — accept HH:MM or HH:MM:SS for flexibility
    def _parse_time(val: str):
        for fmt in ("%H:%M", "%H:%M:%S"):
            try:
                return datetime.strptime(val, fmt).time()
            except ValueError:
                continue
        raise ValueError(f"Invalid time format: {val}")

    start = _parse_time(data["start_time"])
    end   = _parse_time(data["end_time"])
    if start >= end:
        raise bad_request("start_time must be before end_time")

    if "slot_duration_minutes" in data and data["slot_duration_minutes"] < 1:
        raise bad_request("slot_duration_minutes must be at least 1")

    # Determine slot type and validate
    day_of_week = data.get("day_of_week")
    specific_date = data.get("specific_date")
    
    if day_of_week is None and specific_date is None:
        raise bad_request("Either day_of_week or specific_date must be provided")
    
    if day_of_week is not None and specific_date is not None:
        raise bad_request("Cannot set both day_of_week and specific_date")
    
    if day_of_week is not None and not (0 <= day_of_week <= 6):
        raise bad_request("day_of_week must be between 0 and 6")

    # Check for overlapping slots
    if specific_date:
        from datetime import datetime as dt
        query_date = dt.strptime(specific_date, "%Y-%m-%d").date() if isinstance(specific_date, str) else specific_date
        # Check existing specific-date slots for this date
        specific_ranges = db.query(Availability).filter(
            Availability.provider_id == provider.id,
            Availability.specific_date == query_date,
            Availability.is_active == True,
        ).all()
        # ALSO check recurring slots for the weekday that falls on this date
        weekday = query_date.weekday()  # 0=Monday
        recurring_ranges = db.query(Availability).filter(
            Availability.provider_id == provider.id,
            Availability.day_of_week == weekday,
            Availability.specific_date == None,
            Availability.is_active == True,
        ).all()
        existing_ranges = specific_ranges + recurring_ranges
    else:
        # For recurring slots, check overlap on the weekday
        existing_ranges = db.query(Availability).filter(
            Availability.provider_id == provider.id,
            Availability.day_of_week == day_of_week,
            Availability.specific_date == None,
            Availability.is_active == True,
        ).all()
    
    for existing in existing_ranges:
        # Overlap check on [start, end) time intervals.
        if start < existing.end_time and end > existing.start_time:
            slot_type = "date" if specific_date else "weekday"
            raise conflict(
                f"Availability ranges overlap for this {slot_type}. Please add non-overlapping time ranges."
            )

    slot = Availability(
        provider_id=provider.id,
        day_of_week=day_of_week,
        specific_date=specific_date,
        start_time=start,
        end_time=end,
        slot_duration_minutes=data.get("slot_duration_minutes", 30),
    )
    db.add(slot)
    db.flush()
    
    # Notify waitlisted customers only for recurring slots
    if day_of_week is not None:
        notify_waitlisted_customers(db, provider, day_of_week)
    
    db.commit()
    db.refresh(slot)
    return slot


def notify_waitlisted_customers(db: Session, provider: ServiceProvider, day_of_week: int) -> None:
    """
    Notify the TOP waiting customer (oldest by created_at) for this provider on this day.
    High-priority: Only ONE customer is notified at a time.
    They have 30 minutes to claim the slot before moving to the next customer.
    """
    from services.notification_service import create_notification

    today = date.today()
    
    # Get all dates this month and next month that match the day_of_week
    matching_dates = []
    for offset in range(60):  # Look ahead 2 months
        check_date = today + timedelta(days=offset)
        if check_date.weekday() == day_of_week:
            matching_dates.append(check_date)
    
    if not matching_dates:
        return
    
    # First, auto-release any expired locks and move to next person
    release_expired_waitlist_locks(db, provider.id)
    
    # Find the TOP waiting customer (oldest by created_at) for this provider
    top_entry = db.query(WaitlistEntry).filter(
        WaitlistEntry.provider_id == provider.id,
        WaitlistEntry.status == "waiting",
    ).order_by(WaitlistEntry.created_at.asc()).first()
    
    if not top_entry:
        return
    
    # Determine which date to notify for
    if top_entry.preferred_date:
        if top_entry.preferred_date not in matching_dates:
            return  # Preferred date not in matching dates
        selected_date = top_entry.preferred_date
    else:
        # Notify for the next matching date
        selected_date = next((d for d in matching_dates if d >= today), matching_dates[0] if matching_dates else today)
    
    # Get customer info
    customer = db.query(User).filter(User.id == top_entry.customer_id).first()
    if not customer:
        return

    customer_email = customer.email
    customer_name = customer.full_name
    provider_name = provider.user.full_name if provider.user else "Provider"
    appointment_date_text = selected_date.strftime("%B %d, %Y")
    day_ranges = db.query(Availability).filter(
        Availability.provider_id == provider.id,
        Availability.day_of_week == day_of_week,
        Availability.is_active == True,
    ).all()
    if day_ranges:
        # For the message, summarize the window across all ranges for that weekday.
        min_start = min((r.start_time for r in day_ranges), default=None)
        max_end = max((r.end_time for r in day_ranges), default=None)
        time_slot_text = (
            f"{min_start.strftime('%H:%M') if min_start else '09:00'}-"
            f"{max_end.strftime('%H:%M') if max_end else '17:00'}"
        )
    else:
        time_slot_text = "09:00-17:00"

    # ─── Send email notification asynchronously (non-blocking) ──────────────────
    def send_email_background():
        try:
            send_waitlist_slot_email(
                recipient_email=customer_email,
                customer_name=customer_name,
                provider_name=provider_name,
                appointment_date=appointment_date_text,
                time_slot=time_slot_text,
            )
        except Exception as e:
            print(f"Background email send failed: {e}")
    
    # Start email sending in background thread (does not block API response)
    email_thread = threading.Thread(target=send_email_background, daemon=True)
    email_thread.start()
    
    # Update this entry: set to notified with 30-minute lock window
    now = datetime.now()
    top_entry.status = "notified"
    top_entry.notified_at = now
    top_entry.claim_expires_at = now + timedelta(minutes=30)  # 30-minute lock
    db.add(top_entry)
    db.flush()

    try:
        action_url = (
            f"/customer/providers/{provider.id}?"
            + urlencode(
                {
                    "fromWaitlist": "true",
                    "waitlistDate": selected_date.isoformat(),
                    "waitlistEntryId": top_entry.id,
                }
            )
        )
        create_notification(
            db=db,
            user_id=top_entry.customer_id,
            notification_type="waitlist_lock",
            title=f"Slot Available! 30-min Lock with {provider.user.full_name}",
            message=(
                f"A slot just opened up on {selected_date.strftime('%B %d, %Y')} "
                f"with {provider.user.full_name}. You have 30 minutes to claim it."
            ),
            related_entity_id=top_entry.id,
            related_entity_type="waitlist_entry",
            action_url=action_url,
        )
        db.flush()
    except Exception as e:
        print(f"Failed to create waitlist notification: {e}")


def release_expired_waitlist_locks(db: Session, provider_id: str) -> None:
    """
    Find any waitlist entries with expired locks (claim_expires_at < now) and:
    1. Revert them to 'waiting' status (move to back of queue)
    2. Notify the next waiting customer (if any)
    """
    now = datetime.now()
    
    # Find expired notified entries
    expired_entries = db.query(WaitlistEntry).filter(
        WaitlistEntry.provider_id == provider_id,
        WaitlistEntry.status == "notified",
        WaitlistEntry.claim_expires_at < now,
    ).all()
    
    for entry in expired_entries:
        # Revert to waiting (move to back of queue)
        entry.status = "waiting"
        entry.notified_at = None
        entry.claim_expires_at = None
        db.add(entry)
    
    if expired_entries:
        db.flush()
        # Now notify the next person if there's a waiting entry
        provider = db.query(ServiceProvider).filter(ServiceProvider.id == provider_id).first()
        if provider:
            # Get any availability to trigger notification
            availability = db.query(Availability).filter(
                Availability.provider_id == provider_id
            ).first()
            if availability:
                notify_waitlisted_customers(db, provider, availability.day_of_week)


def assign_lock_to_next_waitlist_customer(
    db: Session,
    provider_id: str,
    appointment_date: date,
    exclude_customer_id: str = None,
) -> None:
    """
    When a slot is canceled, assign a 30-minute lock to the top waiting customer
    who matches this date/provider. Send email + in-app notification.
    Skips the cancelling customer so they don't reclaim their own slot.
    """
    from services.notification_service import create_notification
    from utils.email import send_waitlist_lock_email
    
    now = datetime.now()
    
    # Find the TOP waiting customer who wants this date/provider
    # Order by: (1) preferred_date matches (prioritize), (2) created_at (first in queue)
    # Exclude the customer who just cancelled to prevent them from reclaiming their own slot
    from sqlalchemy import case
    query = db.query(WaitlistEntry).filter(
        WaitlistEntry.provider_id == provider_id,
        WaitlistEntry.status == "waiting",
    )
    if exclude_customer_id:
        query = query.filter(WaitlistEntry.customer_id != exclude_customer_id)
    top_entry = query.order_by(
        case((WaitlistEntry.preferred_date == appointment_date, 0), else_=1),
        WaitlistEntry.created_at.asc(),
    ).first()
    
    if not top_entry:
        return
    
    # Fetch customer and provider+user in parallel-friendly single queries
    customer = db.query(User).filter(User.id == top_entry.customer_id).first()
    provider = (
        db.query(ServiceProvider)
        .options(joinedload(ServiceProvider.user))
        .filter(ServiceProvider.id == provider_id)
        .first()
    )
    
    if not customer or not provider or not provider.user:
        return

    customer_email = customer.email
    customer_name = customer.full_name
    provider_name = provider.user.full_name
    appointment_date_text = appointment_date.strftime("%B %d, %Y")

    # Assign 30-minute lock
    lock_expires_at = now + timedelta(minutes=30)
    top_entry.status = "notified"
    top_entry.notified_at = now
    top_entry.claim_expires_at = lock_expires_at
    db.add(top_entry)
    db.flush()
    
    # Send email notification
    def send_email_background():
        try:
            send_waitlist_lock_email(
                recipient_email=customer_email,
                customer_name=customer_name,
                provider_name=provider_name,
                appointment_date=appointment_date_text,
                lock_expiry_minutes=30,
            )
        except Exception as e:
            print(f"Failed to send waitlist lock email to {customer_email}: {str(e)}")

    email_thread = threading.Thread(target=send_email_background, daemon=True)
    email_thread.start()
    
    # Create in-app notification
    try:
        action_url = (
            f"/customer/providers/{provider_id}?"
            + urlencode(
                {
                    "fromWaitlist": "true",
                    "waitlistDate": appointment_date.isoformat(),
                    "waitlistEntryId": top_entry.id,
                }
            )
        )
        create_notification(
            db=db,
            user_id=customer.id,
            notification_type="waitlist_lock",
            title=f"Slot Available! 30-min Lock with {provider.user.full_name}",
            message=f"A slot just opened up on {appointment_date.strftime('%B %d, %Y')} with {provider.user.full_name}. You have 30 minutes to book it!",
            related_entity_id=top_entry.id,
            related_entity_type="waitlist_entry",
            action_url=action_url,
        )
        db.flush()
    except Exception as e:
        print(f"Failed to create in-app notification: {str(e)}")
    
    db.flush()


def get_availability(db: Session, user_id: str) -> List[Availability]:
    provider = db.query(ServiceProvider).filter(ServiceProvider.user_id == user_id).first()
    if not provider:
        raise not_found("Provider profile")
    return db.query(Availability).filter(
        Availability.provider_id == provider.id
    ).order_by(Availability.day_of_week.asc()).all()


def update_availability(db: Session, slot_id: str, user_id: str, data: dict) -> Availability:
    provider = db.query(ServiceProvider).filter(ServiceProvider.user_id == user_id).first()
    if not provider:
        raise not_found("Provider profile")

    slot = db.query(Availability).filter(
        Availability.id == slot_id,
        Availability.provider_id == provider.id,
    ).first()
    if not slot:
        raise not_found("Availability slot")

    for field in ["day_of_week", "specific_date", "slot_duration_minutes", "is_active"]:
        if field in data and data[field] is not None:
            if field == "slot_duration_minutes" and data[field] <= 0:
                raise bad_request("slot_duration_minutes must be greater than zero")
            setattr(slot, field, data[field])

    if "start_time" in data and data["start_time"]:
        slot.start_time = datetime.strptime(data["start_time"], "%H:%M").time()
    if "end_time" in data and data["end_time"]:
        slot.end_time = datetime.strptime(data["end_time"], "%H:%M").time()

    if slot.start_time >= slot.end_time:
        raise bad_request("start_time must be before end_time")

    # If the slot is being kept active, ensure it doesn't overlap any other
    # active availability range on the same day/weekday.
    if slot.is_active:
        if slot.specific_date:
            # Check overlap for specific date slots
            other_ranges = db.query(Availability).filter(
                Availability.provider_id == provider.id,
                Availability.specific_date == slot.specific_date,
                Availability.is_active == True,
                Availability.id != slot.id,
            ).all()
        else:
            # Check overlap for recurring slots
            other_ranges = db.query(Availability).filter(
                Availability.provider_id == provider.id,
                Availability.day_of_week == slot.day_of_week,
                Availability.specific_date == None,  # Only check recurring slots
                Availability.is_active == True,
                Availability.id != slot.id,
            ).all()
        
        for other in other_ranges:
            if slot.start_time < other.end_time and slot.end_time > other.start_time:
                slot_type = "date" if slot.specific_date else "weekday"
                raise conflict(
                    f"Updated availability range overlaps with another active range for this {slot_type}."
                )

    db.commit()
    db.refresh(slot)
    return slot


def delete_availability(db: Session, slot_id: str, user_id: str) -> bool:
    provider = db.query(ServiceProvider).filter(ServiceProvider.user_id == user_id).first()
    if not provider:
        raise not_found("Provider profile")

    slot = db.query(Availability).filter(
        Availability.id == slot_id,
        Availability.provider_id == provider.id,
    ).first()
    if not slot:
        raise not_found("Availability slot")

    db.delete(slot)
    db.commit()
    return True


def get_available_slots(db: Session, provider_id: str, query_date: str) -> List[dict]:
    """
    Generate all possible time slots for a provider on a given date,
    then subtract already-booked (pending/confirmed) slots.
    Returns list of dicts: {time_slot, slot_type: "specific_date"|"recurring"}
    """
    from services.appointment_service import expire_unpaid_payment_holds

    expire_unpaid_payment_holds(db)

    target_date = datetime.strptime(query_date, "%Y-%m-%d").date()
    day_of_week = target_date.weekday()  # 0=Monday

    # Specific-date slots take priority over recurring
    specific_availabilities = db.query(Availability).filter(
        Availability.provider_id == provider_id,
        Availability.specific_date == target_date,
        Availability.is_active == True,
    ).all()

    recurring_availabilities = db.query(Availability).filter(
        Availability.provider_id == provider_id,
        Availability.day_of_week == day_of_week,
        Availability.specific_date == None,
        Availability.is_active == True,
    ).all()

    use_specific = bool(specific_availabilities)
    availabilities = specific_availabilities if use_specific else recurring_availabilities
    slot_type = "specific_date" if use_specific else "recurring"

    if not availabilities:
        return []

    # Generate all time slots
    all_slots: List[str] = []
    for availability in availabilities:
        current = datetime.combine(target_date, availability.start_time)
        end = datetime.combine(target_date, availability.end_time)
        delta = timedelta(minutes=availability.slot_duration_minutes)
        while current + delta <= end:
            all_slots.append(current.strftime("%H:%M"))
            current += delta

    all_slots = sorted(set(all_slots))

    # Get booked slots
    booked = db.query(Appointment.time_slot).filter(
        Appointment.provider_id == provider_id,
        Appointment.appointment_date == target_date,
        Appointment.status.in_(["pending", "confirmed"]),
    ).all()
    booked_slots = {slot for (slot,) in booked}

    # Persist slot inventory (idempotent)
    existing_slots = db.query(AppointmentSlot).filter(
        AppointmentSlot.provider_id == provider_id,
        AppointmentSlot.slot_date == target_date,
    ).all()
    existing_map = {slot.time_slot: slot for slot in existing_slots}

    for slot_time in all_slots:
        slot_row = existing_map.get(slot_time)
        is_booked = slot_time in booked_slots
        if slot_row:
            slot_row.is_booked = is_booked
        else:
            db.add(AppointmentSlot(
                provider_id=provider_id,
                slot_date=target_date,
                time_slot=slot_time,
                is_booked=is_booked,
            ))
    db.commit()

    return [
        {"time_slot": s, "slot_type": slot_type}
        for s in all_slots if s not in booked_slots
    ]


def get_provider_slots_schedule(
    db: Session,
    user_id: str,
    query_date: str,
) -> List[dict]:
    """
    Provider-focused slot inventory for a specific date.
    Returns ALL slot times derived from provider availability templates (empty)
    plus any currently-booked appointments for those times (occupied).
    """
    from services.appointment_service import expire_unpaid_payment_holds

    expire_unpaid_payment_holds(db)

    provider = db.query(ServiceProvider).filter(ServiceProvider.user_id == user_id).first()
    if not provider:
        raise not_found("Provider profile")

    target_date = datetime.strptime(query_date, "%Y-%m-%d").date()
    day_of_week = target_date.weekday()  # 0=Monday

    # 1) Generate slot inventory from availability ranges (specific date or recurring weekday).
    # First check for specific date availability
    specific_availabilities = db.query(Availability).filter(
        Availability.provider_id == provider.id,
        Availability.specific_date == target_date,
        Availability.is_active == True,
    ).all()
    
    # Then check for recurring day_of_week availability
    recurring_availabilities = db.query(Availability).filter(
        Availability.provider_id == provider.id,
        Availability.day_of_week == day_of_week,
        Availability.specific_date == None,  # Only recurring slots
        Availability.is_active == True,
    ).all()
    
    # Use specific date availabilities if available, otherwise use recurring
    availabilities = specific_availabilities if specific_availabilities else recurring_availabilities

    generated_slots: set[str] = set()
    for availability in availabilities:
        current = datetime.combine(target_date, availability.start_time)
        end = datetime.combine(target_date, availability.end_time)
        delta = timedelta(minutes=availability.slot_duration_minutes)

        while current + delta <= end:
            generated_slots.add(current.strftime("%H:%M"))
            current += delta

    # 2) Fetch currently booked slots (pending/confirmed).
    booked_appts = db.query(Appointment).options(joinedload(Appointment.customer)).filter(
        Appointment.provider_id == provider.id,
        Appointment.appointment_date == target_date,
        Appointment.status.in_(["pending", "confirmed"]),
    ).all()
    booked_map = {appt.time_slot: appt for appt in booked_appts}
    booked_slots = set(booked_map.keys())

    # Union: show occupied slots even if they fall outside the latest availability templates.
    all_slots = sorted(generated_slots.union(booked_slots))

    # 3) Upsert AppointmentSlot inventory rows (idempotent).
    existing_slots = db.query(AppointmentSlot).filter(
        AppointmentSlot.provider_id == provider.id,
        AppointmentSlot.slot_date == target_date,
    ).all()
    existing_map = {slot.time_slot: slot for slot in existing_slots}

    for slot_time in all_slots:
        slot_row = existing_map.get(slot_time)
        is_booked = slot_time in booked_slots
        if slot_row:
            slot_row.is_booked = is_booked
        else:
            db.add(
                AppointmentSlot(
                    provider_id=provider.id,
                    slot_date=target_date,
                    time_slot=slot_time,
                    is_booked=is_booked,
                )
            )

    db.commit()

    # 4) Response payload with slot occupancy + appointment details (when booked).
    out: List[dict] = []
    for slot_time in all_slots:
        appt = booked_map.get(slot_time)
        out.append(
            {
                "time_slot": slot_time,
                "is_booked": slot_time in booked_slots,
                "appointment": (
                    {
                        "id": appt.id,
                        "status": appt.status,
                        "customer": {
                            "id": appt.customer.id if appt.customer else None,
                            "full_name": appt.customer.full_name if appt.customer else None,
                        },
                        "notes": appt.notes,
                        "category_id": appt.category_id,
                    }
                    if appt
                    else None
                ),
            }
        )
    return out
