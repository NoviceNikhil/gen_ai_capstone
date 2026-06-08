from datetime import date, datetime, timedelta
from typing import List, Optional
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func

from models.service_provider import ServiceProvider
from models.provider_onboarding import ProviderOnboarding
from models.availability import Availability
from models.appointment import Appointment
from models.appointment_history import AppointmentHistory
from utils.exceptions import not_found, bad_request, forbidden


def get_provider_profile(db: Session, user_id: str) -> ServiceProvider:
    provider = (
        db.query(ServiceProvider)
        .options(
            joinedload(ServiceProvider.user),
            joinedload(ServiceProvider.category),
            joinedload(ServiceProvider.organization),
            joinedload(ServiceProvider.onboarding),
        )
        .filter(ServiceProvider.user_id == user_id)
        .first()
    )
    if not provider:
        raise not_found("Provider profile")
    return provider


def get_provider_onboarding(db: Session, user_id: str) -> ProviderOnboarding:
    provider = db.query(ServiceProvider).filter(ServiceProvider.user_id == user_id).first()
    if not provider:
        raise not_found("Provider profile")

    onboarding = (
        db.query(ProviderOnboarding)
        .filter(ProviderOnboarding.provider_id == provider.id)
        .first()
    )
    if not onboarding:
        onboarding = ProviderOnboarding(provider_id=provider.id)
        db.add(onboarding)
        db.commit()
        db.refresh(onboarding)
    return onboarding


def upsert_provider_onboarding(db: Session, user_id: str, update_data: dict) -> ProviderOnboarding:
    provider = db.query(ServiceProvider).filter(ServiceProvider.user_id == user_id).first()
    if not provider:
        raise not_found("Provider profile")

    onboarding = (
        db.query(ProviderOnboarding)
        .filter(ProviderOnboarding.provider_id == provider.id)
        .first()
    )
    if not onboarding:
        onboarding = ProviderOnboarding(provider_id=provider.id)
        db.add(onboarding)
        db.flush()

    allowed_fields = [
        "organization_name",
        "owner_name",
        "email",
        "phone",
        "address",
        "identity_proof_url",
        "tax_number",
        "bank_details",
        "profile_photo_url",
        "certificates_urls",
        "submitted_for_approval",
    ]
    for field in allowed_fields:
        if field in update_data and update_data[field] is not None:
            setattr(onboarding, field, update_data[field])

    # Also update these professional details on the ServiceProvider profile directly
    profile_fields = [
        "organization_name", "owner_name", "address", "tax_number", "bank_details",
        "identity_proof_url", "certificates_urls", "profile_photo_url",
        "specialization", "experience_years", "profile_description",
        "consultation_fee", "category_id", "state", "city", "pincode"
    ]
    for field in profile_fields:
        if field in update_data and update_data[field] is not None:
            setattr(provider, field, update_data[field])

    # Dynamic location sync
    if provider.city and provider.state:
        # If city/state are enum objects or strings, get their values
        c_val = provider.city.value if hasattr(provider.city, "value") else str(provider.city)
        s_val = provider.state.value if hasattr(provider.state, "value") else str(provider.state)
        provider.location = f"{c_val}, {s_val}"

    db.commit()
    db.refresh(onboarding)
    db.refresh(provider)
    return onboarding


def update_provider_profile(db: Session, user_id: str, update_data: dict) -> ServiceProvider:
    provider = db.query(ServiceProvider).filter(ServiceProvider.user_id == user_id).first()
    if not provider:
        raise not_found("Provider profile")

    allowed_fields = [
        "specialization", "experience_years", "profile_description",
        "location", "consultation_fee", "is_accepting_appointments", "category_id",
        "profile_photo_url", "state", "city", "pincode",
        "organization_name", "owner_name", "address", "tax_number",
        "bank_details", "identity_proof_url", "certificates_urls"
    ]
    for field in allowed_fields:
        if field in update_data and update_data[field] is not None:
            setattr(provider, field, update_data[field])

    # Dynamic location sync
    if provider.city and provider.state:
        c_val = provider.city.value if hasattr(provider.city, "value") else str(provider.city)
        s_val = provider.state.value if hasattr(provider.state, "value") else str(provider.state)
        provider.location = f"{c_val}, {s_val}"

    db.commit()
    db.refresh(provider)
    return provider


