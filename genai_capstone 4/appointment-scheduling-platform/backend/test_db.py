import sys
import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from config.database import Base, engine, SessionLocal
from models import Appointment, User

db = SessionLocal()
users = db.query(User).filter(User.role == 'customer').all()
for u in users:
    count = db.query(Appointment).filter(Appointment.customer_id == u.id).count()
    print(f"Customer {u.email} has {count} appointments")
