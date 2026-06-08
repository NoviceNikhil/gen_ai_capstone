from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel

from config.database import get_db
from middleware.auth import get_current_user
from services import payment_service
from services.payout_service import process_scheduled_payouts, get_pending_payouts, get_payout_history
from utils.response import success_response

router = APIRouter(prefix="/api/payments", tags=["Payments"])


class CreateOrderRequest(BaseModel):
    appointment_id: str


class VerifyPaymentRequest(BaseModel):
    appointment_id: str
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str


# ──────────────────────────────────────────────────────────────────────────────
# CREATE ORDER
# ──────────────────────────────────────────────────────────────────────────────

@router.post("/create-order")
def create_order(
    body: CreateOrderRequest,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """
    Creates a Razorpay order for the appointment's consultation fee.
    Returns order ID + key for frontend Razorpay Checkout.
    """
    data = payment_service.create_payment_order(db, body.appointment_id, current_user["id"])
    return success_response(data, "Razorpay order created")


# ──────────────────────────────────────────────────────────────────────────────
# VERIFY PAYMENT
# ──────────────────────────────────────────────────────────────────────────────

@router.post("/verify")
def verify_payment(
    body: VerifyPaymentRequest,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """
    Verifies Razorpay payment signature.
    On success: marks appointment as paid + confirmed.
    Schedules provider payout for 1 hour after appointment time.
    """
    data = payment_service.verify_payment(
        db,
        body.appointment_id,
        body.razorpay_order_id,
        body.razorpay_payment_id,
        body.razorpay_signature,
        current_user["id"],
    )
    return success_response(data, "Payment verified and appointment confirmed")


# ──────────────────────────────────────────────────────────────────────────────
# PAYOUT MANAGEMENT (Admin/Cron)
# ──────────────────────────────────────────────────────────────────────────────

@router.post("/process-payouts")
def process_payouts(db: Session = Depends(get_db)):
    """
    Process all scheduled payouts that are due (1 hour after appointment time).
    This endpoint should be called:
    - By a cron job every minute
    - Or manually by admin
    Email notifications are sent to providers when payout is processed.
    """
    result = process_scheduled_payouts(db)
    return success_response(result, "Payout processing completed")


@router.get("/pending-payouts")
def get_pending(db: Session = Depends(get_db)):
    """Get list of all pending payouts waiting to be processed"""
    payouts = get_pending_payouts(db)
    return success_response(payouts, f"Found {len(payouts)} pending payouts")


@router.get("/payout-history")
def get_history(
    db: Session = Depends(get_db),
    limit: int = 100
):
    """Get recent payout history (processed and failed payouts)"""
    history = get_payout_history(db, limit)
    return success_response(history, f"Retrieved {len(history)} recent payouts")
