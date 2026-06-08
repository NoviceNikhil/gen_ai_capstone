from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import JSONResponse
from fastapi.encoders import jsonable_encoder
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
import uuid

from config.database import get_db
from middleware.auth import get_current_user, require_role
from models import Dispute, Appointment, PaymentRecord, RefundRecord, User, AppointmentHistory
from utils.response import success_response, success_envelope

router = APIRouter(prefix="/api/disputes", tags=["Disputes"])


class RaiseDisputePayload(BaseModel):
    appointment_id: str
    reason: str


class ResolveDisputePayload(BaseModel):
    action: str  # "refund" or "discharge"


@router.post("")
def raise_dispute(
    body: RaiseDisputePayload,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Raise a dispute on an appointment (Customer or Provider)"""
    appt = db.query(Appointment).filter(Appointment.id == body.appointment_id).first()
    if not appt:
        raise HTTPException(status_code=404, detail="Appointment not found")

    # Authorize: user must be customer or provider of this appointment
    is_provider = False
    if appt.provider and appt.provider.user_id == current_user["id"]:
        is_provider = True

    if current_user["id"] != appt.customer_id and not is_provider:
        raise HTTPException(status_code=403, detail="Not authorized to dispute this appointment")

    # Only completed or confirmed appointments can be disputed
    if appt.status not in ["completed", "confirmed"]:
        raise HTTPException(status_code=400, detail="Only confirmed or completed appointments can be disputed")

    # Check if dispute already exists
    existing = db.query(Dispute).filter(Dispute.appointment_id == body.appointment_id).first()
    if existing:
        raise HTTPException(status_code=400, detail="A dispute already exists for this appointment")

    dispute = Dispute(
        id=str(uuid.uuid4()),
        appointment_id=body.appointment_id,
        raised_by=current_user["id"],
        reason=body.reason,
        status="pending",
    )
    db.add(dispute)
    db.commit()
    db.refresh(dispute)

    return success_response({"dispute": jsonable_encoder(dispute)}, "Dispute raised successfully")


@router.get("")
def list_disputes(
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_role("admin")),
    page: int = Query(1, ge=1),
    limit: int = Query(10, le=50),
):
    """List all disputes (Admin only)"""
    offset = (page - 1) * limit
    disputes = db.query(Dispute).offset(offset).limit(limit).all()
    
    # Eagerly load metadata for UI display
    data = []
    for d in disputes:
        creator = db.query(User).filter(User.id == d.raised_by).first()
        appt = db.query(Appointment).filter(Appointment.id == d.appointment_id).first()
        customer_user = db.query(User).filter(User.id == appt.customer_id).first() if appt else None
        provider_user = db.query(User).filter(User.id == appt.provider.user_id).first() if (appt and appt.provider) else None

        data.append({
            "id": d.id,
            "appointment_id": d.appointment_id,
            "raised_by": d.raised_by,
            "raised_by_name": creator.full_name if creator else "Unknown",
            "raised_by_role": creator.role if creator else "Unknown",
            "reason": d.reason,
            "status": d.status,
            "created_at": str(d.created_at),
            "customer_name": customer_user.full_name if customer_user else "N/A",
            "provider_name": provider_user.full_name if provider_user else "N/A",
            "amount": float(appt.consultation_fee_snapshot or 0) if appt else 0,
        })

    return success_envelope(data, "Disputes fetched")


@router.post("/{dispute_id}/resolve")
def resolve_dispute(
    dispute_id: str,
    body: ResolveDisputePayload,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_role("admin")),
):
    """Resolve a dispute (Admin only)"""
    dispute = db.query(Dispute).filter(Dispute.id == dispute_id).first()
    if not dispute:
        raise HTTPException(status_code=404, detail="Dispute not found")

    if dispute.status != "pending":
        raise HTTPException(status_code=400, detail="Dispute is already resolved")

    appt = db.query(Appointment).filter(Appointment.id == dispute.appointment_id).first()
    if not appt:
        raise HTTPException(status_code=404, detail="Associated appointment not found")

    if body.action == "refund":
        dispute.status = "resolved_refunded"
        appt.status = "refunded"
        
        # Log status history
        db.add(AppointmentHistory(
            id=str(uuid.uuid4()),
            appointment_id=appt.id,
            previous_status="disputed",
            new_status="refunded",
            changed_by=current_user["id"],
            notes=f"Resolved dispute {dispute_id} via refund."
        ))

        # Check and process refund record
        pay_rec = db.query(PaymentRecord).filter(PaymentRecord.appointment_id == appt.id).first()
        if pay_rec:
            pay_rec.status = "refunded"
            refund_rec = RefundRecord(
                id=str(uuid.uuid4()),
                payment_record_id=pay_rec.id,
                appointment_id=appt.id,
                customer_id=appt.customer_id,
                amount=pay_rec.amount,
                penalty_deducted=0.0,
                reason="Dispute Resolution Refund",
                status="processed",
            )
            db.add(refund_rec)
            
    elif body.action == "discharge":
        dispute.status = "resolved_discharged"
        # Discharge keeps the payment or completes it
        db.add(AppointmentHistory(
            id=str(uuid.uuid4()),
            appointment_id=appt.id,
            previous_status="disputed",
            new_status=appt.status,
            changed_by=current_user["id"],
            notes=f"Resolved dispute {dispute_id} via discharge."
        ))
    else:
        raise HTTPException(status_code=400, detail="Invalid action. Must be 'refund' or 'discharge'")

    db.commit()
    db.refresh(dispute)
    return success_response({"dispute": jsonable_encoder(dispute)}, "Dispute resolved successfully")
