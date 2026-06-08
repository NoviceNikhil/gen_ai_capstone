from fastapi import APIRouter, Depends, Query
from fastapi.responses import JSONResponse
from fastapi.encoders import jsonable_encoder
from sqlalchemy.orm import Session
from typing import Optional
from datetime import date

from config.database import get_db
from middleware.auth import get_current_user, require_role
from services import admin_service
from services.cache_service import get, set, invalidate
from schemas.admin import AdminUserStatusUpdate, AdminProviderVerify
from utils.response import success_response, success_envelope

router = APIRouter(prefix="/api/admin", tags=["Admin"])


# ──────────────────────────────────────────────────────────────────────────────
# DASHBOARD
# ──────────────────────────────────────────────────────────────────────────────

@router.get("/dashboard")
def dashboard(
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_role("admin")),
):
    cache_key = "cache:admin:dashboard"
    cached = get(cache_key)
    if cached:
        return JSONResponse(status_code=200, content=cached)
    data = admin_service.get_admin_dashboard(db)
    payload = success_envelope(jsonable_encoder(data), "Admin dashboard fetched")
    set(cache_key, payload, ttl=60)
    return JSONResponse(status_code=200, content=payload)


# ──────────────────────────────────────────────────────────────────────────────
# USERS
# ──────────────────────────────────────────────────────────────────────────────

@router.get("/users")
def get_users(
    role: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, le=100),
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_role("admin")),
):
    cache_key = f"cache:admin:users:role={role}:search={search}:page={page}:limit={limit}"
    cached = get(cache_key)
    if cached:
        return JSONResponse(status_code=200, content=cached)
    data = admin_service.get_all_users(db, role, search, page, limit)
    payload = success_envelope(jsonable_encoder(data), "Users fetched")
    set(cache_key, payload, ttl=90)
    return JSONResponse(status_code=200, content=payload)


@router.patch("/users/{user_id}/status")
def update_user_status(
    user_id: str,
    body: AdminUserStatusUpdate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_role("admin")),
):
    user = admin_service.update_user_status(db, user_id, body.is_active)
    return success_response({
        "user": {
            "id": user.id,
            "email": user.email,
            "role": user.role,
            "is_active": user.is_active
        }
    }, "User status updated")


# ──────────────────────────────────────────────────────────────────────────────
# PROVIDERS
# ──────────────────────────────────────────────────────────────────────────────

@router.get("/providers")
def get_providers(
    is_verified: Optional[bool] = Query(None),
    search: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, le=100),
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_role("admin")),
):
    cache_key = f"cache:admin:providers:verified={is_verified}:search={search}:page={page}:limit={limit}"
    cached = get(cache_key)
    if cached:
        return JSONResponse(status_code=200, content=cached)
    data = admin_service.get_all_providers(db, is_verified, search, page, limit)
    payload = success_envelope(jsonable_encoder(data), "Providers fetched")
    set(cache_key, payload, ttl=90)
    return JSONResponse(status_code=200, content=payload)


@router.patch("/providers/{provider_id}/verify")
def verify_provider(
    provider_id: str,
    body: AdminProviderVerify,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_role("admin")),
):
    provider = admin_service.verify_provider(db, provider_id, body.is_verified)
    action = "verified" if body.is_verified else "unverified"
    return success_response({"provider": provider}, f"Provider {action}")


