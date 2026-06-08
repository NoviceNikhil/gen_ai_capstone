import requests
import json

res = requests.post("http://localhost:5000/auth/login", json={"email": "nikhilchathapuram@gmail.com", "password": "Admin123"})
print("LOGIN:", res.status_code, res.text)
if res.status_code == 200:
    token = res.json()["token"]
    res2 = requests.patch("http://localhost:5000/api/admin/users/123/status", json={"is_active": False}, headers={"Authorization": f"Bearer {token}"})
    print("PATCH:", res2.status_code, res2.text)
