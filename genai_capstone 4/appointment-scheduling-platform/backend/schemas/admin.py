from pydantic import BaseModel
from typing import Optional


class CategoryCreate(BaseModel):
    name: str
    description: Optional[str] = None
    icon: Optional[str] = None          # Lucide icon name


class CategoryUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    icon: Optional[str] = None
    is_active: Optional[bool] = None


class AdminUserStatusUpdate(BaseModel):
    is_active: bool


class AdminProviderVerify(BaseModel):
    is_verified: bool