@router.get("/providers/independent/approved")
def get_independent_approved_providers(
    search: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, le=100),
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_role("admin")),
):
    """Get providers who are approved but not part of any organization"""
    cache_key = f"cache:admin:providers:independent:search={search}:page={page}:limit={limit}"
    cached = get(cache_key)
    if cached:
        return JSONResponse(status_code=200, content=cached)
    
    from models import ServiceProvider, User
    from sqlalchemy import and_
    
    offset = (page - 1) * limit
    
    query = db.query(ServiceProvider).filter(
        ServiceProvider.approval_status == "approved",
        ServiceProvider.organization_id == None  # Not part of any organization
    )
    
    if search:
        query = query.join(ServiceProvider.user).filter(
            User.full_name.ilike(f"%{search}%")
        )
    
    total = query.count()
    providers = (
        query.order_by(ServiceProvider.avg_rating.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )
    
    data = {
        "total": total,
        "page": page,
        "limit": limit,
        "total_pages": max(1, (total + limit - 1) // limit),
        "providers": jsonable_encoder(providers)
    }
    
    payload = success_envelope(data, "Independent approved providers fetched")
    set(cache_key, payload, ttl=120)
    return JSONResponse(status_code=200, content=payload)


@router.get("/providers/debug/{provider_id}")
def debug_provider_visibility(
    provider_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_role("admin")),
):
    """Debug endpoint: Check why a provider is not showing in marketplace"""
    from models import ServiceProvider
    
    provider = db.query(ServiceProvider).filter(
        ServiceProvider.id == provider_id
    ).first()
    
    if not provider:
        return success_response({"error": "Provider not found"}, "Provider not found")
    
    user = provider.user
    
    # Check all conditions
    is_verified_ok = provider.is_verified == True
    is_accepting_ok = provider.is_accepting_appointments == True
    is_approved_ok = provider.approval_status == "approved"
    
    visible = is_verified_ok and is_accepting_ok and is_approved_ok
    
    # Collect missing conditions
    missing = []
    if not is_verified_ok:
        missing.append("is_verified")
    if not is_accepting_ok:
        missing.append("is_accepting_appointments")
    if not is_approved_ok:
        missing.append("approval_status")
    
    # Collect next steps
    next_steps = []
    if not is_verified_ok:
        next_steps.append("Go to Admin → Providers page")
        next_steps.append("Find this provider and click 'Approve' button")
    if not is_accepting_ok:
        next_steps.append("Provider must enable appointment acceptance in their dashboard")
    if not is_approved_ok:
        next_steps.append("Provider must submit onboarding for admin approval")
    
    return success_response({
        "provider_id": provider.id,
        "provider_name": user.full_name if user else "Unknown",
        "provider_email": user.email if user else "Unknown",
        "visibility_status": "✅ VISIBLE IN MARKETPLACE" if visible else "❌ NOT VISIBLE IN MARKETPLACE",
        "conditions": {
            "is_verified": {
                "value": provider.is_verified,
                "required": True,
                "status": "✅ OK" if is_verified_ok else "❌ MISSING - Admin must verify"
            },
            "is_accepting_appointments": {
                "value": provider.is_accepting_appointments,
                "required": True,
                "status": "✅ OK" if is_accepting_ok else "❌ MISSING - Provider must enable"
            },
            "approval_status": {
                "value": provider.approval_status,
                "required": "approved",
                "status": "✅ OK" if is_approved_ok else f"❌ MISSING - Currently: {provider.approval_status}"
            }
        },
        "missing_conditions": missing,
        "next_steps": next_steps
    }, "Provider visibility debug info")




# ──────────────────────────────────────────────────────────────────────────────
# APPOINTMENTS
# ──────────────────────────────────────────────────────────────────────────────

@router.get("/appointments")
def get_appointments(
    status: Optional[str] = Query(None),
    from_date: Optional[date] = Query(None),
    to_date: Optional[date] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, le=100),
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_role("admin")),
):
    cache_key = f"cache:admin:appointments:status={status}:from={from_date}:to={to_date}:page={page}:limit={limit}"
    cached = get(cache_key)
    if cached:
        return JSONResponse(status_code=200, content=cached)
    data = admin_service.get_all_appointments(db, status, from_date, to_date, page, limit)
    payload = success_envelope(jsonable_encoder(data), "Appointments fetched")
    set(cache_key, payload, ttl=45)
    return JSONResponse(status_code=200, content=payload)

# ──────────────────────────────────────────────────────────────────────────────
# ORGANIZATION REQUESTS
# ──────────────────────────────────────────────────────────────────────────────

@router.get("/org-requests")
def get_org_requests(
    status: Optional[str] = Query("pending"),
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_role("admin")),
):
    data = admin_service.get_org_requests(db, status)
    return success_response(data, "Organization requests fetched")

@router.post("/org-requests/{request_id}/approve")
def approve_org_request(
    request_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_role("admin")),
):
    data = admin_service.approve_org_request(db, request_id, current_user["id"])
    return success_response(data, "Organization request approved")
