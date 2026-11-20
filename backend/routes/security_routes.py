from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from backend.auth import require_roles
from backend.database import get_db
from backend.models.security_audit import SecurityAudit


router = APIRouter(
    prefix="/api/security",
    tags=["Security"],
    dependencies=[Depends(require_roles("Manager"))],
)


@router.get("/audit")
def security_audit_feed(
    limit: int = Query(default=100, ge=1, le=500),
    event_type: str | None = Query(default=None, max_length=80),
    db: Session = Depends(get_db),
):
    query = db.query(SecurityAudit)
    if event_type:
        query = query.filter(SecurityAudit.event_type == event_type)
    events = query.order_by(SecurityAudit.id.desc()).limit(limit).all()
    return [
        {
            "id": event.id,
            "event_type": event.event_type,
            "outcome": event.outcome,
            "actor_username": event.actor_username,
            "target_type": event.target_type,
            "target_id": event.target_id,
            "ip_address": event.ip_address,
            "request_id": event.request_id,
            "details": event.details,
            "created_at": event.created_at,
        }
        for event in events
    ]
