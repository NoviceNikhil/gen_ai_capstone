from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


class OrganizationCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = Field(None, max_length=1000)
    location: Optional[str] = Field(None, max_length=300)
    logo_url: Optional[str] = Field(None, max_length=500)
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = Field(None, max_length=20)
    metadata_json: Optional[str] = None


class OrganizationUpdate(BaseModel):
    """Schema for organization updates (goes through approval workflow)"""
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = Field(None, max_length=1000)
    location: Optional[str] = Field(None, max_length=300)
    logo_url: Optional[str] = Field(None, max_length=500)
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = Field(None, max_length=20)
    metadata_json: Optional[str] = None
    is_active: Optional[bool] = None


class OrganizationResponse(BaseModel):
    id: str
    name: str
    description: Optional[str]
    location: Optional[str]
    logo_url: Optional[str]
    contact_email: Optional[str]
    contact_phone: Optional[str]
    is_active: bool
    is_approved: bool
    approval_status: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class OrganizationDetailResponse(OrganizationResponse):
    """Detailed response with metadata"""
    metadata_json: Optional[str]
    admin_user_id: Optional[str]
    provider_count: Optional[int] = None


class OrganizationRequestCreate(BaseModel):
    """For requesting organization creation/updates"""
    request_type: str = Field(..., pattern="^(create|update)$")
    organization_data: OrganizationCreate | OrganizationUpdate


class OrganizationRequestResponse(BaseModel):
    id: str
    organization_id: str
    request_type: str
    status: str
    requested_by: Optional[str]
    approved_by: Optional[str]
    requested_changes: Optional[str]
    approval_notes: Optional[str]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class OrganizationRequestApprovalSchema(BaseModel):
    """Schema for approving/rejecting organization requests"""
    status: str = Field(..., pattern="^(approved|rejected)$")
    approval_notes: Optional[str] = Field(None, max_length=1000)


class OrganizationListResponse(BaseModel):
    """Lightweight response for listing organizations"""
    id: str
    name: str
    location: Optional[str]
    is_active: bool
    is_approved: bool
    approval_status: str
    created_at: datetime

    class Config:
        from_attributes = True


class OrganizationJoinRequestCreate(BaseModel):
    pass  # We don't need body, just the org_id from path


class OrganizationJoinRequestResponse(BaseModel):
    id: str
    organization_id: str
    provider_id: str
    status: str
    approved_by: Optional[str]
    approval_notes: Optional[str]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class OrganizationJoinRequestApprovalSchema(BaseModel):
    status: str = Field(..., pattern="^(approved|rejected)$")
    approval_notes: Optional[str] = Field(None, max_length=1000)
