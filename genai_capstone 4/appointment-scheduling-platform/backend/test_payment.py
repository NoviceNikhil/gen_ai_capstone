import sys
import os
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), '.env'))
sys.path.append(os.path.dirname(__file__))

from config.database import SessionLocal
from services.payment_service import create_payment_order
from models.appointment import Appointment

db = SessionLocal()
# Grab a pending appointment
appt = db.query(Appointment).filter(Appointment.status == "pending", Appointment.consultation_fee_snapshot > 0).first()
if not appt:
    print("No appt")
    exit(1)

try:
    res = create_payment_order(db, appt.id, appt.customer_id)
    print("Success:", res)
except Exception as e:
    import traceback
    traceback.print_exc()
