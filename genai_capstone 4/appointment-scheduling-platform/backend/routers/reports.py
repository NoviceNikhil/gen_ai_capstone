from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy.orm import Session
import httpx

from config.database import get_db
from middleware.auth import get_current_user
from config.settings import settings
from models.service_provider import ServiceProvider

router = APIRouter(prefix="/api/reports", tags=["Reports"])


@router.get("/admin/appointments")
async def get_admin_appointments(
    request_user: dict = Depends(get_current_user),
):
    if request_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    url = f"{settings.REPORT_SERVICE_URL}/reports/admin/appointments"
    headers = {"x-report-secret": settings.REPORT_SERVICE_SECRET}
    
    async with httpx.AsyncClient() as client:
        try:
            res = await client.get(url, headers=headers, timeout=30.0)
            return Response(
                content=res.content,
                media_type=res.headers.get("content-type"),
                status_code=res.status_code
            )
        except Exception as e:
            raise HTTPException(status_code=502, detail=f"Report service unavailable: {str(e)}")


@router.get("/admin/users")
async def get_admin_users(
    request_user: dict = Depends(get_current_user),
):
    if request_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    url = f"{settings.REPORT_SERVICE_URL}/reports/admin/users"
    headers = {"x-report-secret": settings.REPORT_SERVICE_SECRET}
    
    async with httpx.AsyncClient() as client:
        try:
            res = await client.get(url, headers=headers, timeout=30.0)
            return Response(
                content=res.content,
                media_type=res.headers.get("content-type"),
                status_code=res.status_code
            )
        except Exception as e:
            raise HTTPException(status_code=502, detail=f"Report service unavailable: {str(e)}")


@router.get("/admin/providers")
async def get_admin_providers(
    request_user: dict = Depends(get_current_user),
):
    if request_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    url = f"{settings.REPORT_SERVICE_URL}/reports/admin/providers"
    headers = {"x-report-secret": settings.REPORT_SERVICE_SECRET}
    
    async with httpx.AsyncClient() as client:
        try:
            res = await client.get(url, headers=headers, timeout=30.0)
            return Response(
                content=res.content,
                media_type=res.headers.get("content-type"),
                status_code=res.status_code
            )
        except Exception as e:
            raise HTTPException(status_code=502, detail=f"Report service unavailable: {str(e)}")


@router.get("/provider/{provider_id}/schedule")
async def get_provider_schedule(
    provider_id: str,
    month: int = Query(...),
    year: int = Query(...),
    db: Session = Depends(get_db),
    request_user: dict = Depends(get_current_user),
):
    # Resolve "self" to the actual provider record for the current user
    if provider_id == "self":
        provider = db.query(ServiceProvider).filter(ServiceProvider.user_id == request_user.get("id")).first()
        if not provider:
            raise HTTPException(status_code=404, detail="Provider profile not found")
        provider_id = provider.id
    else:
        provider = db.query(ServiceProvider).filter(ServiceProvider.id == provider_id).first()
        if not provider:
            raise HTTPException(status_code=404, detail="Provider not found")
    
    if request_user.get("role") != "admin" and provider.user_id != request_user.get("id"):
        raise HTTPException(status_code=403, detail="Access denied. Cannot download other provider's schedule.")
    
    url = f"{settings.REPORT_SERVICE_URL}/reports/provider/{provider_id}/schedule"
    headers = {"x-report-secret": settings.REPORT_SERVICE_SECRET}
    params = {"month": month, "year": year}
    
    async with httpx.AsyncClient() as client:
        try:
            res = await client.get(url, headers=headers, params=params, timeout=30.0)
            return Response(
                content=res.content,
                media_type=res.headers.get("content-type"),
                status_code=res.status_code
            )
        except Exception as e:
            raise HTTPException(status_code=502, detail=f"Report service unavailable: {str(e)}")


@router.get("/customer/{customer_id}/history")
async def get_customer_history(
    customer_id: str,
    request_user: dict = Depends(get_current_user),
):
    if request_user.get("role") != "admin" and customer_id != request_user.get("id"):
        raise HTTPException(status_code=403, detail="Access denied. Cannot download other customer's history.")
    
    url = f"{settings.REPORT_SERVICE_URL}/reports/customer/{customer_id}/history"
    headers = {"x-report-secret": settings.REPORT_SERVICE_SECRET}
    
    async with httpx.AsyncClient() as client:
        try:
            res = await client.get(url, headers=headers, timeout=30.0)
            return Response(
                content=res.content,
                media_type=res.headers.get("content-type"),
                status_code=res.status_code
            )
        except Exception as e:
            raise HTTPException(status_code=502, detail=f"Report service unavailable: {str(e)}")
