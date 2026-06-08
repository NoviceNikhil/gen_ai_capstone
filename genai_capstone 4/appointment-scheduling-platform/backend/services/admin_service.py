from datetime import date, timedelta
from typing import Optional
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func

from models.user import User
from models.service_provider import ServiceProvider
from models.appointment import Appointment
from models.category import Category
from models.organization import Organization, OrganizationRequest
from utils.exceptions import not_found, bad_request


def get_all_users(
    db: Session,
    role: Optional[str] = None,
    search: Optional[str] = None,
    page: int = 1,
    limit: int = 20,
) -> dict:
    query = db.query(User).filter(User.deleted_at.is_(None))
    if role:
        query = query.filter(User.role == role)
    if search:
        query = query.filter(
            User.full_name.ilike(f"%{search}%") | User.email.ilike(f"%{search}%")
        )
    total = query.count()
    users = (
        query.order_by(User.created_at.desc())
        .offset((page - 1) * limit)
        .limit(limit)
        .all()
    )
    return {"total": total, "page": page, "total_pages": -(-total // limit), "users": users}


def update_user_status(db: Session, user_id: str, is_active: bool) -> User:
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise not_found("User")
    user.is_active = is_active
    db.commit()
    db.refresh(user)
    return user


def get_all_providers(
    db: Session,
    is_verified: Optional[bool] = None,
    search: Optional[str] = None,
    page: int = 1,
    limit: int = 20,
) -> dict:
    query = db.query(ServiceProvider).options(
        joinedload(ServiceProvider.user),
        joinedload(ServiceProvider.category),
        joinedload(ServiceProvider.organization),
        joinedload(ServiceProvider.onboarding),
    )
    if is_verified is not None:
        query = query.filter(ServiceProvider.is_verified == is_verified)
    if search:
        query = query.join(ServiceProvider.user).filter(
            User.full_name.ilike(f"%{search}%") | ServiceProvider.specialization.ilike(f"%{search}%")
        )
    total = query.count()
    providers = (
        query.order_by(ServiceProvider.created_at.desc())
        .offset((page - 1) * limit)
        .limit(limit)
        .all()
    )
    return {"total": total, "page": page, "total_pages": -(-total // limit), "providers": providers}


def verify_provider(db: Session, provider_id: str, is_verified: bool) -> ServiceProvider:
    provider = db.query(ServiceProvider).filter(ServiceProvider.id == provider_id).first()
    if not provider:
        raise not_found("Provider")
    provider.is_verified = is_verified
    db.commit()
    db.refresh(provider)
    return provider


def get_all_appointments(
    db: Session,
    status: Optional[str] = None,
    from_date: Optional[date] = None,
    to_date: Optional[date] = None,
    page: int = 1,
    limit: int = 20,
) -> dict:
    query = db.query(Appointment).options(
        joinedload(Appointment.customer),
        joinedload(Appointment.provider).joinedload(ServiceProvider.user),
        joinedload(Appointment.category),
    )
    if status:
        query = query.filter(Appointment.status == status)
    if from_date:
        query = query.filter(Appointment.appointment_date >= from_date)
    if to_date:
        query = query.filter(Appointment.appointment_date <= to_date)

    total = query.count()
    appointments = (
        query.order_by(Appointment.appointment_date.desc())
        .offset((page - 1) * limit)
        .limit(limit)
        .all()
    )
    return {"total": total, "page": page, "total_pages": -(-total // limit), "appointments": appointments}


def get_admin_dashboard(db: Session) -> dict:
    today = date.today()
    total_users = db.query(func.count(User.id)).filter(User.role == "customer").scalar()
    total_providers = db.query(func.count(ServiceProvider.id)).scalar()
    verified_providers = db.query(func.count(ServiceProvider.id)).filter(
        ServiceProvider.is_verified == True
    ).scalar()
    total_appointments = db.query(func.count(Appointment.id)).scalar()
    today_appointments = db.query(func.count(Appointment.id)).filter(
        Appointment.appointment_date == today
    ).scalar()
    pending = db.query(func.count(Appointment.id)).filter(Appointment.status == "pending").scalar()
    confirmed = db.query(func.count(Appointment.id)).filter(Appointment.status == "confirmed").scalar()
    completed = db.query(func.count(Appointment.id)).filter(Appointment.status == "completed").scalar()
    cancelled = db.query(func.count(Appointment.id)).filter(Appointment.status == "cancelled").scalar()

    # Appointment trends for the last 7 days
    seven_days_ago = today - timedelta(days=6)
    appointment_trends = (
        db.query(
            func.date(Appointment.appointment_date).label("date"),
            func.count(Appointment.id).label("count"),
        )
        .filter(Appointment.appointment_date >= seven_days_ago)
        .group_by(func.date(Appointment.appointment_date))
        .order_by(func.date(Appointment.appointment_date))
        .all()
    )
    appointment_trends_list = [
        {"date": str(row.date), "count": row.count} for row in appointment_trends
    ]

    # User registration trends for the last 7 days
    user_trends = (
        db.query(
            func.date(User.created_at).label("date"),
            func.count(User.id).label("count"),
        )
        .filter(User.role == "customer")
        .filter(User.created_at >= seven_days_ago)
        .group_by(func.date(User.created_at))
        .order_by(func.date(User.created_at))
        .all()
    )
    user_trends_list = [
        {"date": str(row.date), "count": row.count} for row in user_trends
    ]

    # Provider registration trends for the last 7 days
    provider_trends = (
        db.query(
            func.date(ServiceProvider.created_at).label("date"),
            func.count(ServiceProvider.id).label("count"),
        )
        .filter(ServiceProvider.created_at >= seven_days_ago)
        .group_by(func.date(ServiceProvider.created_at))
        .order_by(func.date(ServiceProvider.created_at))
        .all()
    )
    provider_trends_list = [
        {"date": str(row.date), "count": row.count} for row in provider_trends
    ]

    # Appointments by category
    appointments_by_category = (
        db.query(
            Category.name.label("category"),
            func.count(Appointment.id).label("count"),
        )
        .join(Category, Appointment.category_id == Category.id)
        .group_by(Category.name)
        .order_by(func.count(Appointment.id).desc())
        .all()
    )
    appointments_by_category_list = [
        {"category": row.category, "count": row.count} for row in appointments_by_category
    ]

    # Providers by category
    providers_by_category = (
        db.query(
            Category.name.label("category"),
            func.count(ServiceProvider.id).label("count"),
        )
        .join(Category, ServiceProvider.category_id == Category.id)
        .group_by(Category.name)
        .order_by(func.count(ServiceProvider.id).desc())
        .all()
    )
    providers_by_category_list = [
        {"category": row.category, "count": row.count} for row in providers_by_category
    ]

    return {
        "total_customers": total_users,
        "total_providers": total_providers,
        "verified_providers": verified_providers,
        "total_appointments": total_appointments,
        "today_appointments": today_appointments,
        "appointment_stats": {
            "pending": pending,
            "confirmed": confirmed,
            "completed": completed,
            "cancelled": cancelled,
        },
        "appointment_trends": appointment_trends_list,
        "user_trends": user_trends_list,
        "provider_trends": provider_trends_list,
        "appointments_by_category": appointments_by_category_list,
        "providers_by_category": providers_by_category_list,
    }

def get_org_requests(db: Session, status: Optional[str] = "pending") -> list:
    query = db.query(OrganizationRequest).options(joinedload(OrganizationRequest.organization))
    if status:
        query = query.filter(OrganizationRequest.status == status)
    return query.all()

def approve_org_request(db: Session, request_id: str, admin_user_id: str) -> dict:
    req = db.query(OrganizationRequest).filter(OrganizationRequest.id == request_id).first()
    if not req:
        raise not_found("OrganizationRequest")
    if req.status != "pending":
        raise bad_request(f"Request is already {req.status}")

    req.status = "approved"
    req.approved_by = admin_user_id
    
    org = db.query(Organization).filter(Organization.id == req.organization_id).first()
    if org:
        org.is_approved = True
        org.approval_status = "approved"
        
        # Simulated mock email logic
        print(f"=========================================")
        print(f"MOCK EMAIL: Organization {org.name} Approved")
        print(f"To: {org.contact_email}")
        print(f"Body: Your organization account has been approved. You can now access all features.")
        print(f"=========================================")
        
    db.commit()
    db.refresh(req)
    return {"message": "Organization request approved successfully", "request_id": req.id}
