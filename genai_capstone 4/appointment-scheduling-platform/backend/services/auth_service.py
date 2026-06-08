from datetime import datetime, timedelta
import logging
from sqlalchemy.orm import Session
from sqlalchemy import func

from models.user import User
from models.service_provider import ServiceProvider
from models.provider_onboarding import ProviderOnboarding
from models.organization import Organization, OrganizationRequest
from utils.security import (
    hash_password, verify_password,
    create_access_token, generate_otp, hash_otp, verify_otp,
)
from utils.email import send_otp_email
from utils.exceptions import (
    bad_request, unauthorized, not_found, conflict, AppException
)


logger = logging.getLogger(__name__)


def _sanitize_user(user: User, db: Session = None) -> dict:
    """Strip sensitive fields before returning user data."""
    data = {
        "id": user.id,
        "full_name": user.full_name,
        "email": user.email,
        "phone": user.phone,
        "role": user.role,
        "is_active": user.is_active,
        "created_at": str(user.created_at),
    }
    if user.role == "organization" and db:
        org = db.query(Organization).filter(Organization.admin_user_id == user.id).first()
        if not org and user.email:
            org = db.query(Organization).filter(
                func.lower(Organization.contact_email) == user.email.lower().strip()
            ).first()
            if org and not org.admin_user_id:
                org.admin_user_id = user.id
                db.commit()
                db.refresh(org)
        if org:
            data["org_status"] = org.approval_status
            data["org_id"] = org.id
            data["org_name"] = org.name
            data["org_description"] = org.description
            data["org_location"] = org.location
            data["onboarding_completed"] = org.onboarding_completed
    return data


# ─── Signup ───────────────────────────────────────────────────────────────────

def signup_user(
    db: Session,
    full_name: str,
    email: str,
    password: str,
    phone: str,
    role: str,
    onboarding_data: dict | None = None,
) -> dict:
    email = email.lower().strip()
    full_name = " ".join(full_name.strip().split())
    phone = phone.strip()

    if role == "admin" and email != "nikhilchathapuram@gmail.com":
        raise bad_request("Admin registration is not allowed.")

    existing = db.query(User).filter(User.email == email).first()
    if existing:
        raise conflict("An account with this email already exists")

    otp = generate_otp()
    otp_expiry = datetime.utcnow() + timedelta(minutes=5)

    try:
        user = User(
            full_name=full_name,
            email=email,
            password_hash=hash_password(password),
            phone=phone,
            role=role,
            is_active=False,
            otp_hash=hash_otp(otp),
            otp_expiry=otp_expiry,
        )
        db.add(user)
        db.flush()

        # If provider, create a blank provider profile record
        if role == "provider":
            provider = ServiceProvider(user_id=user.id, specialization="General")
            db.add(provider)
            db.flush()
            if onboarding_data:
                db.add(
                    ProviderOnboarding(
                        provider_id=provider.id,
                        organization_name=onboarding_data.get("organization_name"),
                        owner_name=onboarding_data.get("owner_name"),
                        email=onboarding_data.get("email"),
                        phone=onboarding_data.get("phone"),
                        address=onboarding_data.get("address"),
                        identity_proof_url=onboarding_data.get("identity_proof_url"),
                        tax_number=onboarding_data.get("tax_number"),
                        bank_details=onboarding_data.get("bank_details"),
                        profile_photo_url=onboarding_data.get("profile_photo_url"),
                        certificates_urls=onboarding_data.get("certificates_urls"),
                    )
                )

        send_otp_email(email, otp)
        db.commit()
        db.refresh(user)
    except Exception as e:
        db.rollback()
        logger.critical(f"Failed to send signup OTP to {email}: {str(e)}")
        raise bad_request("Unable to send OTP email. Please check your email address and try again.")

    return {"email": email, "message": "OTP sent to your email. Please verify to activate your account."}


# ─── OTP Verification ─────────────────────────────────────────────────────────

