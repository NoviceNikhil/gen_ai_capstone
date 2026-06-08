from typing import List, Optional
from sqlalchemy.orm import Session
from models.category import Category
from utils.exceptions import not_found, conflict


def get_all_categories(db: Session, active_only: bool = False) -> List[Category]:
    query = db.query(Category)
    if active_only:
        query = query.filter(Category.is_active == True)
    return query.order_by(Category.name.asc()).all()


def create_category(db: Session, name: str, description: Optional[str], icon: Optional[str]) -> Category:
    existing = db.query(Category).filter(Category.name.ilike(name)).first()
    if existing:
        raise conflict(f"Category '{name}' already exists")

    category = Category(name=name, description=description, icon=icon)
    db.add(category)
    db.commit()
    db.refresh(category)
    return category


def update_category(db: Session, category_id: int, data: dict) -> Category:
    category = db.query(Category).filter(Category.id == category_id).first()
    if not category:
        raise not_found("Category")

    for field in ["name", "description", "icon", "is_active"]:
        if field in data and data[field] is not None:
            setattr(category, field, data[field])

    db.commit()
    db.refresh(category)
    return category


def delete_category(db: Session, category_id: int) -> bool:
    category = db.query(Category).filter(Category.id == category_id).first()
    if not category:
        raise not_found("Category")
    db.delete(category)
    db.commit()
    return True
