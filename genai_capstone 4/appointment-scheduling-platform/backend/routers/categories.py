from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import Optional

from config.database import get_db
from middleware.auth import get_current_user
from services import category_service
from schemas.category import CategoryCreate, CategoryUpdate
from utils.response import success_response

router = APIRouter(prefix="/api/categories", tags=["Categories"])


@router.get("")
def get_categories(
    active_only: bool = Query(True),
    db: Session = Depends(get_db),
):
    categories = category_service.get_all_categories(db, active_only)
    return success_response({"categories": categories}, "Categories fetched")


@router.post("")
def create_category(
    body: CategoryCreate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    category = category_service.create_category(db, body.name, body.description, body.icon)
    return success_response({"category": category}, "Category created", 201)


@router.patch("/{category_id}")
def update_category(
    category_id: int,
    body: CategoryUpdate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    category = category_service.update_category(db, category_id, body.model_dump(exclude_none=True))
    return success_response({"category": category}, "Category updated")


@router.delete("/{category_id}")
def delete_category(
    category_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    category_service.delete_category(db, category_id)
    return success_response(None, "Category deleted")
