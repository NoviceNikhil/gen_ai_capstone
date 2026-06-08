"""
Service for managing provider approval workflow.
Handles creation of approval requests when providers complete onboarding,
and admin approval/rejection of providers.
"""

from datetime import datetime
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func

from models.service_provider import ServiceProvider
from models.provider_approval import ProviderApprovalRequest
from models.user import User
from models.notification import Notification
from utils.exceptions import not_found, bad_request, forbidden


def create_approval_request(db: Session, provider_id: str) -> ProviderApprovalRequest:
    """
    Create an approval request when a provider completes onboarding.
    This is called after provider submits their profile for approval.
    """
    provider = db.query(ServiceProvider).filter(ServiceProvider.id == provider_id).first()
    if not provider:
        raise not_found("Provider")
    
    # Check if already has a pending approval request
    existing = db.query(ProviderApprovalRequest).filter(
        ProviderApprovalRequest.provider_id == provider_id,
        ProviderApprovalRequest.status == "pending"
    ).first()
    
    if existing:
        raise bad_request("This provider already has a pending approval request")
    
    # Create approval request
    approval_request = ProviderApprovalRequest(
        provider_id=provider_id,
        status="pending"
    )
    db.add(approval_request)
    db.flush()
    
    # Create notification for admins
    admins = db.query(User).filter(User.role == "admin").all()
    for admin in admins:
        notification = Notification(
            user_id=admin.id,
            title="New Provider Approval Request",
            message=f"Provider {provider.user.full_name} ({provider.user.email}) has submitted their profile for approval.",
            type="provider_approval",
            reference_id=provider_id,
        )
        db.add(notification)
    
    db.commit()
    db.refresh(approval_request)
    return approval_request


def get_pending_approval_requests(
    db: Session,
    page: int = 1,
    limit: int = 10
) -> dict:
    """Get all pending provider approval requests"""
    offset = (page - 1) * limit
    
    query = db.query(ProviderApprovalRequest).filter(
        ProviderApprovalRequest.status == "pending"
    ).options(
        joinedload(ProviderApprovalRequest.provider).joinedload(ServiceProvider.user)
    )
    
    total = query.count()
    requests = query.order_by(ProviderApprovalRequest.created_at.desc()).offset(offset).limit(limit).all()
    
    results = []
    for req in requests:
        prov = req.provider
        user = prov.user if prov else None
        results.append({
            "id": req.id,
            "provider_id": prov.id if prov else None,
            "provider_name": user.full_name if user else "Unknown",
            "provider_email": user.email if user else "",
            "specialization": prov.specialization if prov else "",
            "organization_name": prov.organization_name,
            "city": prov.city.value if prov.city else "",
            "state": prov.state.value if prov.state else "",
            "requested_at": str(req.created_at),
        })
    
    return {
        "total": total,
        "page": page,
        "limit": limit,
        "total_pages": max(1, (total + limit - 1) // limit),
        "requests": results
    }


def approve_provider(
    db: Session,
    request_id: str,
    admin_id: str,
    notes: str = ""
) -> ProviderApprovalRequest:
    """
    Approve a provider approval request.
    This makes the provider visible to customers in the marketplace.
    """
    approval_request = db.query(ProviderApprovalRequest).filter(
        ProviderApprovalRequest.id == request_id
    ).first()
    
    if not approval_request:
        raise not_found("Approval request")
    
    if approval_request.status != "pending":
        raise bad_request("This request has already been processed")
    
    # Update approval request
    approval_request.status = "approved"
    approval_request.approved_by = admin_id
    approval_request.approval_notes = notes
    approval_request.approved_at = datetime.utcnow()
    
    # Update provider to make visible in marketplace
    provider = approval_request.provider
    provider.approval_status = "approved"
    
    db.commit()
    db.refresh(approval_request)
    db.refresh(provider)
    
    # Invalidate caches so marketplace updates immediately
    from utils.cache import invalidate
    invalidate(f"cache:provider:profile:{provider.user_id}")
    invalidate(f"cache:customer:provider:{provider.id}")
    invalidate("cache:customer:providers")  # ← Also invalidate the main providers list cache
    
    # Notify provider
    notification = Notification(
        user_id=provider.user_id,
        title="Profile Approved",
        message="Your provider profile has been approved and is now visible to customers in the marketplace!",
        type="provider_approved",
        reference_id=provider.id,
    )
    db.add(notification)
    db.commit()
    
    return approval_request


def reject_provider(
    db: Session,
    request_id: str,
    admin_id: str,
    notes: str = ""
) -> ProviderApprovalRequest:
    """
    Reject a provider approval request.
    Provider remains invisible to customers.
    """
    approval_request = db.query(ProviderApprovalRequest).filter(
        ProviderApprovalRequest.id == request_id
    ).first()
    
    if not approval_request:
        raise not_found("Approval request")
    
    if approval_request.status != "pending":
        raise bad_request("This request has already been processed")
    
    # Update approval request
    approval_request.status = "rejected"
    approval_request.approved_by = admin_id
    approval_request.approval_notes = notes
    approval_request.approved_at = datetime.utcnow()
    
    # Update provider approval status
    provider = approval_request.provider
    provider.approval_status = "rejected"
    
    db.commit()
    db.refresh(approval_request)
    db.refresh(provider)
    
    # Invalidate caches
    from utils.cache import invalidate
    invalidate(f"cache:provider:profile:{provider.user_id}")
    invalidate(f"cache:customer:provider:{provider.id}")
    
    # Notify provider with rejection reason
    notification = Notification(
        user_id=provider.user_id,
        title="Profile Rejection",
        message=f"Your provider profile was not approved. Reason: {notes or 'Please review your profile and resubmit'}",
        type="provider_rejected",
        reference_id=provider.id,
    )
    db.add(notification)
    db.commit()
    
    return approval_request


def get_provider_approval_status(db: Session, provider_id: str) -> dict:
    """Get the current approval status of a provider"""
    provider = db.query(ServiceProvider).filter(
        ServiceProvider.id == provider_id
    ).first()
    
    if not provider:
        raise not_found("Provider")
    
    approval_request = db.query(ProviderApprovalRequest).filter(
        ProviderApprovalRequest.provider_id == provider_id
    ).order_by(ProviderApprovalRequest.created_at.desc()).first()
    
    return {
        "provider_id": provider_id,
        "approval_status": provider.approval_status,
        "request": {
            "id": approval_request.id if approval_request else None,
            "status": approval_request.status if approval_request else None,
            "created_at": str(approval_request.created_at) if approval_request else None,
            "approved_at": str(approval_request.approved_at) if approval_request and approval_request.approved_at else None,
            "approval_notes": approval_request.approval_notes if approval_request else None,
        } if approval_request else None
    }
