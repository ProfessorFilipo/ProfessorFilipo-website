"""
Read-only endpoint for structural pages (Home, About, Contact).
Serves as the first real example of the request -> DB -> response flow.
Write/admin endpoints (create, update, delete) come later, once the
admin panel authentication is in place.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.page import Page

router = APIRouter(prefix="/pages", tags=["pages"])


@router.get("/{locale}/{slug}")
def get_page(locale: str, slug: str, db: Session = Depends(get_db)):
    page = db.query(Page).filter(Page.locale == locale, Page.slug == slug).first()
    if page is None:
        raise HTTPException(status_code=404, detail="Page not found")
    return {
        "slug": page.slug,
        "locale": page.locale,
        "title": page.title,
        "content": page.content,
        "meta_description": page.meta_description,
    }
