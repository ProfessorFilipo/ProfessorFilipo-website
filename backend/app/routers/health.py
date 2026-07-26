"""
Health check endpoint — confirms the API is running and can reach the database.
Useful for Cloud Run's own health probes, and for a quick manual sanity check.
"""
from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.database import get_db

router = APIRouter(tags=["health"])


@router.get("/health")
def health_check(db: Session = Depends(get_db)):
    db.execute(text("SELECT 1"))
    return {"status": "ok", "database": "reachable"}
