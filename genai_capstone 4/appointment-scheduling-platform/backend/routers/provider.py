from fastapi import APIRouter, Depends, Query, Request, HTTPException, status
from fastapi.responses import JSONResponse
from fastapi.encoders import jsonable_encoder
from sqlalchemy.orm import Session, joinedload
from typing import Optional
from datetime import date, datetime, timedelta
from pydantic import BaseModel
from urllib.parse import urlencode, quote_plus, urlparse
import httpx

from config.database import get_db
from config.settings import settings
from middleware.auth import get_current_user
from services import provider_service, appointment_service, provider_product_service, availability_service
from services.cache_service import get, set, invalidate
from schemas.provider import ProviderProfileUpdate, ProviderOnboardingUpdate
from schemas.appointment import AppointmentStatusUpdate, CancelRequest, RescheduleRequest, RescheduleRespondRequest
from utils.response import success_response, success_envelope
from utils.exceptions import not_found, bad_request
from utils.security import create_access_token, decode_token
from models import Organization, OrganizationJoinRequest

router = APIRouter(prefix="/api/provider", tags=["Provider"])
GOOGLE_CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar"


class OfferingPayload(BaseModel):
    id: Optional[str] = None
    title: str
    description: Optional[str] = None
    duration_minutes: int = 30
    price: float = 0
    is_active: bool = True


class IntakeFormPayload(BaseModel):
    title: Optional[str] = "Pre-Appointment Form"
    fields: list


class PackagePayload(BaseModel):
    id: Optional[str] = None
    title: str
    session_count: int
    discount_percent: float = 0
    package_price: float = 0
    is_active: bool = True


# ──────────────────────────────────────────────────────────────────────────────
# PROFILE
# ──────────────────────────────────────────────────────────────────────────────

