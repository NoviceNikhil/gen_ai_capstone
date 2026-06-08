import os
import razorpay
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), '.env'))

key_id = os.environ.get("RAZORPAY_KEY_ID")
key_secret = os.environ.get("RAZORPAY_KEY_SECRET")

print(f"Key ID: {key_id}")
if not key_id:
    print("No keys")
    exit(1)

client = razorpay.Client(auth=(key_id, key_secret))
try:
    order = client.order.create({
        "amount": 50000,
        "currency": "INR",
        "receipt": "test_receipt",
    })
    print("Success:", order)
except Exception as e:
    print("Error:", repr(e))
