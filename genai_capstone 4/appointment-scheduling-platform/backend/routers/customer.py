from fastapi import APIRouter, Depends, Query, Request
from fastapi.responses import JSONResponse
from fastapi.encoders import jsonable_encoder
from sqlalchemy.orm import Session
from typing import Optional
from datetime import date

from config.database import get_db
from middleware.auth import get_current_user
from services import customer_service, appointment_service, availability_service, customer_booking_service
from services.cache_service import get, set, invalidate
from schemas.appointment import (
    BookAppointmentRequest,
    RescheduleRequest,
    RescheduleRespondRequest,
    CancelRequest,
    JoinWaitlistRequest,
    SubmitReviewRequest,
)
from utils.response import success_response, success_envelope

router = APIRouter(prefix="/api/customer", tags=["Customer"])


# ──────────────────────────────────────────────────────────────────────────────
# PROVIDER DISCOVERY
# ──────────────────────────────────────────────────────────────────────────────

@router.get("/providers")
def list_providers(
    request: Request,
    search: Optional[str] = Query(None),
    category_id: Optional[int] = Query(None),
    organization_id: Optional[str] = Query(None),
    location: Optional[str] = Query(None),
    min_rating: Optional[float] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(12, le=50),
    db: Session = Depends(get_db),
):
    cache_key = f"cache:customer:providers:search={search}:category={category_id}:org={organization_id}:location={location}:rating={min_rating}:page={page}:limit={limit}"
    cached = get(cache_key)
    if cached:
        return JSONResponse(status_code=200, content=cached)
    data = customer_service.get_providers(db, search, category_id, location, min_rating, organization_id, page, limit)
    payload = success_envelope(jsonable_encoder(data), "Providers fetched")
    set(cache_key, payload, ttl=120)
    return JSONResponse(status_code=200, content=payload)


@router.get("/providers/{provider_id}")
def get_provider(provider_id: str, db: Session = Depends(get_db)):
    cache_key = f"cache:customer:provider:{provider_id}"
    cached = get(cache_key)
    if cached:
        return JSONResponse(status_code=200, content=cached)
    data = customer_service.get_provider_detail(db, provider_id)
    payload = success_envelope(jsonable_encoder({"provider": data}), "Provider detail fetched")
    set(cache_key, payload, ttl=300)
    return JSONResponse(status_code=200, content=payload)


@router.get("/providers/{provider_id}/slots")
def get_available_slots(
    provider_id: str,
    date: str = Query(..., description="YYYY-MM-DD"),
    db: Session = Depends(get_db),
):
    cache_key = f"cache:customer:slots:{provider_id}:{date}"
    cached = get(cache_key)
    if cached:
        return JSONResponse(status_code=200, content=cached)
    slots = availability_service.get_available_slots(db, provider_id, date)
    payload = success_envelope(jsonable_encoder({"available_slots": slots, "date": date}), "Available slots fetched")
    set(cache_key, payload, ttl=30)
    return JSONResponse(status_code=200, content=payload)


@router.get("/providers/{provider_id}/booking-config")
def get_provider_booking_config(
    provider_id: str,
    db: Session = Depends(get_db),
):
    cache_key = f"cache:customer:booking-config:{provider_id}"
    cached = get(cache_key)
    if cached:
        return JSONResponse(status_code=200, content=cached)
    data = customer_booking_service.get_provider_booking_config(db, provider_id)
    payload = success_envelope(jsonable_encoder(data), "Provider booking config fetched")
    set(cache_key, payload, ttl=300)
    return JSONResponse(status_code=200, content=payload)


@router.get("/providers/{provider_id}/waitlist-stats")
def get_provider_waitlist_stats(
    provider_id: str,
    db: Session = Depends(get_db),
):
    """Get lightweight waitlist stats for a provider (public)."""
    from models.waitlist_entry import WaitlistEntry
    from sqlalchemy import func

    waiting_count = (
        db.query(func.count(WaitlistEntry.id))
        .filter(
            WaitlistEntry.provider_id == provider_id,
            WaitlistEntry.status.in_(["waiting", "notified"]),
        )
        .scalar()
    )
    return success_response(
        {"waiting_count": int(waiting_count or 0)},
        "Waitlist stats fetched",
    )