def verify_otp_and_activate(db: Session, email: str, otp: str) -> dict:
    email = email.lower().strip()
    user = db.query(User).filter(User.email == email).first()

    if not user:
        raise not_found("User")

    if not user.otp_hash or not user.otp_expiry:
        raise bad_request("No OTP pending for this account")

    if datetime.utcnow() > user.otp_expiry:
        raise bad_request("OTP has expired. Please request a new one.")

    if not verify_otp(otp, user.otp_hash):
        raise unauthorized("Invalid OTP")

    user.is_active = True
    user.otp_hash = None
    user.otp_expiry = None
    
    if user.role == "organization":
        org = Organization(
            name=f"Org-{user.id[:8]}", # Temporary name
            admin_user_id=user.id,
            contact_email=user.email,
            is_approved=False,
            approval_status="pending"
        )
        db.add(org)
        db.flush()
        import json
        req = OrganizationRequest(
            organization_id=org.id,
            request_type="create",
            status="pending",
            requested_by=user.id,
            requested_changes=json.dumps({
                "name": user.full_name + "'s Organization",
                "contact_email": user.email,
                "contact_phone": user.phone
            })
        )
        db.add(req)
        
    db.commit()
    db.refresh(user)

    token = create_access_token({"id": user.id, "role": user.role, "email": user.email})
    return {"token": token, "user": _sanitize_user(user, db), "role": user.role}


# ─── Login ────────────────────────────────────────────────────────────────────

def login_user(db: Session, email: str, password: str) -> dict:
    email = email.lower().strip()
    user = db.query(User).filter(User.email == email).first()

    if not user:
        raise unauthorized("Invalid email or password")
        
    if user.deleted_at is not None:
        raise bad_request("Account has been deleted. Please restore it first.")

    if not verify_password(password, user.password_hash):
        raise unauthorized("Invalid email or password")

    if not user.is_active:
        raise bad_request("Account not verified. Please check your email for the OTP.")

    # Admin gets OTP 2FA — mirrors capstone admin login flow
    if user.role == "admin":
        otp = generate_otp()
        user.otp_hash = hash_otp(otp)
        user.otp_expiry = datetime.utcnow() + timedelta(minutes=5)
        db.commit()
        send_otp_email(email, otp)
        return {
            "isAdmin": True,
            "email": email,
            "message": "OTP sent to admin email",
        }

    token = create_access_token({"id": user.id, "role": user.role, "email": user.email})
    return {"token": token, "user": _sanitize_user(user, db), "role": user.role}


def verify_admin_otp(db: Session, email: str, otp: str) -> dict:
    email = email.lower().strip()
    user = db.query(User).filter(User.email == email, User.role == "admin").first()

    if not user:
        raise not_found("Admin")

    if not user.otp_hash or not user.otp_expiry:
        raise bad_request("No OTP pending")

    if datetime.utcnow() > user.otp_expiry:
        raise bad_request("OTP expired")

    if not verify_otp(otp, user.otp_hash):
        raise unauthorized("Invalid OTP")

    user.otp_hash = None
    user.otp_expiry = None
    db.commit()

    token = create_access_token({"id": user.id, "role": "admin", "email": user.email})
    return {"token": token, "user": _sanitize_user(user, db), "role": "admin"}


# ─── Forgot / Reset Password ──────────────────────────────────────────────────

def forgot_password(db: Session, email: str) -> dict:
    email = email.lower().strip()
    user = db.query(User).filter(User.email == email).first()

    if not user:
        raise not_found("User")

    if not user.is_active:
        raise bad_request("Account not yet verified")

    otp = generate_otp()
    user.otp_hash = hash_otp(otp)
    user.otp_expiry = datetime.utcnow() + timedelta(minutes=5)
    try:
        send_otp_email(email, otp)
        db.commit()
    except Exception as e:
        db.rollback()
        logger.critical(f"Failed to send forgot-password OTP to {email}: {str(e)}")
        raise bad_request("Unable to send OTP email. Please try again later.")
    return {"email": email, "message": "OTP sent to your email"}


