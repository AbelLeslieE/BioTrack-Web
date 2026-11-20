# ==========================================
# IMPORTS
# ==========================================

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from backend.auth import require_roles
from backend.database import get_db
from backend.models.log import Log


# ==========================================
# ROUTER
# ==========================================

router = APIRouter(dependencies=[Depends(require_roles("Manager", "BME"))])


# ==========================================
# GET ALL LOGS
# ==========================================

@router.get("/api/logs")
def get_logs(db: Session = Depends(get_db)):
    rows = db.query(Log).order_by(Log.id.desc()).all()
    return [
        {column.name: getattr(row, column.name) for column in Log.__table__.columns}
        for row in rows
    ]
