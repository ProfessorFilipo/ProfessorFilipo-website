"""
Retro visit counter — a nostalgic 90s-web homage. Real count, stored in the
settings table, incremented atomically at the database level (a single
UPDATE ... RETURNING avoids race conditions between concurrent requests,
without needing an application-level lock).

Rate limited server-side (see app.core.limiter) so a script hammering this
endpoint directly — bypassing the frontend's sessionStorage check entirely —
still can't drive unbounded database load.
"""
from fastapi import APIRouter, Depends, Request
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.limiter import limiter

router = APIRouter(prefix="/counter", tags=["counter"])

COUNTER_KEY = "site_visit_count"


@router.post("/hit")
@limiter.limit("5/minute")
def hit_counter(request: Request, db: Session = Depends(get_db)):
    result = db.execute(
        text(
            """
            INSERT INTO settings (setting_key, setting_value)
            VALUES (:key, '1')
            ON CONFLICT (setting_key) DO UPDATE
                SET setting_value = (settings.setting_value::int + 1)::text
            RETURNING setting_value
            """
        ),
        {"key": COUNTER_KEY},
    )
    new_count = int(result.scalar_one())
    db.commit()
    return {"count": new_count}


@router.get("/count")
@limiter.limit("30/minute")
def read_counter(request: Request, db: Session = Depends(get_db)):
    """Read-only — never increments. Used so repeat visits in the same
    session still display the true current total, not a stale cached one."""
    result = db.execute(
        text("SELECT setting_value FROM settings WHERE setting_key = :key"),
        {"key": COUNTER_KEY},
    )
    row = result.scalar_one_or_none()
    return {"count": int(row) if row is not None else 0}
