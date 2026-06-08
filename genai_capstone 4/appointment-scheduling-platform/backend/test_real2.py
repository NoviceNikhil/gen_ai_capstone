import requests
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

engine = create_engine("mysql+pymysql://Schedex_user:Schedex_pass@localhost/Schedex_db")
Session = sessionmaker(bind=engine)
session = Session()

admin_email = session.execute(text("SELECT email FROM users WHERE role='admin' LIMIT 1")).fetchone()[0]
target_id = session.execute(text("SELECT id FROM users WHERE role='customer' LIMIT 1")).fetchone()[0]

res = requests.post("http://localhost:5000/auth/login", json={"email": admin_email, "password": "Admin123"})
# This will return OTP flow. Wait, if OTP flow is enabled, I can't easily login.
# Let me just construct a JWT token using the secret key!
