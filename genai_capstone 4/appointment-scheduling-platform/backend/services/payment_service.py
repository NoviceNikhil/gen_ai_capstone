import hashlib
import hmac
import os
import razorpay
from datetime import datetime, timedelta
from sqlalchemy.orm import Session

from models.appointment import Appointment
from models.appointment_history import AppointmentHistory
from models.service_provider import ServiceProvider
from models import CommissionLedger
from config.settings import settings
from utils.exceptions import not_found, bad_request
from services.audit_log_service import log_event

RAZORPAY_CONFIGURED = bool(settings.RAZORPAY_KEY_ID and settings.RAZORPAY_KEY_SECRET)
razorpay_client = (
    razorpay.Client(auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET))
    if RAZORPAY_CONFIGURED
    else None
)


def create_payment_order(db: Session, appointment_id: str, customer_id: str) -> dict:
    """
    Create a Razorpay order for an appointment's consultation fee.
    Returns order details that the frontend passes to Razorpay Checkout.
    """
    try:
        appointment = db.query(Appointment).filter(
            Appointment.id == appointment_id,
            Appointment.customer_id == customer_id,
        ).first()

        if not appointment:
            raise bad_request("Appointment not found")

        if appointment.is_paid:
            raise bad_request("This appointment has already been paid for")

        if appointment.status == "cancelled":
            raise bad_request("Cannot create payment for a cancelled appointment")

        fee = float(appointment.consultation_fee_snapshot or 0)
        if fee <= 0:
            raise bad_request("This provider does not charge a consultation fee")

        # Amount in paise (Razorpay requires integer paise)
        amount_paise = int(fee * 100)

        if not RAZORPAY_CONFIGURED:
            raise bad_request("Razorpay is not configured on server")

        try:
            order = razorpay_client.order.create({
                "amount": amount_paise,
                "currency": "INR",
                "receipt": f"appt_{appointment_id[:8]}",
                "notes": {
                    "appointment_id": appointment_id,
                    "customer_id": customer_id,
                },
            })
            order_id = order["id"]
            key_id = settings.RAZORPAY_KEY_ID
        except Exception as exc:
            raise bad_request(f"Razorpay order creation failed: {str(exc)}")

        # Persist order ID on appointment. Payment records are only created
        # after verification; there is no pay-later or pending-payment state.
        appointment.razorpay_order_id = order_id
        
        db.commit()
        log_event(
            event_type="payment_order_created",
            actor_id=customer_id,
            metadata={
                "appointment_id": appointment_id,
                "order_id": order_id,
                "amount_paise": amount_paise,
            },
        )

        return {
            "razorpay_order_id": order_id,
            "razorpay_key_id": key_id,
            "amount": amount_paise,
            "currency": "INR",
            "appointment_id": appointment_id,
        }
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise bad_request(f"Payment order error: {str(e)}")