def reset_password(db: Session, email: str, otp: str, new_password: str) -> dict:
    email = email.lower().strip()
    user = db.query(User).filter(User.email == email).first()

    if not user:
        raise not_found("User")

    if not user.otp_hash or not user.otp_expiry:
        raise bad_request("No OTP pending")

    if datetime.utcnow() > user.otp_expiry:
        raise bad_request("OTP expired")

    if not verify_otp(otp, user.otp_hash):
        raise unauthorized("Invalid OTP")

    user.password_hash = hash_password(new_password)
    user.otp_hash = None
    user.otp_expiry = None
    db.commit()

    return {"message": "Password updated successfully"}


# ─── Resend OTP ───────────────────────────────────────────────────────────────

def resend_otp(db: Session, email: str) -> dict:
    email = email.lower().strip()
    user = db.query(User).filter(User.email == email).first()

    if not user:
        raise not_found("User")

    otp = generate_otp()
    user.otp_hash = hash_otp(otp)
    user.otp_expiry = datetime.utcnow() + timedelta(minutes=5)
    try:
        send_otp_email(email, otp)
        db.commit()
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to resend OTP to {email}: {str(e)}")
        raise bad_request("Unable to send OTP email. Please try again later.")
    return {"message": "OTP resent successfully", "email": email}


# ─── Profile ──────────────────────────────────────────────────────────────────

def get_profile(db: Session, user_id: str) -> dict:
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise not_found("User")
    return _sanitize_user(user, db)

def update_profile(db: Session, user_id: str, data: dict) -> dict:
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise not_found("User")
        
    if "full_name" in data:
        user.full_name = data["full_name"]
    if "phone" in data:
        user.phone = data["phone"]
        
    if user.role == "organization":
        org = db.query(Organization).filter(Organization.admin_user_id == user.id).first()
        if not org and user.email:
            org = db.query(Organization).filter(
                func.lower(Organization.contact_email) == user.email.lower().strip()
            ).first()
            if org and not org.admin_user_id:
                org.admin_user_id = user.id
        if org:
            if "org_name" in data:
                org.name = data["org_name"]
            if "org_description" in data:
                org.description = data["org_description"]
            if "org_location" in data:
                org.location = data["org_location"]
                
    db.commit()
    db.refresh(user)
    return _sanitize_user(user, db)


# ─── Google OAuth ─────────────────────────────────────────────────────────────

import os
import json
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests

GOOGLE_SIGNUP_ROLES = {"customer", "provider", "organization"}


def _verify_google_credential(credential: str) -> dict:
    client_id = os.getenv("GOOGLE_CLIENT_ID", "YOUR_GOOGLE_CLIENT_ID")
    return id_token.verify_oauth2_token(
        credential,
        google_requests.Request(),
        # audience=client_id # omitted for dev flexibility if client_id is dummy
    )


def _create_google_user(db: Session, google_profile: dict, role: str) -> User:
    if role not in GOOGLE_SIGNUP_ROLES:
        raise bad_request("Role must be customer, provider, or organization")

    email = (google_profile.get("email") or "").lower().strip()
    if not email:
        raise bad_request("Google token did not contain an email address")

    user = User(
        full_name=google_profile.get("name") or email.split("@")[0],
        email=email,
        password_hash=None,
        phone=None,
        role=role,
        is_active=True,
        auth_provider="google",
        oauth_id=google_profile.get("sub"),
    )
    db.add(user)
    db.flush()

    if user.role == "provider":
        provider = ServiceProvider(user_id=user.id, specialization="General")
        db.add(provider)
    elif user.role == "organization":
        org = Organization(
            name=f"Org-{user.id[:8]}",
            admin_user_id=user.id,
            contact_email=user.email,
            is_approved=False,
            approval_status="pending",
        )
        db.add(org)
        db.flush()
        req = OrganizationRequest(
            organization_id=org.id,
            request_type="create",
            status="pending",
            requested_by=user.id,
            requested_changes=json.dumps({
                "name": f"{user.full_name}'s Organization",
                "contact_email": user.email,
            }),
        )
        db.add(req)

    db.commit()
    db.refresh(user)
    return user


