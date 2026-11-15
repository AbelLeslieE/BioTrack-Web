# ==========================================
# IMPORTS
# ==========================================

from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.orm import Session

from backend.auth import require_roles
from backend.database import get_db


# ==========================================
# ROUTER
# ==========================================

router = APIRouter(dependencies=[Depends(require_roles("Manager", "BME"))])


# ==========================================
# GET ALL LOGS
# ==========================================

@router.get("/api/logs")
def get_logs(db: Session = Depends(get_db)):
    rows = db.execute(
        text("""
        SELECT *
        FROM logs
        ORDER BY id DESC
        """)
    ).mappings().all()
    return [dict(row) for row in rows]
