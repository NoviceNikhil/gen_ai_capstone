import requests
import json
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# connect to DB to get a user
engine = create_engine("mysql+pymysql://Schedex_user:Schedex_pass@localhost/Schedex_db")
Session = sessionmaker(bind=engine)
session = Session()

# get an admin
admin_result = session.execute("SELECT email FROM users WHERE role='admin' LIMIT 1").fetchone()
admin_email = admin_result[0]

# get a random user to toggle
target_result = session.execute("SELECT id, is_active FROM users WHERE role='customer' LIMIT 1").fetchone()
target_id = target_result[0]
target_active = target_result[1]

# login
print(f"Logging in as {admin_email}")
res = requests.post("http://localhost:5000/auth/login", json={"email": admin_email, "password": "Admin123"})
if res.status_code == 200:
    print("LOGIN SUCCESS", res.json())
    # Assuming it needs OTP verification, let's bypass by doing what happens next? 
    # Wait, the admin needs OTP. But what if we just grab a token directly via pyjwt?
    pass
else:
    print("LOGIN FAILED", res.status_code, res.text)
