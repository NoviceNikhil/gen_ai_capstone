import json
from sqlalchemy.orm import Session

from models import ServiceProvider, ServiceOffering, ProviderIntakeForm
from utils.exceptions import not_found, bad_request


def _provider_by_user(db: Session, user_id: str) -> ServiceProvider:
    provider = db.query(ServiceProvider).filter(ServiceProvider.user_id == user_id).first()
    if not provider:
        raise not_found("Provider profile")
    return provider


def list_offerings(db: Session, user_id: str):
    provider = _provider_by_user(db, user_id)
    return db.query(ServiceOffering).filter(ServiceOffering.provider_id == provider.id).order_by(ServiceOffering.created_at.desc()).all()


def upsert_offering(db: Session, user_id: str, payload: dict):
    provider = _provider_by_user(db, user_id)
    offering_id = payload.get("id")
    offering = None
    if offering_id:
        offering = db.query(ServiceOffering).filter(
            ServiceOffering.id == offering_id,
            ServiceOffering.provider_id == provider.id,
        ).first()
    if not offering:
        offering = ServiceOffering(provider_id=provider.id, title=payload["title"])
        db.add(offering)

    offering.title = payload["title"]
    offering.description = payload.get("description")
    offering.duration_minutes = int(payload.get("duration_minutes", 30))
    offering.price = float(payload.get("price", 0))
    offering.is_active = bool(payload.get("is_active", True))
    db.commit()
    db.refresh(offering)
    return offering


def get_intake_form(db: Session, user_id: str):
    provider = _provider_by_user(db, user_id)
    return db.query(ProviderIntakeForm).filter(
        ProviderIntakeForm.provider_id == provider.id,
        ProviderIntakeForm.is_active == True,
    ).order_by(ProviderIntakeForm.updated_at.desc()).first()


def upsert_intake_form(db: Session, user_id: str, title: str, fields):
    provider = _provider_by_user(db, user_id)
    if not isinstance(fields, list):
        raise bad_request("fields must be an array")
    existing = get_intake_form(db, user_id)
    if not existing:
        existing = ProviderIntakeForm(provider_id=provider.id, title=title or "Pre-Appointment Form")
        db.add(existing)
    existing.title = title or "Pre-Appointment Form"
    existing.fields_json = json.dumps(fields)
    existing.is_active = True
    db.commit()
    db.refresh(existing)
    return existing
