from datetime import datetime, date, timedelta
from typing import Optional, List
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import or_, and_, func

from models.service_provider import ServiceProvider
from models.user import User
from models.category import Category
from models.appointment import Appointment
from models.organization import Organization
from utils.exceptions import not_found, bad_request


def get_providers(
    db: Session,
    search: Optional[str] = None,
    category_id: Optional[int] = None,
    location: Optional[str] = None,
    min_rating: Optional[float] = None,
    organization_id: Optional[str] = None,
    page: int = 1,
    limit: int = 12,
) -> dict:
    """Paginated provider listing with search + filters."""
    query = (
        db.query(ServiceProvider)
        .options(
            joinedload(ServiceProvider.user),
            joinedload(ServiceProvider.category),
            joinedload(ServiceProvider.organization),
        )
        .filter(ServiceProvider.approval_status == "approved")
    )

    if search:
        query = query.join(ServiceProvider.user).outerjoin(ServiceProvider.category).outerjoin(ServiceProvider.organization)
        
        # Split search by '+' if present, otherwise by space, ignoring empty strings
        if '+' in search:
            tokens = [t.strip() for t in search.split('+') if t.strip()]
        else:
            tokens = [t.strip() for t in search.split() if t.strip()]
            
        for token in tokens:
            # BUG FIX: When provider has no organization (organization_id = NULL),
            # Organization.name.ilike() returns NULL, breaking the OR condition.
            # Use coalesce to handle independent providers.
            query = query.filter(
                or_(
                    User.full_name.ilike(f"%{token}%"),
                    ServiceProvider.specialization.ilike(f"%{token}%"),
                    ServiceProvider.location.ilike(f"%{token}%"),
                    Category.name.ilike(f"%{token}%"),
                    func.coalesce(Organization.name, "").ilike(f"%{token}%"),
                )
            )
    if category_id:
        query = query.filter(ServiceProvider.category_id == category_id)
    if organization_id:
        query = query.filter(ServiceProvider.organization_id == organization_id)
    if location:
        query = query.filter(ServiceProvider.location.ilike(f"%{location}%"))
    if min_rating:
        query = query.filter(ServiceProvider.avg_rating >= min_rating)

    total = query.count()
    providers = (
        query.order_by(ServiceProvider.avg_rating.desc())
        .offset((page - 1) * limit)
        .limit(limit)
        .all()
    )
    return {"total": total, "page": page, "total_pages": -(-total // limit), "providers": providers}


def get_provider_detail(db: Session, provider_id: str) -> ServiceProvider:
    provider = (
        db.query(ServiceProvider)
        .options(
            joinedload(ServiceProvider.user),
            joinedload(ServiceProvider.category),
            joinedload(ServiceProvider.organization),
            joinedload(ServiceProvider.availability_slots),
        )
        .filter(ServiceProvider.id == provider_id)
        .filter(ServiceProvider.approval_status == "approved")
        .first()
    )
    if not provider:
        raise not_found("Provider")
    return provider
