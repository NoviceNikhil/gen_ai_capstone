from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import JSONResponse
from fastapi.encoders import jsonable_encoder
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, and_
from typing import Optional
from pydantic import BaseModel as _BaseModel
from typing import Optional as _Optional
import json
from datetime import date, datetime

from config.database import get_db
from middleware.auth import get_current_user, require_role
from models import Organization, OrganizationRequest, OrganizationJoinRequest, ServiceProvider, User
from models.appointment import Appointment
from models.payment_records import PaymentRecord
from schemas.organization import (
    OrganizationCreate, OrganizationUpdate, OrganizationResponse,
    OrganizationDetailResponse, OrganizationListResponse,
    OrganizationRequestCreate, OrganizationRequestResponse,
    OrganizationRequestApprovalSchema,
    OrganizationJoinRequestResponse, OrganizationJoinRequestApprovalSchema
)
from utils.response import success_response

router = APIRouter(prefix="/api/organizations", tags=["Organizations"])


# ──────────────────────────────────────────────────────────────────────────────
# ORGANIZATION CREATION (via approval request)
# ──────────────────────────────────────────────────────────────────────────────

@router.post("/request-creation", response_model=OrganizationRequestResponse)
def request_organization_creation(
    data: OrganizationCreate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """
    Any user can request to create an organization.
    Admin approval is required before org is actually created.
    """
    # Create organization entry with pending approval
    org = Organization(
        name=data.name,
        description=data.description,
        location=data.location,
        logo_url=data.logo_url,
        contact_email=data.contact_email,
        contact_phone=data.contact_phone,
        metadata_json=data.metadata_json,
        admin_user_id=current_user["id"],
        approval_status="pending",
    )
    db.add(org)
    db.flush()

    # Create approval request
    org_request = OrganizationRequest(
        organization_id=org.id,
        request_type="create",
        requested_by=current_user["id"],
        requested_changes=json.dumps(jsonable_encoder(data)),
    )
    db.add(org_request)
    db.commit()
    db.refresh(org_request)

    return jsonable_encoder(org_request)


# ──────────────────────────────────────────────────────────────────────────────
# ADMIN APPROVAL WORKFLOW
# ──────────────────────────────────────────────────────────────────────────────

@router.get("/pending-requests", response_model=list[OrganizationRequestResponse])
def get_pending_requests(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
    page: int = Query(1, ge=1),
    limit: int = Query(10, le=50),
):
    """Get all pending organization requests (Admin only)"""
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")

    offset = (page - 1) * limit
    requests = db.query(OrganizationRequest).filter(
        OrganizationRequest.status == "pending"
    ).offset(offset).limit(limit).all()

    return [jsonable_encoder(r) for r in requests]


@router.get("/approval-requests/all", response_model=dict)
def get_all_approval_requests(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
    request_type: str = Query(None, description="Filter by: 'organization', 'provider', or None for both"),
    page: int = Query(1, ge=1),
    limit: int = Query(10, le=50),
):
    """
    Get all pending approval requests (organizations + providers).
    Admin only unified approval dashboard.
    """
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    
    offset = (page - 1) * limit
    all_requests = []
    total = 0
    
    # Get organization requests if requested
    if request_type in [None, "organization"]:
        from models import OrganizationRequest
        org_requests = db.query(OrganizationRequest).filter(
            OrganizationRequest.status == "pending"
        ).all()
        
        for req in org_requests:
            all_requests.append({
                "id": req.id,
                "type": "organization",
                "status": req.status,
                "name": req.organization.name if req.organization else "Unknown",
                "email": req.organization.contact_email if req.organization else "",
                "description": req.organization.description,
                "requested_by": req.requester.full_name if req.requester else "Unknown",
                "requested_at": str(req.created_at),
                "request_details": json.loads(req.requested_changes) if req.requested_changes else {},
            })
    
    # Get provider approval requests if requested
    if request_type in [None, "provider"]:
        from models import ProviderApprovalRequest, ServiceProvider
        provider_reqs = db.query(ProviderApprovalRequest).options(
            joinedload(ProviderApprovalRequest.provider).joinedload(ServiceProvider.user)
        ).filter(
            ProviderApprovalRequest.status == "pending"
        ).all()
        
        for req in provider_reqs:
            prov = req.provider
            user = prov.user if prov else None
            all_requests.append({
                "id": req.id,
                "type": "provider",
                "status": req.status,
                "name": user.full_name if user else "Unknown",
                "email": user.email if user else "",
                "description": f"{prov.specialization} at {prov.organization_name or 'Independent'}",
                "requested_by": user.full_name if user else "Unknown",
                "requested_at": str(req.created_at),
                "request_details": {
                    "specialization": prov.specialization,
                    "organization": prov.organization_name,
                    "city": prov.city.value if prov.city else None,
                    "state": prov.state.value if prov.state else None,
                },
            })
    
    # Sort by requested_at descending
    all_requests.sort(key=lambda x: x["requested_at"], reverse=True)
    
    total = len(all_requests)
    paginated_requests = all_requests[offset:offset + limit]
    
    return success_response({
        "total": total,
        "page": page,
        "limit": limit,
        "total_pages": max(1, (total + limit - 1) // limit),
        "requests": paginated_requests
    }, "All approval requests fetched")


@router.post("/requests/{request_id}/approve", response_model=OrganizationRequestResponse)
def approve_organization_request(
    request_id: str,
    approval_data: OrganizationRequestApprovalSchema,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Approve an organization creation/update request (Admin only)"""
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")

    org_request = db.query(OrganizationRequest).filter(
        OrganizationRequest.id == request_id
    ).first()

    if not org_request:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Request not found")

    org_request.status = approval_data.status
    org_request.approved_by = current_user["id"]
    org_request.approval_notes = approval_data.approval_notes

    # If approved, update organization status
    org = org_request.organization
    if approval_data.status == "approved":
        org.is_approved = True
        org.approval_status = "approved"
    elif approval_data.status == "rejected":
        org.approval_status = "rejected"

    db.commit()
    db.refresh(org_request)
    return jsonable_encoder(org_request)


@router.post("/approval-requests/{request_id}/{request_type}/decide", response_model=dict)
def decide_approval_request(
    request_id: str,
    request_type: str,
    body: dict,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """
    Unified endpoint to approve/reject both organization and provider requests.
    
    request_type: "organization" or "provider"
    body: {
        "status": "approved" or "rejected",
        "notes": "approval notes"
    }
    """
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    
    status_val = body.get("status")
    notes = body.get("notes", "")
    
    if status_val not in ["approved", "rejected"]:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Status must be 'approved' or 'rejected'")
    
    if request_type == "organization":
        from models import OrganizationRequest, Notification
        
        org_request = db.query(OrganizationRequest).filter(
            OrganizationRequest.id == request_id
        ).first()
        
        if not org_request:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization request not found")
        
        org_request.status = status_val
        org_request.approved_by = current_user["id"]
        org_request.approval_notes = notes
        
        org = org_request.organization
        if status_val == "approved":
            org.is_approved = True
            org.approval_status = "approved"
        else:
            org.approval_status = "rejected"
        
        db.commit()
        db.refresh(org_request)
        
        # Notify requester
        notification = Notification(
            user_id=org_request.requested_by,
            title=f"Organization {'Approved' if status_val == 'approved' else 'Rejected'}",
            message=f"Your organization request has been {status_val}. {notes}",
            type=f"organization_{status_val}",
            reference_id=org.id,
        )
        db.add(notification)
        db.commit()
        
        return success_response({
            "id": org_request.id,
            "type": "organization",
            "status": org_request.status,
        }, f"Organization {status_val} successfully")
    
    elif request_type == "provider":
        from models import ProviderApprovalRequest, ServiceProvider, Notification
        
        provider_req = db.query(ProviderApprovalRequest).filter(
            ProviderApprovalRequest.id == request_id
        ).first()
        
        if not provider_req:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Provider request not found")
        
        provider_req.status = status_val
        provider_req.approved_by = current_user["id"]
        provider_req.approval_notes = notes
        provider_req.approved_at = datetime.utcnow()
        
        provider = provider_req.provider
        provider.approval_status = status_val
        
        db.commit()
        db.refresh(provider_req)
        db.refresh(provider)
        
        # Invalidate provider caches so marketplace updates immediately
        from utils.cache import invalidate
        invalidate(f"cache:provider:profile:{provider.user_id}")
        invalidate(f"cache:customer:provider:{provider.id}")
        invalidate("cache:customer:providers")
        
        # Notify provider
        notification = Notification(
            user_id=provider.user_id,
            title=f"Profile {'Approved' if status_val == 'approved' else 'Rejected'}",
            message=f"Your profile has been {status_val}. {'You are now visible to customers in the marketplace!' if status_val == 'approved' else notes}",
            type=f"provider_{status_val}",
            reference_id=provider.id,
        )
        db.add(notification)
        db.commit()
        
        return success_response({
            "id": provider_req.id,
            "type": "provider",
            "status": provider_req.status,
        }, f"Provider {status_val} successfully")
    
    else:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid request_type")


# ──────────────────────────────────────────────────────────────────────────────
# ORGANIZATION CRUD (only approved orgs or via request system)
# ──────────────────────────────────────────────────────────────────────────────

@router.get("", response_model=list[OrganizationListResponse])
def list_organizations(
    db: Session = Depends(get_db),
    category_id: Optional[int] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, le=100),
    approved_only: bool = Query(True),
):
    """List organizations, optionally filtered by category"""
    offset = (page - 1) * limit
    query = db.query(Organization)

    if approved_only:
        query = query.filter(Organization.is_approved == True)

    # Filter by category if provided - organizations have providers, which have categories
    if category_id:
        from models import ServiceProvider
        # Get organization IDs that have providers in this category
        org_ids = db.query(ServiceProvider.organization_id.distinct()).filter(
            ServiceProvider.category_id == category_id,
            ServiceProvider.organization_id != None
        ).all()
        org_ids = [org[0] for org in org_ids]
        if org_ids:
            query = query.filter(Organization.id.in_(org_ids))
        else:
            # No organizations found for this category
            return []

    orgs = query.offset(offset).limit(limit).all()
    return [jsonable_encoder(o) for o in orgs]


# ──────────────────────────────────────────────────────────────────────────────
# ORGANISATION DASHBOARD (must be registered before /{org_id} routes)
# ──────────────────────────────────────────────────────────────────────────────

def _get_org_for_user(db: Session, current_user: dict) -> Organization:
    """Return the Organisation for the logged-in org admin."""
    user_id = current_user.get("id")
    email = (current_user.get("email") or "").lower().strip()

    org = db.query(Organization).filter(Organization.admin_user_id == user_id).first()
    if not org and email:
        org = db.query(Organization).filter(
            func.lower(Organization.contact_email) == email
        ).first()
        if org and not org.admin_user_id:
            org.admin_user_id = user_id
            db.commit()
            db.refresh(org)

    if not org:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Organisation not found for this account",
        )
    return org


class OrgOnboardingPayload(_BaseModel):
    org_type: _Optional[str] = None
    address: _Optional[str] = None
    state: _Optional[str] = None
    city: _Optional[str] = None
    pincode: _Optional[str] = None
    num_employees: _Optional[int] = None
    tax_number: _Optional[str] = None
    bank_details: _Optional[str] = None
    identity_doc_url: _Optional[str] = None
    contact_phone: _Optional[str] = None
    contact_email: _Optional[str] = None
    description: _Optional[str] = None
    location: _Optional[str] = None


@router.get("/org-dashboard/onboarding")
def get_org_onboarding(
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_role("organization")),
):
    """Return the current onboarding state of the logged-in organisation."""
    org = _get_org_for_user(db, current_user)
    return success_response(
        {
            "onboarding_completed": org.onboarding_completed,
            "org": {
                "id": org.id,
                "name": org.name,
                "org_type": org.org_type,
                "description": org.description,
                "location": org.location,
                "address": org.address,
                "state": org.state,
                "city": org.city,
                "pincode": org.pincode,
                "num_employees": org.num_employees,
                "tax_number": org.tax_number,
                "bank_details": org.bank_details,
                "identity_doc_url": org.identity_doc_url,
                "contact_email": org.contact_email,
                "contact_phone": org.contact_phone,
                "is_approved": org.is_approved,
                "approval_status": org.approval_status,
            },
        },
        "Onboarding data fetched",
    )


@router.patch("/org-dashboard/onboarding")
def update_org_onboarding(
    body: OrgOnboardingPayload,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_role("organization")),
):
    """Submit / update organisation onboarding details and mark as complete."""
    org = _get_org_for_user(db, current_user)

    updatable = [
        "org_type", "address", "state", "city", "pincode", "num_employees",
        "tax_number", "bank_details", "identity_doc_url",
        "contact_phone", "contact_email", "description", "location",
    ]
    for field in updatable:
        val = getattr(body, field)
        if val is not None:
            setattr(org, field, val)

    org.onboarding_completed = True
    db.commit()
    db.refresh(org)

    return success_response(
        {"onboarding_completed": org.onboarding_completed},
        "Onboarding completed successfully",
    )


@router.get("/org-dashboard/employees")
def get_org_employees(
    search: _Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, le=100),
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_role("organization")),
):
    """List providers (employees) belonging to this organisation."""
    org = _get_org_for_user(db, current_user)

    query = (
        db.query(ServiceProvider)
        .options(joinedload(ServiceProvider.user), joinedload(ServiceProvider.category))
        .filter(ServiceProvider.organization_id == org.id)
    )

    if search:
        s = f"%{search.lower()}%"
        query = query.join(ServiceProvider.user).filter(
            (func.lower(User.full_name).like(s)) | (func.lower(User.email).like(s))
        )

    total = query.count()
    offset = (page - 1) * limit
    providers = query.offset(offset).limit(limit).all()

    employees = []
    for p in providers:
        employees.append(
            {
                "id": p.id,
                "name": p.user.full_name if p.user else "Unknown",
                "email": p.user.email if p.user else "",
                "role": p.specialization or "Provider",
                "category": p.category.name if p.category else None,
                "date_joined": str(p.created_at.date()) if p.created_at else None,
                "is_verified": p.is_verified,
            }
        )

    return success_response(
        {"employees": employees, "total": total, "page": page, "limit": limit},
        "Employees fetched",
    )


@router.get("/org-dashboard/join-requests")
def get_org_join_requests_dashboard(
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_role("organization")),
):
    """List pending join requests directed at this organisation (org-user perspective)."""
    org = _get_org_for_user(db, current_user)

    requests = (
        db.query(OrganizationJoinRequest)
        .options(
            joinedload(OrganizationJoinRequest.provider).joinedload(ServiceProvider.user)
        )
        .filter(
            OrganizationJoinRequest.organization_id == org.id,
            OrganizationJoinRequest.status == "pending",
        )
        .all()
    )

    results = []
    for req in requests:
        prov = req.provider
        user = prov.user if prov else None
        results.append(
            {
                "id": req.id,
                "requester_name": user.full_name if user else "Unknown",
                "email": user.email if user else "",
                "requested_role": prov.specialization if prov else "Provider",
                "date_requested": str(req.created_at.date()) if req.created_at else None,
                "provider_id": prov.id if prov else None,
            }
        )

    return success_response({"requests": results, "total": len(results)}, "Join requests fetched")


@router.post("/org-dashboard/join-requests/{request_id}/respond")
def respond_org_join_request(
    request_id: str,
    body: OrganizationJoinRequestApprovalSchema,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_role("organization")),
):
    """Accept or reject a pending join request (organisation admin)."""
    org = _get_org_for_user(db, current_user)

    join_req = (
        db.query(OrganizationJoinRequest)
        .filter(
            OrganizationJoinRequest.id == request_id,
            OrganizationJoinRequest.organization_id == org.id,
        )
        .first()
    )

    if not join_req:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Join request not found")

    if join_req.status != "pending":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Request already processed")

    join_req.status = body.status
    join_req.approved_by = current_user.get("id")
    join_req.approval_notes = body.approval_notes

    if body.status == "approved":
        join_req.provider.organization_id = org.id

    db.commit()

    return success_response({"status": body.status}, "Join request updated")


@router.get("/org-dashboard/appointments")
def get_org_appointments(
    status_filter: _Optional[str] = Query(None, alias="status"),
    from_date: _Optional[date] = Query(None),
    to_date: _Optional[date] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, le=50),
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_role("organization")),
):
    """List all appointments under providers belonging to this organisation."""
    org = _get_org_for_user(db, current_user)

    provider_ids = [
        pid for (pid,) in db.query(ServiceProvider.id)
        .filter(ServiceProvider.organization_id == org.id)
        .all()
    ]

    if not provider_ids:
        return success_response(
            {"appointments": [], "total": 0, "page": page, "total_pages": 1},
            "No providers in this organisation",
        )

    query = (
        db.query(Appointment)
        .options(
            joinedload(Appointment.customer),
            joinedload(Appointment.provider).joinedload(ServiceProvider.user),
        )
        .filter(Appointment.provider_id.in_(provider_ids))
    )

    if status_filter and status_filter in ("pending", "confirmed", "completed", "cancelled"):
        query = query.filter(Appointment.status == status_filter)

    if from_date:
        query = query.filter(Appointment.appointment_date >= from_date)

    if to_date:
        query = query.filter(Appointment.appointment_date <= to_date)

    total = query.count()
    offset = (page - 1) * limit
    appointments = query.order_by(Appointment.appointment_date.desc()).offset(offset).limit(limit).all()

    appt_list = []
    for a in appointments:
        appt_list.append(
            {
                "id": a.id,
                "customer_name": a.customer.full_name if a.customer else "Unknown",
                "provider_name": a.provider.user.full_name if (a.provider and a.provider.user) else "Unknown",
                "date": str(a.appointment_date),
                "time_slot": a.time_slot,
                "status": a.status,
                "is_paid": a.is_paid,
                "amount": float(a.consultation_fee_snapshot or 0),
            }
        )

    total_pages = max(1, (total + limit - 1) // limit)
    return success_response(
        {"appointments": appt_list, "total": total, "page": page, "total_pages": total_pages},
        "Appointments fetched",
    )


@router.get("/org-dashboard/revenue")
def get_org_revenue(
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_role("organization")),
):
    """Aggregate revenue data for the organisation."""
    org = _get_org_for_user(db, current_user)

    provider_ids = [
        pid for (pid,) in db.query(ServiceProvider.id)
        .filter(ServiceProvider.organization_id == org.id)
        .all()
    ]

    if not provider_ids:
        return success_response(
            {
                "total_revenue": 0,
                "this_month_revenue": 0,
                "total_appointments": 0,
                "monthly_breakdown": [],
                "per_provider": [],
                "per_service_type": [],
            },
            "No providers in this organisation",
        )

    paid_appts = (
        db.query(Appointment)
        .options(joinedload(Appointment.provider).joinedload(ServiceProvider.user))
        .filter(
            Appointment.provider_id.in_(provider_ids),
            Appointment.is_paid == True,
            Appointment.status.in_(["confirmed", "completed"]),
        )
        .all()
    )

    today = datetime.utcnow()
    this_month_key = f"{today.year}-{today.month:02d}"

    total_revenue = 0.0
    this_month_revenue = 0.0
    monthly: dict = {}
    per_provider: dict = {}
    per_service: dict = {}

    for a in paid_appts:
        amount = float(a.consultation_fee_snapshot or 0)
        total_revenue += amount

        appt_date = a.appointment_date
        month_key = f"{appt_date.year}-{appt_date.month:02d}" if appt_date else "unknown"
        monthly[month_key] = monthly.get(month_key, 0) + amount

        if month_key == this_month_key:
            this_month_revenue += amount

        pname = a.provider.user.full_name if (a.provider and a.provider.user) else "Unknown"
        per_provider[pname] = per_provider.get(pname, 0) + amount

        sels = getattr(a, "service_selections", [])
        if sels:
            for sel in sels:
                t = getattr(sel, "service_title", None) or "Standard Session"
                per_service[t] = per_service.get(t, 0) + amount
        else:
            per_service["Standard Session"] = per_service.get("Standard Session", 0) + amount

    monthly_breakdown = sorted(
        [{"month": k, "revenue": round(v, 2)} for k, v in monthly.items()],
        key=lambda x: x["month"],
    )

    per_provider_list = sorted(
        [{"provider": k, "revenue": round(v, 2)} for k, v in per_provider.items()],
        key=lambda x: x["revenue"],
        reverse=True,
    )

    per_service_list = sorted(
        [{"service_type": k, "revenue": round(v, 2)} for k, v in per_service.items()],
        key=lambda x: x["revenue"],
        reverse=True,
    )

    total_appointments = (
        db.query(func.count(Appointment.id))
        .filter(Appointment.provider_id.in_(provider_ids))
        .scalar()
    ) or 0

    return success_response(
        {
            "total_revenue": round(total_revenue, 2),
            "this_month_revenue": round(this_month_revenue, 2),
            "total_appointments": total_appointments,
            "monthly_breakdown": monthly_breakdown,
            "per_provider": per_provider_list,
            "per_service_type": per_service_list,
        },
        "Revenue data fetched",
    )


# ──────────────────────────────────────────────────────────────────────────────
# ORGANIZATION CRUD BY ID
# ──────────────────────────────────────────────────────────────────────────────

@router.get("/{org_id}", response_model=OrganizationDetailResponse)
def get_organization(
    org_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Get organization details with provider count"""
    org = db.query(Organization).filter(Organization.id == org_id).first()

    if not org:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found")

    # Check access permissions
    if not org.is_approved and current_user.get("role") != "admin":
        if current_user.get("id") != org.admin_user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Cannot view unapproved organization"
            )

    result = jsonable_encoder(org)
    provider_count = db.query(ServiceProvider).filter(
        ServiceProvider.organization_id == org_id
    ).count()
    result["provider_count"] = provider_count

    return result


@router.post("/{org_id}/request-update", response_model=OrganizationRequestResponse)
def request_organization_update(
    org_id: str,
    data: OrganizationUpdate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Request organization update (goes through approval)"""
    org = db.query(Organization).filter(Organization.id == org_id).first()

    if not org:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found")

    # Verify access
    if current_user.get("role") != "admin" and current_user.get("id") != org.admin_user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins or org admin can request updates"
        )

    # Create update request
    org_request = OrganizationRequest(
        organization_id=org_id,
        request_type="update",
        requested_by=current_user["id"],
        requested_changes=json.dumps(jsonable_encoder(data)),
    )
    db.add(org_request)
    db.commit()
    db.refresh(org_request)

    return jsonable_encoder(org_request)


@router.post("/{org_id}/apply-update", response_model=OrganizationDetailResponse)
def apply_organization_update(
    org_id: str,
    request_id: str = Query(...),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Apply an approved update to an organization (Admin only)"""
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")

    org = db.query(Organization).filter(Organization.id == org_id).first()
    org_request = db.query(OrganizationRequest).filter(
        OrganizationRequest.id == request_id,
        OrganizationRequest.organization_id == org_id
    ).first()

    if not org or not org_request:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization or request not found")

    if org_request.status != "approved":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only approved requests can be applied"
        )

    # Parse and apply changes
    changes = json.loads(org_request.requested_changes)
    for key, value in changes.items():
        if hasattr(org, key):
            setattr(org, key, value)

    db.commit()
    db.refresh(org)

    result = jsonable_encoder(org)
    provider_count = db.query(ServiceProvider).filter(
        ServiceProvider.organization_id == org_id
    ).count()
    result["provider_count"] = provider_count

    return result


# ──────────────────────────────────────────────────────────────────────────────
# ORGANIZATION MANAGEMENT (soft delete via is_active)
# ──────────────────────────────────────────────────────────────────────────────

@router.delete("/{org_id}", status_code=status.HTTP_204_NO_CONTENT)
def deactivate_organization(
    org_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Deactivate an organization (soft delete via is_active=False)"""
    org = db.query(Organization).filter(Organization.id == org_id).first()

    if not org:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found")

    if current_user.get("role") != "admin" and current_user.get("id") != org.admin_user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins or org admin can deactivate"
        )

    org.is_active = False
    db.commit()
    return None


# ──────────────────────────────────────────────────────────────────────────────
# PROVIDER ASSIGNMENT TO ORGANIZATION
# ──────────────────────────────────────────────────────────────────────────────

@router.post("/{org_id}/assign-provider/{provider_id}")
def assign_provider_to_org(
    org_id: str,
    provider_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Assign a provider to an organization"""
    org = db.query(Organization).filter(Organization.id == org_id).first()
    provider = db.query(ServiceProvider).filter(ServiceProvider.id == provider_id).first()

    if not org or not provider:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization or provider not found")

    # Access control: admin or org admin
    if current_user.get("role") != "admin" and current_user.get("id") != org.admin_user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins or org admin can assign providers"
        )

    provider.organization_id = org_id
    db.commit()
    db.refresh(provider)

    return success_response(
        {"message": "Provider assigned to organization"},
        status_code=status.HTTP_200_OK
    )


@router.delete("/{org_id}/remove-provider/{provider_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_provider_from_org(
    org_id: str,
    provider_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Remove a provider from an organization"""
    provider = db.query(ServiceProvider).filter(
        ServiceProvider.id == provider_id,
        ServiceProvider.organization_id == org_id
    ).first()

    if not provider:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Provider not found in this organization"
        )

    org = db.query(Organization).filter(Organization.id == org_id).first()
    if current_user.get("role") != "admin" and current_user.get("id") != org.admin_user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins or org admin can remove providers"
        )

    provider.organization_id = None
    db.commit()
    return None


@router.get("/{org_id}/providers")
def get_organization_providers(
    org_id: str,
    db: Session = Depends(get_db),
    page: int = Query(1, ge=1),
    limit: int = Query(10, le=50),
):
    """Get all providers in an organization"""
    offset = (page - 1) * limit
    providers = db.query(ServiceProvider).filter(
        ServiceProvider.organization_id == org_id
    ).offset(offset).limit(limit).all()

    return jsonable_encoder(providers)


# ──────────────────────────────────────────────────────────────────────────────
# ORGANIZATION JOIN REQUESTS (Provider -> Org Admin)
# ──────────────────────────────────────────────────────────────────────────────

@router.post("/{org_id}/request-join", response_model=OrganizationJoinRequestResponse)
def request_join_organization(
    org_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """A provider requests to join an existing organization"""
    if current_user.get("role") != "provider":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only providers can join organizations")
    
    org = db.query(Organization).filter(Organization.id == org_id, Organization.is_approved == True).first()
    if not org:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Approved organization not found")
        
    provider = db.query(ServiceProvider).filter(ServiceProvider.user_id == current_user["id"]).first()
    if not provider:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Provider profile not found")
        
    if provider.organization_id == org_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Already a member of this organization")
        
    # Check if pending request exists
    existing_req = db.query(OrganizationJoinRequest).filter(
        OrganizationJoinRequest.organization_id == org_id,
        OrganizationJoinRequest.provider_id == provider.id,
        OrganizationJoinRequest.status == "pending"
    ).first()
    
    if existing_req:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="A pending join request already exists")
        
    join_request = OrganizationJoinRequest(
        organization_id=org_id,
        provider_id=provider.id,
        status="pending"
    )
    db.add(join_request)
    db.commit()
    db.refresh(join_request)
    
    return jsonable_encoder(join_request)


@router.get("/{org_id}/join-requests", response_model=list[OrganizationJoinRequestResponse])
def get_join_requests(
    org_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Org Admin views pending join requests"""
    org = db.query(Organization).filter(Organization.id == org_id).first()
    if not org:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found")
        
    if current_user.get("role") != "admin" and current_user.get("id") != org.admin_user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to view these requests")
        
    requests = db.query(OrganizationJoinRequest).filter(
        OrganizationJoinRequest.organization_id == org_id,
        OrganizationJoinRequest.status == "pending"
    ).all()
    
    # Let's also join provider and user to return more data if needed, but schema only expects basic info.
    # To enrich the response for UI, we'll manually fetch provider details.
    results = []
    for req in requests:
        req_dict = jsonable_encoder(req)
        # Add basic provider info
        prov = req.provider
        if prov and prov.user:
            req_dict["provider_name"] = prov.user.full_name
            req_dict["provider_specialization"] = prov.specialization
        results.append(req_dict)
        
    return results


@router.post("/join-requests/{request_id}/approve", response_model=OrganizationJoinRequestResponse)
def approve_join_request(
    request_id: str,
    approval_data: OrganizationJoinRequestApprovalSchema,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Org Admin approves or rejects a join request"""
    join_request = db.query(OrganizationJoinRequest).filter(OrganizationJoinRequest.id == request_id).first()
    if not join_request:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Join request not found")
        
    org = join_request.organization
    
    if current_user.get("role") != "admin" and current_user.get("id") != org.admin_user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to approve this request")
        
    if join_request.status != "pending":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Request is already processed")
        
    join_request.status = approval_data.status
    join_request.approved_by = current_user["id"]
    join_request.approval_notes = approval_data.approval_notes
    
    if approval_data.status == "approved":
        provider = join_request.provider
        provider.organization_id = org.id
        
    db.commit()
    db.refresh(join_request)
    
    return jsonable_encoder(join_request)