def verify_payment(
    db: Session,
    appointment_id: str,
    razorpay_order_id: str,
    razorpay_payment_id: str,
    razorpay_signature: str,
    customer_id: str | None = None,
) -> dict:
    """
    Verify Razorpay payment signature (HMAC-SHA256).
    On success: mark appointment as paid + confirmed.
    """
    try:
        debug_payments = os.getenv("DEBUG_PAYMENTS", "false").lower() in {"1", "true", "yes"}
        if debug_payments:
            print("[PAYMENT_DEBUG] verify_payment called", {
                "appointment_id": appointment_id,
                "razorpay_order_id": razorpay_order_id,
                "razorpay_payment_id": razorpay_payment_id,
                "customer_id": customer_id,
                "razorpay_configured": RAZORPAY_CONFIGURED,
            })

        if not RAZORPAY_CONFIGURED:
            raise bad_request("Razorpay is not configured on server")

        generated_signature = hmac.new(
            settings.RAZORPAY_KEY_SECRET.encode("utf-8"),
            f"{razorpay_order_id}|{razorpay_payment_id}".encode("utf-8"),
            hashlib.sha256,
        ).hexdigest()
        if generated_signature != razorpay_signature:
            raise bad_request("Payment verification failed — invalid signature")

        # ─── Update appointment ───────────────────────────────────────────────────
        appointment = db.query(Appointment).filter(Appointment.id == appointment_id).first()
        if not appointment:
            raise not_found("Appointment")
        if customer_id and appointment.customer_id != customer_id:
            raise bad_request("Payment verification not allowed for this appointment")
        if appointment.is_paid:
            if appointment.razorpay_payment_id == razorpay_payment_id:
                return {"message": "Payment verified and appointment confirmed", "appointment_id": appointment_id}
            raise bad_request("Appointment already paid")
        if appointment.status == "cancelled":
            raise bad_request("Cannot verify payment for cancelled appointment")
        if not appointment.razorpay_order_id:
            raise bad_request("No payment order exists for this appointment")
        if appointment.razorpay_order_id != razorpay_order_id:
            raise bad_request("Order mismatch for appointment")

        previous_status = appointment.status
        appointment.is_paid = True
        appointment.razorpay_payment_id = razorpay_payment_id
        appointment.status = "confirmed"  # auto-confirm on payment

        from models.payment_records import PaymentRecord
        payment_rec = db.query(PaymentRecord).filter(
            PaymentRecord.appointment_id == appointment.id,
            PaymentRecord.razorpay_order_id == razorpay_order_id,
        ).first()
        if payment_rec:
            payment_rec.status = "paid"
            payment_rec.razorpay_payment_id = razorpay_payment_id
        else:
            # Fallback if record was somehow not created previously
            db.add(PaymentRecord(
                appointment_id=appointment.id,
                customer_id=appointment.customer_id,
                amount=float(appointment.consultation_fee_snapshot or 0),
                status="paid",
                razorpay_order_id=razorpay_order_id,
                razorpay_payment_id=razorpay_payment_id,
            ))

        db.add(AppointmentHistory(
            appointment_id=appointment.id,
            previous_status=previous_status,
            new_status="confirmed",
            changed_by="payment_system",
            notes=f"Payment verified. Razorpay Payment ID: {razorpay_payment_id}",
        ))

        gross_amount = float(appointment.consultation_fee_snapshot or 0)
        commission_rate = float(settings.PLATFORM_COMMISSION_RATE or 0.10)
        platform_commission = round(gross_amount * commission_rate, 2)
        provider_payout = round(gross_amount - platform_commission, 2)

        # ─── Schedule provider payout 1 hour after appointment time ──────────────────
        appointment_datetime = datetime.combine(appointment.appointment_date, datetime.strptime(appointment.time_slot, "%H:%M").time())
        payout_scheduled_at = appointment_datetime + timedelta(hours=1)

        existing_ledger = db.query(CommissionLedger).filter(
            CommissionLedger.appointment_id == appointment.id
        ).first()
        if not existing_ledger:
            db.add(CommissionLedger(
                appointment_id=appointment.id,
                gross_amount=gross_amount,
                commission_rate=commission_rate,
                platform_commission_amount=platform_commission,
                provider_payout_amount=provider_payout,
                payout_scheduled_at=payout_scheduled_at,
                payout_status="pending",
            ))

        # In-app notification: payment success + booking confirmation
        try:
            from services.notification_service import create_notification
            provider = db.query(ServiceProvider).filter(ServiceProvider.id == appointment.provider_id).first()
            provider_name = provider.user.full_name if provider and provider.user else "Provider"
            create_notification(
                db=db,
                user_id=appointment.customer_id,
                notification_type="other",
                title="Payment Successful",
                message=(
                    f"Your payment was successful. Your appointment with {provider_name} on "
                    f"{appointment.appointment_date} at {appointment.time_slot} is confirmed."
                ),
                related_entity_id=appointment.id,
                related_entity_type="appointment",
                action_url=f"/customer/appointments/{appointment.id}",
            )
            db.flush()
        except Exception:
            pass

        db.commit()
        log_event(
            event_type="payment_verified",
            actor_id=appointment.customer_id,
            metadata={
                "appointment_id": appointment.id,
                "razorpay_order_id": razorpay_order_id,
                "razorpay_payment_id": razorpay_payment_id,
                "gross_amount": gross_amount,
                "commission_rate": commission_rate,
                "platform_commission_amount": platform_commission,
                "provider_payout_amount": provider_payout,
            },
        )

        return {"message": "Payment verified and appointment confirmed", "appointment_id": appointment_id}
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise bad_request(f"Payment verification error: {str(e)}")
