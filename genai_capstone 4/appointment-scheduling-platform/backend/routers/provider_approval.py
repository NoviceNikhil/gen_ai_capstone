"""
API endpoints for provider approval workflow.
Provider-specific endpoints. Admin endpoints are in organization.py
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from config.database import get_db
from middleware.auth import get_current_user, require_role
from services import provider_approval_service
from utils.response import success_response

router = APIRouter(prefix="/api/providers/approval", tags=["Provider Approval"])


@router.get("/status/{provider_id}")
def get_provider_approval_status(
    provider_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """
    Get the approval status of a specific provider.
    Providers can view their own status.
    Admins can view any provider's status.
    """
    try:
        result = provider_approval_service.get_provider_approval_status(db, provider_id)
        return success_response(result, "Provider approval status fetched")
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