def _issue_auth_payload(user: User, db: Session, is_new_user: bool = False) -> dict:
    if user.role == "admin":
        raise bad_request("Admin accounts must use email/password login.")

    token = create_access_token({"id": user.id, "role": user.role, "email": user.email})
    return {
        "token": token,
        "user": _sanitize_user(user, db),
        "role": user.role,
        "is_new_user": is_new_user,
        "isNewUser": is_new_user,
    }

def google_oauth_login(db: Session, credential: str, intent: str = "login", requested_role: str = "customer") -> dict:
    """Verifies Google JWT token and handles explicit signup/login intent."""
    try:
        idinfo = _verify_google_credential(credential)
        email = (idinfo.get("email") or "").lower().strip()
        oauth_id = idinfo.get("sub")
        
        if not email:
            raise bad_request("Google token did not contain an email address")

        user = db.query(User).filter(User.email == email).first()
        
        if intent == "signup":
            if user:
                if user.deleted_at is not None:
                    raise bad_request("Account has been deleted. Please restore it first.")
                if not user.oauth_id:
                    user.auth_provider = "google"
                    user.oauth_id = oauth_id
                if not user.is_active:
                    user.is_active = True
                db.commit()
                return _issue_auth_payload(user, db, False)

            user = _create_google_user(db, idinfo, requested_role or "customer")
            return _issue_auth_payload(user, db, True)
                
        elif intent == "login":
            if not user:
                return {
                    "is_new_user": True,
                    "isNewUser": True,
                    "email": email,
                    "name": idinfo.get("name", ""),
                }

            if user.deleted_at is not None:
                raise bad_request("Account has been deleted. Please restore it first.")
                
            if not user.oauth_id:
                user.auth_provider = "google"
                user.oauth_id = oauth_id
                db.commit()
            
            if not user.is_active:
                user.is_active = True
                db.commit()
        else:
            raise bad_request("Invalid intent")

        return _issue_auth_payload(user, db, False)

    except ValueError as e:
        logger.error(f"Google Token Verification Failed: {str(e)}")
        raise unauthorized("Invalid Google credentials")


def complete_google_signup(db: Session, credential: str, role: str) -> dict:
    """Creates a Google-backed user after login-page role selection."""
    try:
        idinfo = _verify_google_credential(credential)
        email = (idinfo.get("email") or "").lower().strip()
        if not email:
            raise bad_request("Google token did not contain an email address")

        user = db.query(User).filter(User.email == email).first()
        if user:
            if user.deleted_at is not None:
                raise bad_request("Account has been deleted. Please restore it first.")
            if not user.oauth_id:
                user.auth_provider = "google"
                user.oauth_id = idinfo.get("sub")
            if not user.is_active:
                user.is_active = True
            db.commit()
            return _issue_auth_payload(user, db, False)

        user = _create_google_user(db, idinfo, role)
        return _issue_auth_payload(user, db, True)
    except ValueError as e:
        logger.error(f"Google Token Verification Failed: {str(e)}")
        raise unauthorized("Invalid Google credentials")

# ─── Account Deletion / Restoration ──────────────────────────────────────────

def delete_account(db: Session, user_id: str) -> dict:
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise not_found("User")
    
    if user.deleted_at is not None:
        raise bad_request("Account is already deleted.")
        
    user.soft_delete()
    user.is_active = False
    db.commit()
    return {"message": "Account deleted successfully. You can restore it anytime by logging in."}


def restore_account(db: Session, email: str, password: str) -> dict:
    email = email.lower().strip()
    user = db.query(User).filter(User.email == email).first()
    if not user:
        raise not_found("User")
        
    if not verify_password(password, user.password_hash):
        raise unauthorized("Invalid email or password")
        
    if user.deleted_at is None:
        raise bad_request("Account is not deleted.")
        
    user.restore()
    user.is_active = True
    db.commit()
    
    token = create_access_token({"id": user.id, "role": user.role, "email": user.email})
    return {"token": token, "user": _sanitize_user(user, db), "role": user.role, "message": "Account restored successfully."}
