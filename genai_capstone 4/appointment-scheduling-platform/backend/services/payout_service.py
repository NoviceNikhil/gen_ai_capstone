"""
Payout service for handling deferred provider payments.

Process: 1 hour after appointment completion, payment is released to provider.
This service finds scheduled payouts and marks them as disbursed, sending email alerts.
"""

from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import and_

from models import CommissionLedger, Appointment, User, ServiceProvider
from utils.exceptions import not_found
from services.audit_log_service import log_event
from utils.email import send_provider_payment_processed_email


def process_scheduled_payouts(db: Session) -> dict:
    """
    Process all payouts that are scheduled for the current time or earlier.
    
    Returns: Dict with count of processed payouts and any errors
    """
    try:
        now = datetime.utcnow()
        
        # Find all pending payouts where scheduled time has passed
        pending_payouts = db.query(CommissionLedger).filter(
            and_(
                CommissionLedger.payout_status == "pending",
                CommissionLedger.payout_scheduled_at <= now
            )
        ).all()
        
        processed_count = 0
        failed_count = 0
        errors = []
        
        for ledger in pending_payouts:
            try:
                # Get appointment details
                appointment = db.query(Appointment).filter(
                    Appointment.id == ledger.appointment_id
                ).first()
                
                if not appointment:
                    ledger.payout_status = "failed"
                    errors.append(f"Appointment {ledger.appointment_id} not found")
                    failed_count += 1
                    continue
                
                # Get provider details
                provider = db.query(ServiceProvider).filter(
                    ServiceProvider.id == appointment.provider_id
                ).first()
                
                if not provider:
                    ledger.payout_status = "failed"
                    errors.append(f"Provider {appointment.provider_id} not found")
                    failed_count += 1
                    continue
                
                # Get provider user for email
                provider_user = db.query(User).filter(
                    User.id == provider.user_id
                ).first()
                
                if not provider_user:
                    ledger.payout_status = "failed"
                    errors.append(f"Provider user {provider.user_id} not found")
                    failed_count += 1
                    continue
                
                # Get customer details for context
                customer = db.query(User).filter(
                    User.id == appointment.customer_id
                ).first()
                
                # Mark payout as disbursed
                ledger.payout_status = "disbursed"
                ledger.payout_processed_at = now
                db.commit()
                
                # Send email notification to provider
                try:
                    send_provider_payment_processed_email(
                        provider_email=provider_user.email,
                        provider_name=provider_user.full_name,
                        customer_name=customer.full_name if customer else "Customer",
                        appointment_date=appointment.appointment_date,
                        appointment_time=appointment.time_slot,
                        amount=float(ledger.provider_payout_amount),
                        category=appointment.category_id,  # Type of service
                    )
                except Exception as email_err:
                    print(f"[PAYOUT_SERVICE] Failed to send email to {provider_user.email}: {str(email_err)}")
                    # Don't fail the payout if email fails
                
                # Log event
                log_event(
                    event_type="provider_payout_processed",
                    actor_id="system",
                    metadata={
                        "appointment_id": appointment.id,
                        "provider_id": provider.id,
                        "provider_name": provider_user.full_name,
                        "amount": float(ledger.provider_payout_amount),
                        "commission_ledger_id": ledger.id,
                    },
                )
                
                processed_count += 1
                
            except Exception as e:
                failed_count += 1
                errors.append(f"Error processing payout for ledger {ledger.id}: {str(e)}")
                print(f"[PAYOUT_SERVICE] Error processing payout: {str(e)}")
                import traceback
                traceback.print_exc()
        
        return {
            "status": "success",
            "processed_count": processed_count,
            "failed_count": failed_count,
            "errors": errors,
            "timestamp": now.isoformat(),
        }
        
    except Exception as e:
        print(f"[PAYOUT_SERVICE] Fatal error in process_scheduled_payouts: {str(e)}")
        import traceback
        traceback.print_exc()
        return {
            "status": "failed",
            "error": str(e),
            "timestamp": datetime.utcnow().isoformat(),
        }


def get_pending_payouts(db: Session) -> list:
    """Get all pending payouts that haven't been processed yet"""
    pending = db.query(CommissionLedger).filter(
        CommissionLedger.payout_status == "pending"
    ).all()
    
    return [
        {
            "ledger_id": p.id,
            "appointment_id": p.appointment_id,
            "amount": float(p.provider_payout_amount),
            "scheduled_at": p.payout_scheduled_at.isoformat() if p.payout_scheduled_at else None,
            "status": p.payout_status,
        }
        for p in pending
    ]


def get_payout_history(db: Session, limit: int = 100) -> list:
    """Get recent processed payouts (last N)"""
    disbursed = db.query(CommissionLedger).filter(
        CommissionLedger.payout_status.in_(["disbursed", "failed"])
    ).order_by(CommissionLedger.payout_processed_at.desc()).limit(limit).all()
    
    return [
        {
            "ledger_id": p.id,
            "appointment_id": p.appointment_id,
            "amount": float(p.provider_payout_amount),
            "scheduled_at": p.payout_scheduled_at.isoformat() if p.payout_scheduled_at else None,
            "processed_at": p.payout_processed_at.isoformat() if p.payout_processed_at else None,
            "status": p.payout_status,
        }
        for p in disbursed
    ]
