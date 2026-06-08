import re
from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator
from typing import Optional


CONTROL_CHARS_RE = re.compile(r"[\x00-\x1f\x7f]")
NAME_RE = re.compile(r"^[A-Za-z][A-Za-z .'-]{1,148}[A-Za-z]$")
PHONE_CHARS_RE = re.compile(r"^\+?[0-9 ()-]{7,20}$")
OTP_RE = re.compile(r"^\d{6}$")


def clean_text(value: str) -> str:
    return CONTROL_CHARS_RE.sub("", value).strip()


def validate_password(value: str, require_strength: bool = True) -> str:
    if not isinstance(value, str):
        raise ValueError("Password is required")
    if len(value) < 8:
        raise ValueError("Password must be at least 8 characters")
    if len(value.encode("utf-8")) > 72:
        raise ValueError("Password must be 72 bytes or fewer")
    if require_strength:
        if not any(c.islower() for c in value):
            raise ValueError("Password must contain at least one lowercase letter")
        if not any(c.isupper() for c in value):
            raise ValueError("Password must contain at least one uppercase letter")
        if not any(c.isdigit() for c in value):
            raise ValueError("Password must contain at least one digit")
        if not any(not c.isalnum() for c in value):
            raise ValueError("Password must contain at least one special character")
    return value


class SignupRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    full_name: str = Field(min_length=2, max_length=150)
    email: EmailStr
    password: str = Field(min_length=8, max_length=72)
    phone: str = Field(min_length=7, max_length=20)
    role: str = "customer"  # customer | provider | organization
    organization_name: Optional[str] = None
    owner_name: Optional[str] = None
    address: Optional[str] = None
    identity_proof_url: Optional[str] = None
    tax_number: Optional[str] = None
    bank_details: Optional[str] = None
    profile_photo_url: Optional[str] = None
    certificates_urls: Optional[str] = None

    @field_validator("full_name", mode="before")
    @classmethod
    def sanitize_name(cls, v: str) -> str:
        v = clean_text(str(v))
        if not NAME_RE.match(v):
            raise ValueError("Full name may only contain letters, spaces, apostrophes, periods, and hyphens")
        return " ".join(v.split())

    @field_validator("email", mode="after")
    @classmethod
    def normalize_email(cls, v: EmailStr) -> str:
        return str(v).lower().strip()

    @field_validator("password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        return validate_password(v, require_strength=True)

    @field_validator("phone", mode="before")
    @classmethod
    def valid_phone(cls, v: str) -> str:
        v = clean_text(str(v))
        digits = re.sub(r"\D", "", v)
        if not PHONE_CHARS_RE.match(v) or not 7 <= len(digits) <= 15:
            raise ValueError("Phone number must contain 7 to 15 digits")
        return v

    @field_validator("role")
    @classmethod
    def valid_role(cls, v: str) -> str:
        if v not in ("customer", "provider", "organization"):
            raise ValueError("Role must be 'customer', 'provider', or 'organization'")
        return v


class LoginRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    email: EmailStr
    password: str = Field(min_length=1, max_length=72)

    @field_validator("email", mode="after")
    @classmethod
    def normalize_email(cls, v: EmailStr) -> str:
        return str(v).lower().strip()

    @field_validator("password")
    @classmethod
    def valid_password_size(cls, v: str) -> str:
        if len(v.encode("utf-8")) > 72:
            raise ValueError("Password must be 72 bytes or fewer")
        return v


class OtpVerifyRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    email: EmailStr
    otp: str = Field(min_length=6, max_length=6)

    @field_validator("email", mode="after")
    @classmethod
    def normalize_email(cls, v: EmailStr) -> str:
        return str(v).lower().strip()

    @field_validator("otp")
    @classmethod
    def valid_otp(cls, v: str) -> str:
        if not OTP_RE.match(v):
            raise ValueError("OTP must be exactly 6 digits")
        return v


class ResendOtpRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    email: EmailStr
    role: Optional[str] = "customer"

    @field_validator("email", mode="after")
    @classmethod
    def normalize_email(cls, v: EmailStr) -> str:
        return str(v).lower().strip()


class ForgotPasswordRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    email: EmailStr

    @field_validator("email", mode="after")
    @classmethod
    def normalize_email(cls, v: EmailStr) -> str:
        return str(v).lower().strip()


class ResetPasswordRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    email: EmailStr
    otp: str = Field(min_length=6, max_length=6)
    new_password: str = Field(min_length=8, max_length=72)

    @field_validator("email", mode="after")
    @classmethod
    def normalize_email(cls, v: EmailStr) -> str:
        return str(v).lower().strip()

    @field_validator("otp")
    @classmethod
    def valid_otp(cls, v: str) -> str:
        if not OTP_RE.match(v):
            raise ValueError("OTP must be exactly 6 digits")
        return v

    @field_validator("new_password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        return validate_password(v, require_strength=True)


class TokenResponse(BaseModel):
    token: str
    role: str
    user: dict

class ProfileUpdateRequest(BaseModel):
    full_name: Optional[str] = None
    phone: Optional[str] = None
    org_name: Optional[str] = None
    org_description: Optional[str] = None
    org_location: Optional[str] = None

class GoogleAuthRequest(BaseModel):
    credential: str = Field(..., description="JWT token from Google")
    role: Optional[str] = Field("customer", description="Role if this is a new signup")
    intent: str = Field("login", description="'login' or 'signup'")

    @field_validator("role")
    @classmethod
    def valid_google_role(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v not in ("customer", "provider", "organization"):
            raise ValueError("Role must be 'customer', 'provider', or 'organization'")
        return v

    @field_validator("intent")
    @classmethod
    def valid_intent(cls, v: str) -> str:
        if v not in ("login", "signup"):
            raise ValueError("Intent must be 'login' or 'signup'")
        return v

class GoogleCompleteSignupRequest(BaseModel):
    credential: str = Field(..., description="JWT token from Google")
    role: str = Field(..., description="Selected role for the new Google user")

    @field_validator("role")
    @classmethod
    def valid_role(cls, v: str) -> str:
        if v not in ("customer", "provider", "organization"):
            raise ValueError("Role must be 'customer', 'provider', or 'organization'")
        return v

class RestoreAccountRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=72)
