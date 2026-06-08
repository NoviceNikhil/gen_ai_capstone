import requests
import os
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), '.env'))

# We need a valid token. Let's get one by logging in.
url = "http://localhost:5000/auth/login"
payload = {"email": "abose@Schedex.com", "password": "password123"}
res = requests.post(url, json=payload)
if res.status_code != 200:
    print("Login failed", res.text)
    exit(1)
token = res.json()["data"]["access_token"]
print("Token acquired")

# Let's get an appointment ID
appt_res = requests.get("http://localhost:5000/api/customer/appointments", headers={"Authorization": f"Bearer {token}"})
appts = appt_res.json()["data"]
appt_id = None
for a in appts:
    if a["status"] == "pending":
        appt_id = a["id"]
        break

if not appt_id:
    print("No pending appointment")
    exit(1)

print(f"Testing appointment {appt_id}")
pay_res = requests.post("http://localhost:5000/api/payments/create-order", json={"appointment_id": appt_id}, headers={"Authorization": f"Bearer {token}"})
print(pay_res.status_code)
print(pay_res.text)
