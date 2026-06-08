import os
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, Request, Response, UploadFile, File
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from config.database import get_db
from schemas.auth import (
    SignupRequest, LoginRequest, OtpVerifyRequest,
    ResendOtpRequest, ForgotPasswordRequest, ResetPasswordRequest,
    GoogleAuthRequest, GoogleCompleteSignupRequest, ProfileUpdateRequest
)
from services import auth_service
from middleware.auth import get_current_user
from middleware.rate_limiter import limiter, LOGIN_LIMIT, OTP_LIMIT, SIGNUP_LIMIT
from utils.response import success_response, error_response

router = APIRouter(prefix="/auth", tags=["Authentication"])
UPLOAD_DIR = Path(__file__).resolve().parents[1] / "uploads" / "provider_onboarding"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


# ──────────────────────────────────────────────────────────────────────────────
# SIGNUP
# ──────────────────────────────────────────────────────────────────────────────

@router.post("/signup")
@limiter.limit(SIGNUP_LIMIT)
def signup(request: Request, body: SignupRequest, db: Session = Depends(get_db)):
    data = auth_service.signup_user(
        db,
        body.full_name,
        body.email,
        body.password,
        body.phone,
        body.role,
        onboarding_data={
            "organization_name": body.organization_name,
            "owner_name": body.owner_name,
            "email": body.email,
            "phone": body.phone,
            "address": body.address,
            "identity_proof_url": body.identity_proof_url,
            "tax_number": body.tax_number,
            "bank_details": body.bank_details,
            "profile_photo_url": body.profile_photo_url,
            "certificates_urls": body.certificates_urls,
        },
    )
    return success_response(data, "Signup successful — OTP sent to email", 201)


@router.post("/upload-onboarding-file")
async def upload_onboarding_file(file: UploadFile = File(...)):
    allowed_exts = {".pdf", ".doc", ".docx"}
    original_name = file.filename or ""
    ext = Path(original_name).suffix.lower()
    if ext not in allowed_exts:
        return error_response("Only .pdf, .doc, and .docx files are allowed", 400)

    safe_name = f"{uuid.uuid4().hex}{ext}"
    target_path = UPLOAD_DIR / safe_name
    content = await file.read()
    with open(target_path, "wb") as f:
        f.write(content)

    rel_path = f"/uploads/provider_onboarding/{safe_name}"
    return success_response({"file_path": rel_path, "file_name": original_name}, "File uploaded")


# ──────────────────────────────────────────────────────────────────────────────
# OTP VERIFICATION
# ──────────────────────────────────────────────────────────────────────────────

@router.post("/verify-otp")
def verify_otp(body: OtpVerifyRequest, response: Response, db: Session = Depends(get_db)):
    data = auth_service.verify_otp_and_activate(db, body.email, body.otp)
    # Set httpOnly cookie — mirrors capstone cookie pattern
    is_prod = os.getenv("NODE_ENV") == "production"
    response.set_cookie(
        key="token",
        value=data["token"],
        httponly=True,
        samesite="none" if is_prod else "lax",
        secure=is_prod,
        path="/",
    )
    return success_response(data, "OTP verified — account activated")


@router.post("/verify-otp/admin")
def verify_admin_otp(body: OtpVerifyRequest, response: Response, db: Session = Depends(get_db)):
    data = auth_service.verify_admin_otp(db, body.email, body.otp)
    is_prod = os.getenv("NODE_ENV") == "production"
    response.set_cookie(key="token", value=data["token"], httponly=True, samesite="none" if is_prod else "lax", secure=is_prod, path="/")
    return success_response(data, "Admin OTP verified")


# ──────────────────────────────────────────────────────────────────────────────
# LOGIN
# ──────────────────────────────────────────────────────────────────────────────

@router.post("/login")
@limiter.limit(LOGIN_LIMIT)
def login(request: Request, body: LoginRequest, response: Response, db: Session = Depends(get_db)):
    try:
        data = auth_service.login_user(db, body.email, body.password)
        if data.get("token"):
            is_prod = os.getenv("NODE_ENV") == "production"
            response.set_cookie(key="token", value=data["token"], httponly=True, samesite="none" if is_prod else "lax", secure=is_prod, path="/")
        return success_response(data, "Login successful")
    except Exception as e:
        import traceback
        print(f"[LOGIN_ERROR] Email: {body.email}")
        print(f"[LOGIN_ERROR] Error: {str(e)}")
        traceback.print_exc()
        raise


