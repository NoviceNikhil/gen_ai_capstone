from pydantic import BaseModel, field_validator, model_validator
from typing import Optional
import re
from models.service_provider import IndianState, IndianCity


class ProviderProfileUpdate(BaseModel):
    specialization: Optional[str] = None
    experience_years: Optional[int] = None
    profile_description: Optional[str] = None
    location: Optional[str] = None
    state: Optional[IndianState] = None
    city: Optional[IndianCity] = None
    pincode: Optional[str] = None
    consultation_fee: Optional[float] = None
    is_accepting_appointments: Optional[bool] = None
    category_id: Optional[int] = None
    organization_id: Optional[str] = None
    organization_name: Optional[str] = None
    owner_name: Optional[str] = None
    address: Optional[str] = None
    tax_number: Optional[str] = None
    bank_details: Optional[str] = None
    identity_proof_url: Optional[str] = None
    certificates_urls: Optional[str] = None
    profile_photo_url: Optional[str] = None

    @field_validator("owner_name")
    @classmethod
    def validate_owner_name(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            if len(v.strip()) < 2:
                raise ValueError("Owner Name must be at least 2 characters long.")
            if not re.match(r"^[A-Za-z\s]+$", v):
                raise ValueError("Owner Name must contain only alphabets and spaces.")
        return v

    @field_validator("address")
    @classmethod
    def validate_address(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            if v.strip() == "":
                return None
            if len(v.strip()) < 10:
                raise ValueError("Address must be at least 10 characters long.")
        return v

    @field_validator("tax_number")
    @classmethod
    def validate_tax_number(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            v_clean = v.strip()
            if len(v_clean) < 8 or len(v_clean) > 20:
                raise ValueError("Tax ID (GST/VAT/PAN) must be between 8 and 20 characters long.")
            if not v_clean.isalnum():
                raise ValueError("Tax ID must contain only alphanumeric characters.")
        return v

    @field_validator("bank_details")
    @classmethod
    def validate_bank_details(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            if len(v.strip()) < 10:
                raise ValueError("Bank details must be at least 10 characters long.")
        return v

    @field_validator("specialization")
    @classmethod
    def validate_specialization(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            if len(v.strip()) < 3:
                raise ValueError("Specialization must be at least 3 characters long.")
        return v

    @field_validator("experience_years")
    @classmethod
    def validate_experience_years(cls, v: Optional[int]) -> Optional[int]:
        if v is not None:
            if v < 0:
                raise ValueError("Experience years cannot be negative.")
        return v

    @field_validator("profile_description")
    @classmethod
    def validate_profile_description(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            if len(v.strip()) < 20:
                raise ValueError("Profile description must be at least 20 characters long.")
        return v

    @model_validator(mode="after")
    def validate_pincode_and_city(self) -> 'ProviderProfileUpdate':
        city = self.city
        pincode = self.pincode
        if city and pincode:
            pincode_prefixes = {
                "Bengaluru": ["560"],
                "Mumbai": ["400"],
                "Pune": ["411", "412"],
                "Chennai": ["600"],
                "Hyderabad": ["500"],
                "Delhi": ["110"],
                "Ahmedabad": ["380"],
                "Surat": ["395"],
                "Jaipur": ["302"],
                "Kolkata": ["700"],
                "Kochi": ["682"],
            }
            city_str = city.value if hasattr(city, "value") else str(city)
            allowed = pincode_prefixes.get(city_str)
            if not allowed:
                raise ValueError(f"City '{city_str}' does not have mapped valid pincode prefixes.")
            if len(pincode) != 6 or not pincode.isdigit():
                raise ValueError("PIN code must be exactly 6 digits.")
            if not any(pincode.startswith(pref) for pref in allowed):
                raise ValueError(f"PIN code '{pincode}' is not valid for city '{city_str}'. Valid prefix is {allowed}.")
        return self


class ProviderOnboardingUpdate(BaseModel):
    organization_name: Optional[str] = None
    owner_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    state: Optional[IndianState] = None
    city: Optional[IndianCity] = None
    pincode: Optional[str] = None
    identity_proof_url: Optional[str] = None
    tax_number: Optional[str] = None
    bank_details: Optional[str] = None
    profile_photo_url: Optional[str] = None
    certificates_urls: Optional[str] = None
    submitted_for_approval: Optional[bool] = None
    
    # Also support sending these professional details during onboarding
    specialization: Optional[str] = None
    experience_years: Optional[int] = None
    profile_description: Optional[str] = None
    consultation_fee: Optional[float] = None
    category_id: Optional[int] = None

    @field_validator("owner_name")
    @classmethod
    def validate_owner_name(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            if len(v.strip()) < 2:
                raise ValueError("Owner Name must be at least 2 characters long.")
            if not re.match(r"^[A-Za-z\s]+$", v):
                raise ValueError("Owner Name must contain only alphabets and spaces.")
        return v

    @field_validator("address")
    @classmethod
    def validate_address(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            if v.strip() == "":
                return None
            if len(v.strip()) < 10:
                raise ValueError("Address must be at least 10 characters long.")
        return v

    @field_validator("tax_number")
    @classmethod
    def validate_tax_number(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            v_clean = v.strip()
            if len(v_clean) < 8 or len(v_clean) > 20:
                raise ValueError("Tax ID (GST/VAT/PAN) must be between 8 and 20 characters long.")
            if not v_clean.isalnum():
                raise ValueError("Tax ID must contain only alphanumeric characters.")
        return v

    @field_validator("bank_details")
    @classmethod
    def validate_bank_details(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            if len(v.strip()) < 10:
                raise ValueError("Bank details must be at least 10 characters long.")
        return v

    @field_validator("specialization")
    @classmethod
    def validate_specialization(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            if len(v.strip()) < 3:
                raise ValueError("Specialization must be at least 3 characters long.")
        return v

    @field_validator("experience_years")
    @classmethod
    def validate_experience_years(cls, v: Optional[int]) -> Optional[int]:
        if v is not None:
            if v < 0:
                raise ValueError("Experience years cannot be negative.")
        return v

    @field_validator("profile_description")
    @classmethod
    def validate_profile_description(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            if len(v.strip()) < 20:
                raise ValueError("Profile description must be at least 20 characters long.")
        return v

    @model_validator(mode="after")
    def validate_pincode_and_city(self) -> 'ProviderOnboardingUpdate':
        city = self.city
        pincode = self.pincode
        if city and pincode:
            pincode_prefixes = {
                "Bengaluru": ["560"],
                "Mumbai": ["400"],
                "Pune": ["411", "412"],
                "Chennai": ["600"],
                "Hyderabad": ["500"],
                "Delhi": ["110"],
                "Ahmedabad": ["380"],
                "Surat": ["395"],
                "Jaipur": ["302"],
                "Kolkata": ["700"],
                "Kochi": ["682"],
            }
            city_str = city.value if hasattr(city, "value") else str(city)
            allowed = pincode_prefixes.get(city_str)
            if not allowed:
                raise ValueError(f"City '{city_str}' does not have mapped valid pincode prefixes.")
            if len(pincode) != 6 or not pincode.isdigit():
                raise ValueError("PIN code must be exactly 6 digits.")
            if not any(pincode.startswith(pref) for pref in allowed):
                raise ValueError(f"PIN code '{pincode}' is not valid for city '{city_str}'. Valid prefix is {allowed}.")
        return self


class ProviderFilterParams(BaseModel):
    """Query params for customer browsing providers"""
    search: Optional[str] = None        # name or specialization
    category_id: Optional[int] = None
    location: Optional[str] = None
    min_rating: Optional[float] = None
    page: int = 1
    limit: int = 12
