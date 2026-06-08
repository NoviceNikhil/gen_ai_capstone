from datetime import date, timedelta, datetime

from config.database import SessionLocal
from models.user import User
from models.service_provider import ServiceProvider
from models.availability import Availability
from models.appointment import Appointment
from services import appointment_service, payment_service


def _pick_slot(provider_id: str, db):
    for d in range(1, 15):
        target = date.today() + timedelta(days=d)
        weekday = target.weekday()
        tpl = db.query(Availability).filter(
            Availability.provider_id == provider_id,
            Availability.day_of_week == weekday,
            Availability.is_active == True,
        ).first()
        if not tpl:
            continue
        cursor = datetime.combine(target, tpl.start_time)
        end_dt = datetime.combine(target, tpl.end_time)
        delta = timedelta(minutes=tpl.slot_duration_minutes)
        while cursor + delta <= end_dt:
            slot = cursor.strftime("%H:%M")
            clash = db.query(Appointment).filter(
                Appointment.provider_id == provider_id,
                Appointment.appointment_date == target,
                Appointment.time_slot == slot,
                Appointment.status.in_(["pending", "confirmed"]),
            ).first()
            if not clash:
                return target, slot
            cursor += delta
    return None, None


def main():
    db = SessionLocal()
    try:
        customer = db.query(User).filter(User.role == "customer", User.is_active == True).first()
        provider = db.query(ServiceProvider).filter(
            ServiceProvider.is_verified == True,
            ServiceProvider.is_accepting_appointments == True,
        ).first()

        if not customer or not provider:
            print("DEBUG_FAIL: missing customer/provider")
            return

        appt_date, slot = _pick_slot(provider.id, db)
        if not appt_date:
            print("DEBUG_FAIL: no slot template found")
            return

        print("STEP1_BOOK_START", {"customer": customer.email, "provider_id": provider.id, "date": str(appt_date), "slot": slot})
        appt = appointment_service.book_appointment(
            db=db,
            customer_id=customer.id,
            provider_id=provider.id,
            appointment_date=appt_date,
            time_slot=slot,
            category_id=provider.category_id,
            notes="[DEBUG] payment flow test",
        )
        print("STEP1_BOOK_OK", {"appointment_id": appt.id, "fee": float(appt.consultation_fee_snapshot or 0), "status": appt.status})

        print("STEP2_ORDER_START", {"appointment_id": appt.id})
        order = payment_service.create_payment_order(db, appt.id, customer.id)
        print("STEP2_ORDER_OK", order)

        print("STEP3_VERIFY_START", {"appointment_id": appt.id})
        verify = payment_service.verify_payment(
            db=db,
            appointment_id=appt.id,
            razorpay_order_id=order["razorpay_order_id"],
            razorpay_payment_id=f"debug_pay_{int(datetime.now().timestamp())}",
            razorpay_signature="debug_signature",
            customer_id=customer.id,
        )
        print("STEP3_VERIFY_OK", verify)

        fresh = db.query(Appointment).filter(Appointment.id == appt.id).first()
        print("FINAL_APPOINTMENT", {"id": fresh.id, "is_paid": fresh.is_paid, "status": fresh.status, "order_id": fresh.razorpay_order_id, "payment_id": fresh.razorpay_payment_id})
    finally:
        db.close()


if __name__ == "__main__":
    main()