@router.post("/providers/{provider_id}/waitlist")
def join_waitlist(
    provider_id: str,
    body: JoinWaitlistRequest,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    result = customer_booking_service.join_waitlist(
        db, customer_id=current_user["id"], provider_id=provider_id, preferred_date=body.preferred_date
    )
    invalidate(f"cache:customer:provider:{provider_id}")
    return success_response({"waitlist_entry": result}, "Added to waitlist", 201)


@router.get("/waitlist")
def get_my_waitlist(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Get all active waitlist entries for current customer"""
    entries = customer_booking_service.get_customer_waitlist(db, current_user["id"])
    return success_response({"waitlist_entries": entries}, "Waitlist fetched")


@router.delete("/waitlist/{entry_id}")
def leave_waitlist(
    entry_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Leave a waitlist entry"""
    result = customer_booking_service.leave_waitlist(db, current_user["id"], entry_id)
    invalidate(f"cache:customer:waitlist:{current_user['id']}")
    return success_response(result, "Left waitlist", 200)


@router.post("/waitlist/{entry_id}/release-lock")
def release_waitlist_lock(
    entry_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Release your open lock and pass to next customer in queue"""
    result = customer_booking_service.release_lock(db, current_user["id"], entry_id)
    invalidate(f"cache:customer:waitlist:{current_user['id']}")
    return success_response(result, "Lock released", 200)


@router.post("/waitlist/{entry_id}/claim")
def claim_waitlist_slot(
    entry_id: str,
    body: BookAppointmentRequest,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Claim a notified waitlist slot and book the appointment
    
    Requirements:
    - Waitlist entry must be in 'notified' status
    - 30-minute lock window must not have expired
    - This is the top person in the queue for this provider
    """
    try:
        # Mark waitlist entry as fulfilled (validates status and lock window)
        customer_booking_service.fulfill_waitlist_entry(db, entry_id, current_user["id"])
        
        # Book appointment
        appt = appointment_service.book_appointment(
            db,
            customer_id=current_user["id"],
            provider_id=body.provider_id,
            appointment_date=body.appointment_date,
            time_slot=body.time_slot,
            category_id=body.category_id,
            notes=body.notes or "Claimed from waitlist",
            offering_id=body.offering_id,
            intake_answers=body.intake_answers,
            package_purchase_id=body.package_purchase_id,
        )
        
        invalidate(f"cache:customer:waitlist:{current_user['id']}")
        invalidate(f"cache:customer:dashboard:{current_user['id']}")
        return success_response({"appointment": appt}, "Waitlist slot claimed and appointment booked", 201)
    except Exception as e:
        # Re-raise the error with clear message
        raise


@router.post("/waitlist")
def join_waitlist(
    body: JoinWaitlistRequest,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Join the waitlist for a provider when slot is full or unavailable
    
    The customer will be notified when a slot becomes available and gets a 30-min lock
    """
    entry = customer_booking_service.join_waitlist(
        db,
        customer_id=current_user["id"],
        provider_id=body.provider_id,
        preferred_date=body.appointment_date,
    )
    
    invalidate(f"cache:customer:waitlist:{current_user['id']}")
    return success_response({
        "waitlist_entry": {
            "id": entry.id,
            "provider_id": entry.provider_id,
            "preferred_date": str(entry.preferred_date),
            "status": entry.status,
            "created_at": str(entry.created_at),
        }
    }, "Added to waitlist. You'll be notified when a slot opens up!", 201)


@router.post("/waitlist/{entry_id}/release")
def release_waitlist_lock(
    entry_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Release a waitlist lock and pass it to the next customer in queue
    
    Use this when you don't want to book the appointment after getting the lock
    """
    customer_booking_service.release_waitlist_lock(db, entry_id, current_user["id"])
    
    invalidate(f"cache:customer:waitlist:{current_user['id']}")
    invalidate(f"cache:customer:dashboard:{current_user['id']}")
    return success_response({}, "Slot released. It's now available for the next customer on the waitlist.", 200)



@router.post("/packages/{package_id}/purchase")
def purchase_package(
    package_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    purchase = customer_booking_service.purchase_package(db, current_user["id"], package_id)
    invalidate(f"cache:customer:packages:{current_user['id']}")
    return success_response({"package_purchase": purchase}, "Package purchased", 201)


@router.get("/packages/my")
def my_packages(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    cache_key = f"cache:customer:packages:{current_user['id']}"
    cached = get(cache_key)
    if cached:
        return JSONResponse(status_code=200, content=cached)
    purchases = customer_booking_service.get_customer_packages(db, current_user["id"])
    payload = success_envelope(jsonable_encoder({"purchases": purchases}), "Customer package balances fetched")
    set(cache_key, payload, ttl=120)
    return JSONResponse(status_code=200, content=payload)


# ──────────────────────────────────────────────────────────────────────────────
# APPOINTMENTS
# ──────────────────────────────────────────────────────────────────────────────

@router.post("/appointments")
def book_appointment(
    body: BookAppointmentRequest,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    appt = appointment_service.book_appointment(
        db,
        customer_id=current_user["id"],
        provider_id=body.provider_id,
        appointment_date=body.appointment_date,
        time_slot=body.time_slot,
        category_id=body.category_id,
        notes=body.notes,
        offering_id=body.offering_id,
        intake_answers=body.intake_answers,
        package_purchase_id=body.package_purchase_id,
    )
    invalidate(f"cache:customer:dashboard:{current_user['id']}")
    return success_response({"appointment": appt}, "Appointment booked successfully", 201)


@router.post("/book-or-join-waitlist")
def book_appointment_or_join_waitlist(
    body: BookAppointmentRequest,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Try to book appointment; if slot is full, automatically join waitlist
    
    Returns either:
    - {"type": "appointment", "appointment": {...}} if booked
    - {"type": "waitlist", "waitlist_entry": {...}} if added to waitlist
    """
    from utils.exceptions import conflict as conflict_exc
    
    try:
        # Try to book the appointment
        appt = appointment_service.book_appointment(
            db,
            customer_id=current_user["id"],
            provider_id=body.provider_id,
            appointment_date=body.appointment_date,
            time_slot=body.time_slot,
            category_id=body.category_id,
            notes=body.notes,
            offering_id=body.offering_id,
            intake_answers=body.intake_answers,
            package_purchase_id=body.package_purchase_id,
        )
        invalidate(f"cache:customer:dashboard:{current_user['id']}")
        return success_response({
            "type": "appointment",
            "appointment": appt
        }, "Appointment booked successfully", 201)
    except Exception as e:
        # If slot is full/conflict, try to join waitlist instead
        if "already booked" in str(e) or "reserved" in str(e):
            entry = customer_booking_service.join_waitlist(
                db,
                customer_id=current_user["id"],
                provider_id=body.provider_id,
                preferred_date=body.appointment_date,
            )
            invalidate(f"cache:customer:waitlist:{current_user['id']}")
            return success_response({
                "type": "waitlist",
                "waitlist_entry": {
                    "id": entry.id,
                    "provider_id": entry.provider_id,
                    "preferred_date": str(entry.preferred_date),
                    "status": entry.status,
                    "created_at": str(entry.created_at),
                }
            }, "Slot is full. You've been added to the waitlist. You'll be notified when a slot opens!", 201)
        else:
            # Re-raise other exceptions
            raise


@router.get("/appointments")
def get_my_appointments(
    status: Optional[str] = Query(None),
    from_date: Optional[date] = Query(None),
    to_date: Optional[date] = Query(None),
    provider_name: Optional[str] = Query(None),
    is_paid: Optional[bool] = Query(None),
    category_id: Optional[int] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=1000),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    cache_key = (
        f"cache:customer:appointments:{current_user['id']}"
        f":status={status}"
        f":from={from_date}"
        f":to={to_date}"
        f":provider_name={provider_name}"
        f":is_paid={is_paid}"
        f":category_id={category_id}"
        f":page={page}"
        f":limit={limit}"
    )
    cached = get(cache_key)
    if cached:
        return JSONResponse(status_code=200, content=cached)
    data = appointment_service.get_customer_appointments(
        db,
        current_user["id"],
        status,
        from_date,
        to_date,
        provider_name,
        is_paid,
        category_id,
        page,
        limit,
    )
    payload = success_envelope(jsonable_encoder(data), "Appointments fetched")
    set(cache_key, payload, ttl=45)
    return JSONResponse(status_code=200, content=payload)


@router.get("/appointments/{appointment_id}")
def get_appointment(
    appointment_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    cache_key = f"cache:customer:appointment:{current_user['id']}:{appointment_id}"
    cached = get(cache_key)
    if cached:
        return JSONResponse(status_code=200, content=cached)
    appt = appointment_service.get_appointment_by_id(db, appointment_id, current_user["id"], "customer")
    payload = success_envelope(jsonable_encoder({"appointment": appt}), "Appointment fetched")
    set(cache_key, payload, ttl=45)
    return JSONResponse(status_code=200, content=payload)


@router.get("/appointments/{appointment_id}/cancel-preview")
def preview_cancellation(
    appointment_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """
    Preview the cancellation penalty and refund amount for an appointment.
    """
    data = appointment_service.preview_cancellation(db, appointment_id, current_user["id"], "customer")
    return success_response(data)


@router.patch("/appointments/{appointment_id}/cancel")
def cancel_appointment(
    appointment_id: str,
    body: CancelRequest,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    appt = appointment_service.cancel_appointment(
        db, appointment_id, current_user["id"], "customer", body.cancellation_reason
    )
    invalidate(f"cache:customer:appointment:{current_user['id']}:{appointment_id}")
    invalidate(f"cache:customer:dashboard:{current_user['id']}")
    return success_response({"appointment": appt}, "Appointment cancelled")


@router.patch("/appointments/{appointment_id}/reschedule")
def request_reschedule(
    appointment_id: str,
    body: RescheduleRequest,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    req = appointment_service.create_reschedule_request(
        db, appointment_id, current_user["id"], "customer", body.appointment_date, body.time_slot
    )
    invalidate(f"cache:customer:appointment:{current_user['id']}:{appointment_id}")
    invalidate(f"cache:customer:dashboard:{current_user['id']}")
    provider_user_id = req.appointment.provider.user_id if (req.appointment and req.appointment.provider) else None
    if provider_user_id:
        invalidate(f"cache:provider:appointment:{provider_user_id}:{appointment_id}")
        invalidate(f"cache:provider:dashboard:{provider_user_id}")
    return success_response({"reschedule_request_id": req.id}, "Reschedule requested")


@router.patch("/reschedule-requests/{request_id}/respond")
def respond_reschedule(
    request_id: str,
    body: RescheduleRespondRequest,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    req = appointment_service.respond_to_reschedule_request(
        db, request_id, current_user["id"], "customer", body.action
    )
    invalidate(f"cache:customer:appointment:{current_user['id']}:{req.appointment_id}")
    invalidate(f"cache:customer:dashboard:{current_user['id']}")
    provider_user_id = req.appointment.provider.user_id if (req.appointment and req.appointment.provider) else None
    if provider_user_id:
        invalidate(f"cache:provider:appointment:{provider_user_id}:{req.appointment_id}")
        invalidate(f"cache:provider:dashboard:{provider_user_id}")
    return success_response({"status": req.status}, f"Reschedule request {req.status}")


# ──────────────────────────────────────────────────────────────────────────────
# DASHBOARD
# ──────────────────────────────────────────────────────────────────────────────

@router.get("/dashboard")
def customer_dashboard(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    cache_key = f"cache:customer:dashboard:{current_user['id']}"
    cached = get(cache_key)
    if cached:
        return JSONResponse(status_code=200, content=cached)
    data = appointment_service.get_customer_dashboard(db, current_user["id"])
    payload = success_envelope(jsonable_encoder(data), "Dashboard stats fetched")
    set(cache_key, payload, ttl=60)
    return JSONResponse(status_code=200, content=payload)


@router.get("/reviews")
def get_my_reviews(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    data = appointment_service.get_customer_reviews(db, current_user["id"])
    return success_response(data, "Reviews fetched")


@router.post("/appointments/{appointment_id}/review")
def submit_review(
    appointment_id: str,
    body: SubmitReviewRequest,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    review = appointment_service.submit_provider_review(
        db,
        appointment_id=appointment_id,
        customer_id=current_user["id"],
        rating=body.rating,
        comment=body.comment,
    )
    return success_response({"review": review}, "Review submitted", 201)


# ──────────────────────────────────────────────────────────────────────────────
# PAYMENTS & REFUNDS RECORD LISTINGS
# ──────────────────────────────────────────────────────────────────────────────

@router.get("/payment-records")
def get_my_payments(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    from models.payment_records import PaymentRecord
    from models.appointment import Appointment
    from models.service_provider import ServiceProvider
    from models.user import User

    records = (
        db.query(PaymentRecord)
        .filter(
            PaymentRecord.customer_id == current_user["id"],
            PaymentRecord.status != "pending",
        )
        .order_by(PaymentRecord.created_at.desc())
        .all()
    )
    
    results = []
    for r in records:
        appt = db.query(Appointment).filter(Appointment.id == r.appointment_id).first()
        provider_name = "Provider"
        if appt:
            prov = db.query(ServiceProvider).filter(ServiceProvider.id == appt.provider_id).first()
            if prov:
                pu = db.query(User).filter(User.id == prov.user_id).first()
                if pu:
                    provider_name = pu.full_name
        
        results.append({
            "id": r.id,
            "appointment_id": r.appointment_id,
            "provider_name": provider_name,
            "amount": float(r.amount),
            "status": r.status,
            "razorpay_order_id": r.razorpay_order_id,
            "razorpay_payment_id": r.razorpay_payment_id,
            "created_at": r.created_at.isoformat() if r.created_at else None,
            "appointment_date": appt.appointment_date.isoformat() if appt else None,
            "time_slot": appt.time_slot if appt else None,
        })
    return success_response({"payments": results}, "Payment records fetched")


@router.get("/refund-records")
def get_my_refunds(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    from models.payment_records import RefundRecord
    from models.appointment import Appointment
    from models.service_provider import ServiceProvider
    from models.user import User

    records = (
        db.query(RefundRecord)
        .filter(RefundRecord.customer_id == current_user["id"])
        .order_by(RefundRecord.created_at.desc())
        .all()
    )
    
    results = []
    for r in records:
        appt = db.query(Appointment).filter(Appointment.id == r.appointment_id).first()
        provider_name = "Provider"
        if appt:
            prov = db.query(ServiceProvider).filter(ServiceProvider.id == appt.provider_id).first()
            if prov:
                pu = db.query(User).filter(User.id == prov.user_id).first()
                if pu:
                    provider_name = pu.full_name

        results.append({
            "id": r.id,
            "appointment_id": r.appointment_id,
            "provider_name": provider_name,
            "amount": float(r.amount),
            "penalty_deducted": float(r.penalty_deducted),
            "reason": r.reason,
            "status": r.status,
            "created_at": r.created_at.isoformat() if r.created_at else None,
            "appointment_date": appt.appointment_date.isoformat() if appt else None,
            "time_slot": appt.time_slot if appt else None,
        })
    return success_response({"refunds": results}, "Refund records fetched")
