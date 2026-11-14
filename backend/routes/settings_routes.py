import csv
import io
import json
from datetime import date, datetime, timezone

from fastapi import APIRouter, Depends, Request as WebRequest, Response
from jose import jwt
from sqlalchemy.orm import Query, Session

from backend.auth import get_current_user
from backend.database import get_db
from backend.models.asset import Asset
from backend.models.inventory import Inventory
from backend.models.pm_schedule import PMSchedule
from backend.models.request import Request as MaintenanceRequest
from backend.models.user import User


router = APIRouter(
    prefix="/api/settings",
    tags=["Settings"],
    dependencies=[Depends(get_current_user)],
)


def _team_for(user: User) -> str | None:
    return {
        "bme": "Biomedical",
        "electrical": "Electrical",
        "it": "IT",
    }.get((user.role or "").casefold())


def _serialise_row(row, excluded: set[str] | None = None) -> dict:
    excluded = excluded or set()
    result = {}
    for column in row.__table__.columns:
        if column.name in excluded:
            continue
        value = getattr(row, column.name)
        result[column.name] = value.isoformat() if isinstance(value, (date, datetime)) else value
    return result


def _scoped_queries(db: Session, user: User) -> dict[str, Query]:
    role = (user.role or "").casefold()
    request_query = db.query(MaintenanceRequest)
    asset_query = db.query(Asset)
    inventory_query = db.query(Inventory)
    pm_query = db.query(PMSchedule)

    if role == "user":
        request_query = request_query.filter(MaintenanceRequest.created_by == user.username)
        asset_query = asset_query.filter(Asset.department == user.department)
        pm_query = pm_query.filter(PMSchedule.department == user.department)
        inventory_query = inventory_query.filter(Inventory.id == -1)
    else:
        team = _team_for(user)
        if team:
            request_query = request_query.filter(MaintenanceRequest.service_team == team)
            asset_query = asset_query.filter(Asset.service_team == team)
            inventory_query = inventory_query.filter(Inventory.service_team == team)
            asset_ids = db.query(Asset.id).filter(Asset.service_team == team)
            pm_query = pm_query.filter(PMSchedule.asset_id.in_(asset_ids))

    return {
        "requests": request_query,
        "assets": asset_query,
        "inventory": inventory_query,
        "preventive_maintenance": pm_query,
    }


@router.get("/session")
def current_session(
    request: WebRequest,
    current_user: User = Depends(get_current_user),
):
    token = request.cookies.get("access_token")
    claims = jwt.get_unverified_claims(token) if token else {}
    issued_at = claims.get("iat")
    expires_at = claims.get("exp")
    return {
        "username": current_user.username,
        "role": current_user.role,
        "ip_address": request.client.host if request.client else "Unknown",
        "user_agent": request.headers.get("user-agent", "Unknown browser"),
        "issued_at": datetime.fromtimestamp(issued_at, timezone.utc).isoformat() if issued_at else None,
        "expires_at": datetime.fromtimestamp(expires_at, timezone.utc).isoformat() if expires_at else None,
        "current": True,
    }


@router.get("/backup")
def download_backup(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    queries = _scoped_queries(db, current_user)
    payload = {
        "system": "BioTrack Biomedical Maintenance System",
        "generated_at": datetime.now().isoformat(),
        "generated_by": current_user.username,
        "scope": "hospital" if (current_user.role or "").casefold() == "manager" else (_team_for(current_user) or current_user.department or "account"),
        "data": {
            name: [_serialise_row(row) for row in query.all()]
            for name, query in queries.items()
        },
    }
    if (current_user.role or "").casefold() == "manager":
        payload["data"]["users"] = [
            _serialise_row(user, {"password_hash"})
            for user in db.query(User).all()
        ]
    filename = f"biotrack-backup-{datetime.now().strftime('%Y%m%d-%H%M%S')}.json"
    return Response(
        content=json.dumps(payload, indent=2),
        media_type="application/json",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/export")
def export_maintenance_data(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    requests = _scoped_queries(db, current_user)["requests"].order_by(MaintenanceRequest.id.desc()).all()
    stream = io.StringIO(newline="")
    writer = csv.writer(stream)
    writer.writerow([
        "Ticket", "Equipment", "Equipment ID", "Department", "Location",
        "Service Team", "Priority", "Status", "Reported At", "Fixed At", "Downtime Hours",
    ])
    for item in requests:
        writer.writerow([
            item.ticket_number,
            item.equipment_name,
            item.equipment_identifier,
            item.department,
            item.location,
            item.service_team,
            item.priority,
            item.status,
            item.call_received_datetime.isoformat() if item.call_received_datetime else "",
            item.fixed_datetime.isoformat() if item.fixed_datetime else "",
            item.final_downtime_hours or 0,
        ])
    filename = f"biotrack-maintenance-{datetime.now().strftime('%Y%m%d-%H%M%S')}.csv"
    return Response(
        content=stream.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
