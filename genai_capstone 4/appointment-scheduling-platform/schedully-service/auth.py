"""
Minimal JWT auth — validates the same tokens issued by the main backend.
Reads JWT_SECRET from environment.
"""

import os
from fastapi import Request, HTTPException
from jose import jwt, JWTError

JWT_SECRET = os.environ.get("JWT_SECRET", "fallback_secret")
JWT_ALGORITHM = "HS256"


async def get_current_user(request: Request) -> dict:
    """Extract and validate JWT from Authorization header or cookie."""
    token = None

    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        token = auth_header.split(" ")[1]

    if not token:
        token = request.cookies.get("token")

    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return {
            "id": payload.get("id"),
            "role": payload.get("role"),
            "email": payload.get("email"),
        }
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
