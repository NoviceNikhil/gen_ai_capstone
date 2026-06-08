import requests
from jose import jwt
from datetime import datetime, timedelta
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
import sys
import os

sys.path.append(os.getcwd())
from config.settings import settings

engine = create_engine(settings.DATABASE_URL)
Session = sessionmaker(bind=engine)
session = Session()

admin = session.execute(text("SELECT id, email, role FROM users WHERE role='admin' LIMIT 1")).fetchone()
target_id = session.execute(text("SELECT id FROM users WHERE role='customer' LIMIT 1")).fetchone()[0]

to_encode = {"id": admin[0], "role": admin[2], "email": admin[1]}
expire = datetime.utcnow() + timedelta(minutes=60)
to_encode.update({"exp": expire})
token = jwt.encode(to_encode, settings.JWT_SECRET, algorithm="HS256")

print(f"Testing PATCH for target {target_id}")
res2 = requests.patch(f"http://localhost:5000/api/admin/users/{target_id}/status", json={"is_active": False}, headers={"Authorization": f"Bearer {token}"})
print("PATCH:", res2.status_code, res2.text)