@router.post("/google")
@limiter.limit(LOGIN_LIMIT)
def google_auth(request: Request, body: GoogleAuthRequest, response: Response, db: Session = Depends(get_db)):
    data = auth_service.google_oauth_login(db, body.credential, body.intent, body.role)

    if data.get("token"):
        is_prod = os.getenv("NODE_ENV") == "production"
        response.set_cookie(key="token", value=data["token"], httponly=True, samesite="none" if is_prod else "lax", secure=is_prod, path="/")
        
    return success_response(data, "Google Authentication successful")


@router.post("/google/complete-signup")
@limiter.limit(LOGIN_LIMIT)
def google_complete_signup(
    request: Request,
    body: GoogleCompleteSignupRequest,
    response: Response,
    db: Session = Depends(get_db),
):
    data = auth_service.complete_google_signup(db, body.credential, body.role)

    if data.get("token"):
        is_prod = os.getenv("NODE_ENV") == "production"
        response.set_cookie(key="token", value=data["token"], httponly=True, samesite="none" if is_prod else "lax", secure=is_prod, path="/")

    return success_response(data, "Google signup completed")


@router.get("/google/callback")
def google_callback_proxy(request: Request):
    """
    Proxy callback route for Google OAuth.
    Existing env/app setup points Google callback here; provider calendar sync
    flow is implemented in provider router.
    """
    query_string = str(request.url.query or "")
    target = "/api/provider/calendar/google/callback"
    if query_string:
        target = f"{target}?{query_string}"
    return RedirectResponse(url=target, status_code=307)


# ──────────────────────────────────────────────────────────────────────────────
# RESEND OTP
# ──────────────────────────────────────────────────────────────────────────────

@router.post("/resend-otp")
@limiter.limit(OTP_LIMIT)
def resend_otp(request: Request, body: ResendOtpRequest, db: Session = Depends(get_db)):
    data = auth_service.resend_otp(db, body.email)
    return success_response(data, "OTP resent successfully")


# ──────────────────────────────────────────────────────────────────────────────
# PASSWORD
# ──────────────────────────────────────────────────────────────────────────────

@router.post("/forgot-password")
@limiter.limit(OTP_LIMIT)
def forgot_password(request: Request, body: ForgotPasswordRequest, db: Session = Depends(get_db)):
    data = auth_service.forgot_password(db, body.email)
    return success_response(data, "OTP sent to email")


@router.post("/reset-password")
@limiter.limit(OTP_LIMIT)
def reset_password(request: Request, body: ResetPasswordRequest, db: Session = Depends(get_db)):
    data = auth_service.reset_password(db, body.email, body.otp, body.new_password)
    return success_response(data, "Password reset successfully")


# ──────────────────────────────────────────────────────────────────────────────
# PROFILE
# ──────────────────────────────────────────────────────────────────────────────

@router.get("/profile")
def get_profile(
    request: Request,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    data = auth_service.get_profile(db, current_user["id"])
    return success_response(data, "Profile fetched")

@router.put("/profile")
def update_profile(
    body: ProfileUpdateRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    data = auth_service.update_profile(db, current_user["id"], body.model_dump(exclude_unset=True))
    return success_response(data, "Profile updated successfully")


@router.get("/me")
def me(current_user: dict = Depends(get_current_user), request: Request = None):
    return success_response(current_user, "Token payload")


# ──────────────────────────────────────────────────────────────────────────────
# LOGOUT
# ──────────────────────────────────────────────────────────────────────────────

@router.post("/logout")
def logout(response: Response):
    response.delete_cookie("token")
    return success_response(None, "Logged out successfully")

@router.delete("/me")
def delete_account(
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    data = auth_service.delete_account(db, current_user["id"])
    response.delete_cookie("token")
    return success_response(data, "Account deleted")


from schemas.auth import RestoreAccountRequest # Will need to create this schema

@router.post("/restore")
def restore_account(
    body: RestoreAccountRequest,
    response: Response,
    db: Session = Depends(get_db),
):
    data = auth_service.restore_account(db, body.email, body.password)
    if data.get("token"):
        is_prod = os.getenv("NODE_ENV") == "production"
        response.set_cookie(key="token", value=data["token"], httponly=True, samesite="none" if is_prod else "lax", secure=is_prod, path="/")
    return success_response(data, "Account restored")
