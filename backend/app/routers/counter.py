"""
Retro visit counter — a nostalgic 90s-web homage. Real count, stored in the
settings table, incremented atomically at the database level (a single
UPDATE ... RETURNING avoids race conditions between concurrent requests,
without needing an application-level lock).

Also tracks the date counting started, in a second settings row written
once via INSERT ... ON CONFLICT DO NOTHING — the first hit ever recorded
sets it, every hit after that is a no-op on that specific row, so the
date never moves once set.

Rate limited server-side (see app.core.limiter) so a script hammering this
endpoint directly — bypassing the frontend's sessionStorage check entirely —
still can't drive unbounded database load.
"""
from datetime import datetime
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, Request
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.limiter import limiter

router = APIRouter(prefix="/counter", tags=["counter"])

COUNTER_KEY = "site_visit_count"
COUNTER_STARTED_KEY = "site_visit_count_started_at"


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

    # Só grava na primeira vez que esta chave é vista — depois disso o
    # ON CONFLICT DO NOTHING garante que a data nunca é sobrescrita.
    started_today = datetime.now(ZoneInfo("America/Sao_Paulo")).date().isoformat()
    db.execute(
        text(
            """
            INSERT INTO settings (setting_key, setting_value)
            VALUES (:key, :value)
            ON CONFLICT (setting_key) DO NOTHING
            """
        ),
        {"key": COUNTER_STARTED_KEY, "value": started_today},
    )

    db.commit()
    return {"count": new_count, "started_at": _read_started_at(db)}


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
    return {"count": int(row) if row is not None else 0, "started_at": _read_started_at(db)}


def _read_started_at(db: Session) -> str | None:
    result = db.execute(
        text("SELECT setting_value FROM settings WHERE setting_key = :key"),
        {"key": COUNTER_STARTED_KEY},
    )
    return result.scalar_one_or_none()
