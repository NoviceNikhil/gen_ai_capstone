from fastapi import Request, Cookie, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import Optional
from utils.security import decode_token
from utils.exceptions import unauthorized

security = HTTPBearer(auto_error=False)


async def get_current_user(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
):
    """
    JWT authentication dependency — mirrors capstone's authenticate_middlewere.js.

    Priority order:
      1. Authorization: Bearer <token>  (header)
      2. token cookie                    (httpOnly cookie)
    """
    token: Optional[str] = None

    # 1️⃣ Check Authorization header
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header.split(" ")[1]

    # 2️⃣ Fall back to cookie
    if not token:
        token = request.cookies.get("token")

    if not token:
        raise unauthorized("Unauthorized — No token provided")

    # 3️⃣ Decode and validate
    payload = decode_token(token)
    if not payload:
        raise unauthorized("Unauthorized — Invalid or expired token")

    # 4️⃣ Return decoded payload (id, role, email)
    return payload


def require_role(*roles: str):
    """
    Role-based access dependency factory.
    Usage: Depends(require_role("admin")) or Depends(require_role("customer", "admin"))
    Mirrors capstone's roleVerifyMiddlewere.js
    """
    async def role_checker(request: Request):
        user = await get_current_user(request)
        if user.get("role") not in roles:
            from utils.exceptions import forbidden
            raise forbidden(
                f"Access denied. Required role(s): {', '.join(roles)}"
            )
        return user

    return role_checker