def _get_payment_details(appointment: Appointment, db: Session) -> dict:
    if not appointment.is_paid:
        return {
            "gross_amount": 0.0,
            "commission_amount": 0.0,
            "net_earnings": 0.0,
            "payout_status": "No Payout",
            "payout_date": None
        }

    from models import CommissionLedger
    ledger = db.query(CommissionLedger).filter(CommissionLedger.appointment_id == appointment.id).first()
    if ledger:
        gross = float(ledger.gross_amount)
        commission = float(ledger.platform_commission_amount)
        net = float(ledger.provider_payout_amount)
    else:
        gross = float(appointment.consultation_fee_snapshot or 0.0)
        commission = round(gross * 0.10, 2)
        net = round(gross - commission, 2)

    payout_date = appointment.appointment_date + timedelta(days=2)
    is_released = (date.today() >= payout_date) and (appointment.status == "completed")
    payout_status = "Available" if is_released else "Escrowed"

    return {
        "gross_amount": gross,
        "commission_amount": commission,
        "net_earnings": net,
        "payout_status": payout_status,
        "payout_date": str(payout_date)
    }


def _map_appointment(appointment: Appointment, db: Session) -> dict:
    from fastapi.encoders import jsonable_encoder
    data = jsonable_encoder(appointment)
    data["payment_details"] = _get_payment_details(appointment, db)
    # Include service selections for insights/charts
    data["service_selections"] = [
        {
            "service_title": sel.service_title,
            "duration_minutes": sel.duration_minutes,
            "service_price_snapshot": float(sel.service_price_snapshot or 0),
        }
        for sel in (appointment.service_selections or [])
    ]
    return data


def get_provider_appointments(
    db: Session,
    user_id: str,
    status: Optional[str] = None,
    from_date: Optional[date] = None,
    to_date: Optional[date] = None,
    page: int = 1,
    limit: int = 10,
) -> dict:
    from services.appointment_service import expire_unpaid_payment_holds

    expire_unpaid_payment_holds(db)

    provider = db.query(ServiceProvider).filter(ServiceProvider.user_id == user_id).first()
    if not provider:
        raise not_found("Provider profile")

    query = (
        db.query(Appointment)
        .options(joinedload(Appointment.customer), joinedload(Appointment.category))
        .filter(Appointment.provider_id == provider.id)
    )
    if status:
        query = query.filter(Appointment.status == status)
    if from_date:
        query = query.filter(Appointment.appointment_date >= from_date)
    if to_date:
        query = query.filter(Appointment.appointment_date <= to_date)

    total = query.count()
    appointments = (
        query.order_by(Appointment.appointment_date.asc(), Appointment.time_slot.asc())
        .offset((page - 1) * limit)
        .limit(limit)
        .all()
    )

    mapped_appointments = [_map_appointment(a, db) for a in appointments]
    return {"total": total, "page": page, "total_pages": -(-total // limit), "appointments": mapped_appointments}


def get_provider_dashboard(db: Session, user_id: str) -> dict:
    from services.appointment_service import expire_unpaid_payment_holds

    expire_unpaid_payment_holds(db)

    provider = db.query(ServiceProvider).filter(ServiceProvider.user_id == user_id).first()
    if not provider:
        raise not_found("Provider profile")

    today = date.today()

    total = db.query(func.count(Appointment.id)).filter(Appointment.provider_id == provider.id).scalar()
    today_count = db.query(func.count(Appointment.id)).filter(
        Appointment.provider_id == provider.id,
        Appointment.appointment_date == today,
        Appointment.status.in_(["pending", "confirmed"]),
    ).scalar()
    pending_count = db.query(func.count(Appointment.id)).filter(
        Appointment.provider_id == provider.id,
        Appointment.status == "pending",
    ).scalar()
    completed_count = db.query(func.count(Appointment.id)).filter(
        Appointment.provider_id == provider.id,
        Appointment.status == "completed",
    ).scalar()

    todays_appointments = (
        db.query(Appointment)
        .options(joinedload(Appointment.customer))
        .filter(
            Appointment.provider_id == provider.id,
            Appointment.appointment_date == today,
            Appointment.status.in_(["pending", "confirmed"]),
        )
        .order_by(Appointment.time_slot.asc())
        .all()
    )

    upcoming = (
        db.query(Appointment)
        .options(joinedload(Appointment.customer))
        .filter(
            Appointment.provider_id == provider.id,
            Appointment.appointment_date > today,
            Appointment.status.in_(["pending", "confirmed"]),
        )
        .order_by(Appointment.appointment_date.asc(), Appointment.time_slot.asc())
        .limit(5)
        .all()
    )

    return {
        "total_appointments": total,
        "today_count": today_count,
        "pending_count": pending_count,
        "completed_count": completed_count,
        "todays_appointments": todays_appointments,
        "upcoming_appointments": upcoming,
    }