@router.get("/profile")
def get_profile(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    cache_key = f"cache:provider:profile:{current_user['id']}"
    cached = get(cache_key)
    if cached:
        return JSONResponse(status_code=200, content=cached)
    profile = provider_service.get_provider_profile(db, current_user["id"])
    payload = success_envelope(jsonable_encoder({"provider": profile}), "Profile fetched")
    set(cache_key, payload, ttl=120)
    return JSONResponse(status_code=200, content=payload)


@router.patch("/profile")
def update_profile(
    body: ProviderProfileUpdate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    profile = provider_service.update_provider_profile(db, current_user["id"], body.model_dump(exclude_none=True))
    invalidate(f"cache:provider:profile:{current_user['id']}")
    return success_response({"provider": profile}, "Profile updated")


@router.get("/onboarding")
def get_onboarding(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    data = provider_service.get_provider_onboarding(db, current_user["id"])
    return success_response({"onboarding": data}, "Onboarding fetched")


@router.patch("/onboarding")
def update_onboarding(
    body: ProviderOnboardingUpdate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    data = provider_service.upsert_provider_onboarding(
        db,
        current_user["id"],
        body.model_dump(exclude_none=True),
    )
    invalidate(f"cache:provider:profile:{current_user['id']}")
    return success_response({"onboarding": data}, "Onboarding saved")


@router.post("/onboarding/submit-for-approval")
def submit_onboarding_for_approval(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """
    Submit provider profile for admin approval.
    Once approved, provider becomes visible to customers.
    """
    from models import ServiceProvider, ProviderOnboarding
    from services import provider_approval_service
    
    # Get provider
    provider = db.query(ServiceProvider).filter(ServiceProvider.user_id == current_user["id"]).first()
    if not provider:
        raise not_found("Provider profile")
    
    # Get onboarding
    onboarding = db.query(ProviderOnboarding).filter(
        ProviderOnboarding.provider_id == provider.id
    ).first()
    
    if not onboarding:
        return success_response({}, "No onboarding data found to submit")
    
    # Mark as submitted for approval
    onboarding.submitted_for_approval = True
    db.commit()
    
    # Create approval request
    approval_request = provider_approval_service.create_approval_request(db, provider.id)
    
    invalidate(f"cache:provider:profile:{current_user['id']}")
    return success_response(
        {
            "approval_status": provider.approval_status,
            "approval_request_id": approval_request.id,
            "message": "Your profile has been submitted for admin approval. You'll be notified once it's reviewed."
        },
        "Profile submitted for approval"
    )


@router.get("/approval-status")
def get_approval_status(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """
    Get current provider's approval status with detailed request info.
    Shows: status (pending/approved/rejected), approval request details, feedback.
    """
    from models import ServiceProvider, ProviderApprovalRequest
    
    provider = db.query(ServiceProvider).filter(ServiceProvider.user_id == current_user["id"]).first()
    if not provider:
        raise not_found("Provider profile")
    
    approval_request = db.query(ProviderApprovalRequest).filter(
        ProviderApprovalRequest.provider_id == provider.id
    ).order_by(ProviderApprovalRequest.created_at.desc()).first()
    
    response_data = {
        "provider_id": provider.id,
        "approval_status": provider.approval_status,
        "profile_complete": True,
        "approval_request": None
    }
    
    if approval_request:
        response_data["approval_request"] = {
            "id": approval_request.id,
            "status": approval_request.status,
            "created_at": str(approval_request.created_at),
            "approved_at": str(approval_request.approved_at) if approval_request.approved_at else None,
            "approval_notes": approval_request.approval_notes,
            "can_resubmit": approval_request.status == "rejected"
        }
    
    return success_response(response_data, "Approval status fetched")


@router.get("/organization")
def get_provider_organization(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Get the organization details for the current provider"""
    from models import ServiceProvider
    provider = db.query(ServiceProvider).filter(
        ServiceProvider.user_id == current_user["id"]
    ).first()
    
    if not provider or not provider.organization_id:
        return success_response({"organization": None}, "Provider not in an organization")
    
    return success_response(
        {"organization": jsonable_encoder(provider.organization)},
        "Organization details fetched"
    )


@router.post("/organization/leave")
def leave_organization(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """
    Provider leaves their current organization.
    After leaving, they can join another organization.
    """
    from models import ServiceProvider, Notification
    
    provider = db.query(ServiceProvider).filter(
        ServiceProvider.user_id == current_user["id"]
    ).first()
    
    if not provider:
        raise not_found("Provider profile")
    
    if not provider.organization_id:
        return success_response(
            {"message": "Provider is not in any organization"},
            "Not in organization"
        )
    
    org_id = provider.organization_id
    # Get organization name BEFORE detaching from session
    org = db.query(Organization).filter(Organization.id == org_id).first()
    org_name = org.name if org else "Organization"
    
    # Remove provider from organization
    provider.organization_id = None
    db.commit()
    db.refresh(provider)
    
    # Notify organization admin
    if org and org.admin_user_id:
        notification = Notification(
            user_id=org.admin_user_id,
            title="Provider Left Organization",
            message=f"Provider {provider.user.full_name} has left {org_name}",
            type="provider_left_organization",
            reference_id=provider.id,
        )
        db.add(notification)
        db.commit()
    
    # Notify provider
    notification = Notification(
        user_id=current_user["id"],
        title="Left Organization",
        message=f"You have successfully left {org_name}. You can now join another organization.",
        type="left_organization",
        reference_id=org_id,
    )
    db.add(notification)
    db.commit()
    
    invalidate(f"cache:provider:profile:{current_user['id']}")
    
    return success_response({
        "message": f"You have left {org_name}",
        "organization_id": org_id
    }, "Successfully left organization")


@router.post("/organization/{org_id}/request-join")
def request_join_organization(
    org_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """
    Provider requests to join an organization.
    Can be called after leaving a previous organization.
    """
    from models import ServiceProvider, Notification
    
    if current_user.get("role") != "provider":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only providers can join organizations")
    
    # Get or create provider profile
    provider = db.query(ServiceProvider).filter(ServiceProvider.user_id == current_user["id"]).first()
    if not provider:
        raise not_found("Provider profile")
    
    # Check if organization exists and is approved
    org = db.query(Organization).filter(Organization.id == org_id, Organization.is_approved == True).first()
    if not org:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Approved organization not found")
    
    # Check if provider is already in an organization
    if provider.organization_id is not None:
        current_org = db.query(Organization).filter(Organization.id == provider.organization_id).first()
        current_org_name = current_org.name if current_org else "current organization"
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, 
            detail=f"You are already a member of {current_org_name}. Leave first to join another."
        )
    
    # Check if pending request exists
    existing_req = db.query(OrganizationJoinRequest).filter(
        OrganizationJoinRequest.organization_id == org_id,
        OrganizationJoinRequest.provider_id == provider.id,
        OrganizationJoinRequest.status == "pending"
    ).first()
    
    if existing_req:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, 
            detail="A pending join request already exists for this organization"
        )
    
    # Create join request
    join_request = OrganizationJoinRequest(
        organization_id=org_id,
        provider_id=provider.id,
        status="pending"
    )
    db.add(join_request)
    db.flush()
    
    # Notify organization admin
    if org.admin_user_id:
        notification = Notification(
            user_id=org.admin_user_id,
            title="New Join Request",
            message=f"Provider {provider.user.full_name} ({provider.specialization}) has requested to join {org.name}",
            type="organization_join_request",
            reference_id=provider.id,
        )
        db.add(notification)
    
    db.commit()
    db.refresh(join_request)
    
    invalidate(f"cache:provider:profile:{current_user['id']}")
    
    return success_response({
        "id": join_request.id,
        "organization_id": org_id,
        "status": join_request.status,
        "message": f"Join request sent to {org.name}. Waiting for approval."
    }, "Join request created successfully")


@router.get("/organization/pending-requests")
def get_provider_pending_join_requests(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """
    Get all pending join requests for the current provider.
    Shows which organizations have not yet responded.
    """
    from models import ServiceProvider
    
    provider = db.query(ServiceProvider).filter(ServiceProvider.user_id == current_user["id"]).first()
    if not provider:
        raise not_found("Provider profile")
    
    requests = db.query(OrganizationJoinRequest).options(
        joinedload(OrganizationJoinRequest.organization)
    ).filter(
        OrganizationJoinRequest.provider_id == provider.id,
        OrganizationJoinRequest.status == "pending"
    ).all()
    
    results = []
    for req in requests:
        org = req.organization
        results.append({
            "id": req.id,
            "organization_id": org.id if org else None,
            "organization_name": org.name if org else "Unknown",
            "organization_type": org.org_type if org else None,
            "organization_location": org.location if org else None,
            "requested_at": str(req.created_at),
            "status": req.status
        })
    
    return success_response({
        "requests": results,
        "total": len(results)
    }, "Pending join requests fetched")


@router.get("/organization")
def get_provider_organization(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Get the organization details for the current provider"""
    from models import ServiceProvider
    provider = db.query(ServiceProvider).filter(
        ServiceProvider.user_id == current_user["id"]
    ).first()
    
    if not provider or not provider.organization_id:
        return success_response({"organization": None}, "Provider not in an organization")
    
    return success_response(
        {"organization": jsonable_encoder(provider.organization)},
        "Organization fetched"
    )


# ──────────────────────────────────────────────────────────────────────────────
# APPOINTMENTS
# ──────────────────────────────────────────────────────────────────────────────

@router.get("/appointments")
def get_appointments(
    status: Optional[str] = Query(None),
    from_date: Optional[date] = Query(None),
    to_date: Optional[date] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(10, le=50),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    cache_key = f"cache:provider:appointments:{current_user['id']}:status={status}:from={from_date}:to={to_date}:page={page}:limit={limit}"
    cached = get(cache_key)
    if cached:
        return JSONResponse(status_code=200, content=cached)
    data = provider_service.get_provider_appointments(
        db, current_user["id"], status, from_date, to_date, page, limit
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
    cache_key = f"cache:provider:appointment:{current_user['id']}:{appointment_id}"
    cached = get(cache_key)
    if cached:
        return JSONResponse(status_code=200, content=cached)
    appt = appointment_service.get_appointment_by_id(
        db, appointment_id, current_user["id"], "provider"
    )
    from services.provider_service import _get_payment_details
    appt_dict = jsonable_encoder(appt)
    appt_dict["payment_details"] = _get_payment_details(appt, db)
    payload = success_envelope({"appointment": appt_dict}, "Appointment detail fetched")
    set(cache_key, payload, ttl=45)
    return JSONResponse(status_code=200, content=payload)


@router.patch("/appointments/{appointment_id}/status")
def update_appointment_status(
    appointment_id: str,
    body: AppointmentStatusUpdate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    appt = appointment_service.update_appointment_status(
        db, appointment_id, current_user["id"], body.action, body.notes
    )
    invalidate(f"cache:provider:appointment:{current_user['id']}:{appointment_id}")
    invalidate(f"cache:provider:dashboard:{current_user['id']}")
    invalidate(f"cache:customer:dashboard:{appt.customer_id}")
    return success_response({"appointment": appt}, f"Appointment {body.action}ed")


@router.patch("/appointments/{appointment_id}/reschedule")
def request_reschedule(
    appointment_id: str,
    body: RescheduleRequest,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    req = appointment_service.create_reschedule_request(
        db, appointment_id, current_user["id"], "provider", body.appointment_date, body.time_slot
    )
    invalidate(f"cache:provider:appointment:{current_user['id']}:{appointment_id}")
    invalidate(f"cache:provider:dashboard:{current_user['id']}")
    customer_user_id = req.appointment.customer_id if req.appointment else None
    if customer_user_id:
        invalidate(f"cache:customer:appointment:{customer_user_id}:{appointment_id}")
        invalidate(f"cache:customer:dashboard:{customer_user_id}")
    return success_response({"reschedule_request_id": req.id}, "Reschedule requested")


@router.patch("/reschedule-requests/{request_id}/respond")
def respond_reschedule(
    request_id: str,
    body: RescheduleRespondRequest,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    req = appointment_service.respond_to_reschedule_request(
        db, request_id, current_user["id"], "provider", body.action
    )
    invalidate(f"cache:provider:appointment:{current_user['id']}:{req.appointment_id}")
    invalidate(f"cache:provider:dashboard:{current_user['id']}")
    customer_user_id = req.appointment.customer_id if req.appointment else None
    if customer_user_id:
        invalidate(f"cache:customer:appointment:{customer_user_id}:{req.appointment_id}")
        invalidate(f"cache:customer:dashboard:{customer_user_id}")
    return success_response({"status": req.status}, f"Reschedule request {req.status}")


# ──────────────────────────────────────────────────────────────────────────────
# SLOT INVENTORY (FOR PROVIDER SCHEDULE CALENDAR)
# ──────────────────────────────────────────────────────────────────────────────
@router.get("/slots")
def get_provider_slots(
    date: str = Query(..., description="YYYY-MM-DD"),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    data = availability_service.get_provider_slots_schedule(
        db, current_user["id"], date
    )
    payload = success_envelope(
        jsonable_encoder({"date": date, "slots": data}),
        "Provider slots fetched",
    )
    return JSONResponse(status_code=200, content=payload)


# ──────────────────────────────────────────────────────────────────────────────
# REVIEWS
# ──────────────────────────────────────────────────────────────────────────────
@router.get("/reviews")
def get_provider_reviews(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    from models import ServiceProvider, ProviderReview, Appointment, User

    provider = db.query(ServiceProvider).filter(ServiceProvider.user_id == current_user["id"]).first()
    if not provider:
        raise not_found("Provider profile")

    reviews = (
        db.query(ProviderReview)
        .filter(ProviderReview.provider_id == provider.id)
        .order_by(ProviderReview.created_at.desc())
        .all()
    )

    if not reviews:
        payload = success_envelope(jsonable_encoder({"reviews": []}), "Provider reviews fetched")
        return JSONResponse(status_code=200, content=payload)

    appointment_ids = [r.appointment_id for r in reviews]
    customer_ids = [r.customer_id for r in reviews]

    appts = (
        db.query(Appointment)
        .filter(Appointment.id.in_(appointment_ids))
        .all()
    )
    appt_by_id = {a.id: a for a in appts}

    customers = (
        db.query(User)
        .filter(User.id.in_(customer_ids))
        .all()
    )
    customer_by_id = {u.id: u for u in customers}

    out = []
    for r in reviews:
        appt = appt_by_id.get(r.appointment_id)
        cust = customer_by_id.get(r.customer_id)
        out.append(
            {
                "id": r.id,
                "rating": r.rating,
                "comment": r.comment,
                "created_at": str(r.created_at),
                "customer": (
                    {"id": cust.id, "full_name": cust.full_name}
                    if cust
                    else None
                ),
                "appointment": (
                    {
                        "id": appt.id,
                        "appointment_date": str(appt.appointment_date),
                        "time_slot": appt.time_slot,
                    }
                    if appt
                    else None
                ),
            }
        )

    payload = success_envelope(jsonable_encoder({"reviews": out}), "Provider reviews fetched")
    return JSONResponse(status_code=200, content=payload)


def _get_google_calendar_connection(db: Session, provider_id: str):
    from models import ProviderCalendarConnection

    return (
        db.query(ProviderCalendarConnection)
        .filter(
            ProviderCalendarConnection.provider_id == provider_id,
            ProviderCalendarConnection.provider == "google",
        )
        .first()
    )


async def _ensure_google_access_token(db: Session, conn):
    if not conn:
        return None
    if conn.access_token and conn.token_expiry and conn.token_expiry > datetime.utcnow() + timedelta(minutes=1):
        return conn.access_token
    if not conn.refresh_token:
        return None

    token_url = "https://oauth2.googleapis.com/token"
    payload = {
        "client_id": settings.GOOGLE_CLIENT_ID,
        "client_secret": settings.GOOGLE_CLIENT_SECRET,
        "refresh_token": conn.refresh_token,
        "grant_type": "refresh_token",
    }
    async with httpx.AsyncClient(timeout=20) as client:
        res = await client.post(token_url, data=payload)
    if res.status_code != 200:
        conn.sync_status = "token_refresh_failed"
        db.commit()
        return None

    token_data = res.json()
    conn.access_token = token_data.get("access_token")
    expires_in = int(token_data.get("expires_in", 3600))
    conn.token_expiry = datetime.utcnow() + timedelta(seconds=expires_in)
    conn.sync_status = "healthy"
    db.commit()
    return conn.access_token


async def _refresh_google_access_token_force(db: Session, conn):
    """Force-refresh access token even if current token has not expired yet."""
    if not conn or not conn.refresh_token:
        return None

    token_url = "https://oauth2.googleapis.com/token"
    payload = {
        "client_id": settings.GOOGLE_CLIENT_ID,
        "client_secret": settings.GOOGLE_CLIENT_SECRET,
        "refresh_token": conn.refresh_token,
        "grant_type": "refresh_token",
    }
    async with httpx.AsyncClient(timeout=20) as client:
        res = await client.post(token_url, data=payload)
    if res.status_code != 200:
        conn.sync_status = "token_refresh_failed"
        db.commit()
        return None

    token_data = res.json()
    conn.access_token = token_data.get("access_token")
    expires_in = int(token_data.get("expires_in", 3600))
    conn.token_expiry = datetime.utcnow() + timedelta(seconds=expires_in)
    conn.sync_status = "healthy"
    db.commit()
    return conn.access_token


def _resolve_frontend_origin(request: Request) -> str:
    fallback = settings.FRONTEND_URL.rstrip("/")
    configured_host = (urlparse(fallback).hostname or "").lower()
    origin = (request.headers.get("origin") or "").strip().rstrip("/")
    if not origin:
        return fallback

    parsed = urlparse(origin)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        return fallback

    host = (parsed.hostname or "").lower()
    if host in {"localhost", "127.0.0.1", configured_host}:
        return origin
    return fallback


# ──────────────────────────────────────────────────────────────────────────────
# GOOGLE CALENDAR SYNC
# ──────────────────────────────────────────────────────────────────────────────
@router.get("/calendar/google/connect")
def connect_google_calendar(
    request: Request,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    from models import ServiceProvider

    if not settings.GOOGLE_CLIENT_ID or not settings.GOOGLE_CLIENT_SECRET:
        return success_response(
            {"configured": False},
            "Google OAuth is not configured on backend",
            400,
        )

    provider = db.query(ServiceProvider).filter(ServiceProvider.user_id == current_user["id"]).first()
    if not provider:
        raise not_found("Provider profile")

    frontend_origin = _resolve_frontend_origin(request)
    state_token = create_access_token(
        {
            "type": "google_calendar_connect",
            "provider_id": provider.id,
            "user_id": current_user["id"],
            "frontend_origin": frontend_origin,
        },
        expires_delta=timedelta(minutes=15),
    )
    params = {
        "client_id": settings.GOOGLE_CLIENT_ID,
        "redirect_uri": settings.GOOGLE_CALLBACK_URL,
        "response_type": "code",
        "scope": GOOGLE_CALENDAR_SCOPE,
        "access_type": "offline",
        "prompt": "consent",
        "include_granted_scopes": "true",
        "state": state_token,
    }
    auth_url = "https://accounts.google.com/o/oauth2/v2/auth?" + urlencode(params)
    return success_response({"url": auth_url}, "Google connect URL generated")


@router.get("/calendar/google/callback")
async def google_calendar_callback(
    code: Optional[str] = Query(None),
    state: Optional[str] = Query(None),
    error: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    from models import ProviderCalendarConnection

    payload = decode_token(state) if state else None
    frontend_base = (payload or {}).get("frontend_origin") or settings.FRONTEND_URL
    frontend_target = f"{frontend_base.rstrip('/')}/provider/calendar-sync"
    if error:
        return JSONResponse(
            status_code=302,
            content={},
            headers={"Location": f"{frontend_target}?googleCalendar=error&reason={quote_plus(error)}"},
        )

    if not code or not state:
        return JSONResponse(
            status_code=302,
            content={},
            headers={"Location": f"{frontend_target}?googleCalendar=error&reason=missing_code_or_state"},
        )

    if not payload or payload.get("type") != "google_calendar_connect":
        return JSONResponse(
            status_code=302,
            content={},
            headers={"Location": f"{frontend_target}?googleCalendar=error&reason=invalid_state"},
        )

    provider_id = payload.get("provider_id")
    if not provider_id:
        return JSONResponse(
            status_code=302,
            content={},
            headers={"Location": f"{frontend_target}?googleCalendar=error&reason=invalid_provider"},
        )

    token_url = "https://oauth2.googleapis.com/token"
    token_payload = {
        "code": code,
        "client_id": settings.GOOGLE_CLIENT_ID,
        "client_secret": settings.GOOGLE_CLIENT_SECRET,
        "redirect_uri": settings.GOOGLE_CALLBACK_URL,
        "grant_type": "authorization_code",
    }
    async with httpx.AsyncClient(timeout=20) as client:
        token_res = await client.post(token_url, data=token_payload)
    if token_res.status_code != 200:
        token_reason = "token_exchange_failed"
        try:
            token_err = token_res.json()
            token_reason = (
                token_err.get("error_description")
                or token_err.get("error")
                or token_reason
            )
        except Exception:
            pass
        print(f"[GOOGLE_TOKEN_EXCHANGE_FAILED] status={token_res.status_code} body={token_res.text}")
        return JSONResponse(
            status_code=302,
            content={},
            headers={"Location": f"{frontend_target}?googleCalendar=error&reason={quote_plus(token_reason)}"},
        )
    token_data = token_res.json()

    access_token = token_data.get("access_token")
    refresh_token = token_data.get("refresh_token")
    expires_in = int(token_data.get("expires_in", 3600))
    scope = token_data.get("scope", GOOGLE_CALENDAR_SCOPE)
    if not access_token:
        return JSONResponse(
            status_code=302,
            content={},
            headers={"Location": f"{frontend_target}?googleCalendar=error&reason=no_access_token"},
        )

    # Fetch primary email from Google userinfo endpoint.
    email = None
    async with httpx.AsyncClient(timeout=20) as client:
        userinfo_res = await client.get(
            "https://www.googleapis.com/oauth2/v2/userinfo",
            headers={"Authorization": f"Bearer {access_token}"},
        )
    if userinfo_res.status_code == 200:
        email = userinfo_res.json().get("email")

    conn = _get_google_calendar_connection(db, provider_id)
    if not conn:
        conn = ProviderCalendarConnection(provider_id=provider_id, provider="google")
        db.add(conn)

    conn.email = email
    conn.access_token = access_token
    if refresh_token:
        conn.refresh_token = refresh_token
    conn.token_expiry = datetime.utcnow() + timedelta(seconds=expires_in)
    conn.scope = scope
    conn.is_connected = True
    conn.sync_status = "healthy"
    db.commit()

    return JSONResponse(
        status_code=302,
        content={},
        headers={"Location": f"{frontend_target}?googleCalendar=connected"},
    )


@router.get("/calendar/google/status")
async def google_calendar_status(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    from models import ServiceProvider

    provider = db.query(ServiceProvider).filter(ServiceProvider.user_id == current_user["id"]).first()
    if not provider:
        raise not_found("Provider profile")

    conn = _get_google_calendar_connection(db, provider.id)
    if not conn or not conn.is_connected:
        return success_response(
            {"connected": False, "provider": "google"},
            "Google calendar status fetched",
        )

    return success_response(
        {
            "connected": bool(conn.is_connected),
            "provider": "google",
            "email": conn.email,
            "sync_status": conn.sync_status,
            "last_sync_at": str(conn.last_sync_at) if conn.last_sync_at else None,
        },
        "Google calendar status fetched",
    )


@router.post("/calendar/google/sync")
async def sync_google_calendar(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    from models import ServiceProvider, Appointment

    provider = db.query(ServiceProvider).filter(ServiceProvider.user_id == current_user["id"]).first()
    if not provider:
        raise not_found("Provider profile")

    conn = _get_google_calendar_connection(db, provider.id)
    token = await _ensure_google_access_token(db, conn)
    if not token:
        return success_response(
            {"connected": False, "events": []},
            "Google calendar is not connected or token refresh failed",
            400,
        )

    # Push provider's confirmed appointments to Google Calendar
    confirmed_appts = db.query(Appointment).options(
        joinedload(Appointment.customer)
    ).filter(
        Appointment.provider_id == provider.id,
        Appointment.status == "confirmed",
    ).all()
    
    pushed_count = 0
    failed_count = 0
    
    for appt in confirmed_appts:
        try:
            # Construct event data for Google Calendar
            appt_datetime = datetime.combine(appt.appointment_date, datetime.strptime(appt.time_slot, "%H:%M").time())
            event_end = appt_datetime + timedelta(hours=1)  # Default 1 hour duration
            
            event = {
                "summary": f"Appointment - {appt.customer.full_name if appt.customer else 'Customer'}",
                "description": appt.notes or f"Appointment ID: {appt.id}",
                "start": {
                    "dateTime": appt_datetime.isoformat(),
                    "timeZone": "UTC",
                },
                "end": {
                    "dateTime": event_end.isoformat(),
                    "timeZone": "UTC",
                },
            }
            
            # Insert event into Google Calendar
            async with httpx.AsyncClient(timeout=20) as client:
                res = await client.post(
                    "https://www.googleapis.com/calendar/v3/calendars/primary/events",
                    json=event,
                    headers={"Authorization": f"Bearer {token}"},
                )
            
            if res.status_code in (200, 201):
                pushed_count += 1
            elif res.status_code in (401, 403) and conn and conn.refresh_token:
                refreshed = await _refresh_google_access_token_force(db, conn)
                if refreshed:
                    async with httpx.AsyncClient(timeout=20) as client:
                        res = await client.post(
                            "https://www.googleapis.com/calendar/v3/calendars/primary/events",
                            json=event,
                            headers={"Authorization": f"Bearer {refreshed}"},
                        )
                    if res.status_code in (200, 201):
                        pushed_count += 1
                        token = refreshed
                    else:
                        failed_count += 1
                else:
                    failed_count += 1
            else:
                failed_count += 1
                print(f"[GOOGLE_CAL_PUSH_FAILED] appt_id={appt.id} status={res.status_code} body={res.text}")
        except Exception as e:
            failed_count += 1
            print(f"[GOOGLE_CAL_PUSH_ERROR] appt_id={appt.id} error={str(e)}")

    # Fetch Google Calendar events (existing behavior)
    now_iso = datetime.utcnow().isoformat() + "Z"
    params = {
        "maxResults": 20,
        "singleEvents": "true",
        "orderBy": "startTime",
        "timeMin": now_iso,
    }
    async with httpx.AsyncClient(timeout=20) as client:
        res = await client.get(
            "https://www.googleapis.com/calendar/v3/calendars/primary/events",
            params=params,
            headers={"Authorization": f"Bearer {token}"},
        )
    if res.status_code in (401, 403) and conn and conn.refresh_token:
        # Token can become invalid before local expiry; refresh once and retry.
        refreshed = await _refresh_google_access_token_force(db, conn)
        if refreshed:
            async with httpx.AsyncClient(timeout=20) as client:
                res = await client.get(
                    "https://www.googleapis.com/calendar/v3/calendars/primary/events",
                    params=params,
                    headers={"Authorization": f"Bearer {refreshed}"},
                )
    if res.status_code != 200:
        if conn:
            conn.sync_status = "sync_failed"
            db.commit()
        sync_reason = "google_sync_failed"
        try:
            sync_err = res.json()
            err_obj = sync_err.get("error", {}) if isinstance(sync_err, dict) else {}
            sync_reason = (
                err_obj.get("message")
                or sync_err.get("error_description")
                or sync_err.get("error")
                or sync_reason
            )
        except Exception:
            pass
        print(f"[GOOGLE_CAL_SYNC_FAILED] status={res.status_code} body={res.text}")
        return success_response(
            {"connected": True, "events": [], "reason": sync_reason},
            f"Failed to fetch Google calendar events: {sync_reason}",
            400,
        )

    items = res.json().get("items", [])
    events = []
    for item in items:
        start = (item.get("start") or {}).get("dateTime") or (item.get("start") or {}).get("date")
        end = (item.get("end") or {}).get("dateTime") or (item.get("end") or {}).get("date")
        events.append(
            {
                "id": item.get("id"),
                "summary": item.get("summary") or "(No title)",
                "start": start,
                "end": end,
                "status": item.get("status"),
                "html_link": item.get("htmlLink"),
            }
        )

    if conn:
        conn.last_sync_at = datetime.utcnow()
        conn.sync_status = "healthy"
        db.commit()

    return success_response(
        {
            "connected": True,
            "events": events,
            "appointments_pushed": pushed_count,
            "appointments_failed": failed_count,
        },
        f"Google calendar synced ({pushed_count} appointments added, {failed_count} failed)",
    )


@router.delete("/calendar/google/disconnect")
def disconnect_google_calendar(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    from models import ServiceProvider

    provider = db.query(ServiceProvider).filter(ServiceProvider.user_id == current_user["id"]).first()
    if not provider:
        raise not_found("Provider profile")

    conn = _get_google_calendar_connection(db, provider.id)
    if not conn:
        return success_response({"connected": False}, "Google calendar already disconnected")

    conn.is_connected = False
    conn.access_token = None
    conn.refresh_token = None
    conn.token_expiry = None
    conn.sync_status = "disconnected"
    conn.last_sync_at = None
    db.commit()

    return success_response({"connected": False}, "Google calendar disconnected")


# ──────────────────────────────────────────────────────────────────────────────
# DASHBOARD
# ──────────────────────────────────────────────────────────────────────────────

@router.get("/dashboard")
def dashboard(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    cache_key = f"cache:provider:dashboard:{current_user['id']}"
    cached = get(cache_key)
    if cached:
        return JSONResponse(status_code=200, content=cached)
    data = provider_service.get_provider_dashboard(db, current_user["id"])
    payload = success_envelope(jsonable_encoder(data), "Dashboard stats fetched")
    set(cache_key, payload, ttl=60)
    return JSONResponse(status_code=200, content=payload)


@router.get("/offerings")
def get_offerings(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    cache_key = f"cache:provider:offerings:{current_user['id']}"
    cached = get(cache_key)
    if cached:
        return JSONResponse(status_code=200, content=cached)
    offerings = provider_product_service.list_offerings(db, current_user["id"])
    payload = success_envelope(jsonable_encoder({"offerings": offerings}), "Service offerings fetched")
    set(cache_key, payload, ttl=120)
    return JSONResponse(status_code=200, content=payload)


@router.post("/offerings")
def save_offering(
    body: OfferingPayload,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    offering = provider_product_service.upsert_offering(db, current_user["id"], body.model_dump())
    invalidate(f"cache:provider:offerings:{current_user['id']}")
    return success_response({"offering": offering}, "Service offering saved")


@router.get("/intake-form")
def get_intake_form(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    cache_key = f"cache:provider:intake-form:{current_user['id']}"
    cached = get(cache_key)
    if cached:
        return JSONResponse(status_code=200, content=cached)
    intake_form = provider_product_service.get_intake_form(db, current_user["id"])
    payload = success_envelope(jsonable_encoder({"intake_form": intake_form}), "Provider intake form fetched")
    set(cache_key, payload, ttl=120)
    return JSONResponse(status_code=200, content=payload)


@router.post("/intake-form")
def save_intake_form(
    body: IntakeFormPayload,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    intake_form = provider_product_service.upsert_intake_form(
        db, current_user["id"], body.title, body.fields
    )
    invalidate(f"cache:provider:intake-form:{current_user['id']}")
    return success_response({"intake_form": intake_form}, "Provider intake form saved")


# Loyalty packages removed - not currently practical to enforce
